import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

const NULL_PAGING = { offset: null, limit: null, total: null, totalPages: null, hasNext: null, hasPrev: null };
const LIST_PAGING = (total: number) => ({ offset: 0, limit: 20, total, totalPages: 1, hasNext: false, hasPrev: false });

const MOCK_ACCOUNTS = [
  { id: 'acc-001', accountName: 'Acme Corp', accountType: 'enterprise', status: 'active' },
  { id: 'acc-002', accountName: 'Globex Inc', accountType: 'enterprise', status: 'active' },
];

const MOCK_WEBHOOKS = [
  {
    id: 'wh-001',
    accountId: 'acc-001',
    account: { accountName: 'Acme Corp' },
    url: 'https://acme.io/hooks/billing',
    events: ['invoice.paid', 'invoice.overdue', 'payment.received'],
    active: true,
    description: 'Production billing webhook',
    createdAt: '2026-05-10T00:00:00.000Z',
    updatedAt: '2026-05-10T00:00:00.000Z',
  },
  {
    id: 'wh-002',
    accountId: 'acc-002',
    account: { accountName: 'Globex Inc' },
    url: 'https://globex.com/webhooks',
    events: ['contract.renewed'],
    active: false,
    description: null,
    createdAt: '2026-04-22T00:00:00.000Z',
    updatedAt: '2026-04-22T00:00:00.000Z',
  },
];

const MOCK_WEBHOOK_SINGLE = MOCK_WEBHOOKS[0];

const MOCK_DELIVERIES = [
  {
    id: 'del-001',
    webhookId: 'wh-001',
    event: 'invoice.paid',
    payload: {},
    status: 'delivered',
    responseStatus: 200,
    responseBody: 'ok',
    attemptCount: 1,
    lastAttemptAt: '2026-06-01T09:42:00.000Z',
    deliveredAt: '2026-06-01T09:42:01.000Z',
    createdAt: '2026-06-01T09:42:00.000Z',
  },
  {
    id: 'del-002',
    webhookId: 'wh-001',
    event: 'payment.received',
    payload: {},
    status: 'failed',
    responseStatus: 503,
    responseBody: 'Service Unavailable',
    attemptCount: 3,
    lastAttemptAt: '2026-06-01T09:40:00.000Z',
    deliveredAt: null,
    createdAt: '2026-06-01T09:38:00.000Z',
  },
];

async function mountWebhookDetailMocks(page: any) {
  // Register most-specific routes last so they win (Playwright uses LIFO matching).
  // List fallback — least specific
  await page.route('**/api/webhooks**', (route: any) =>
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ data: MOCK_WEBHOOKS, paging: { offset: 0, limit: 20, total: 2, totalPages: 1, hasNext: false, hasPrev: false } }) })
  );
  // Single webhook — more specific (registered after list so it wins over list)
  await page.route('**/api/webhooks/wh-001**', (route: any) => {
    // Only handle the single-webhook request; let deliveries fall through to the next handler
    if (route.request().url().includes('/deliveries')) {
      route.fallback();
      return;
    }
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ data: MOCK_WEBHOOK_SINGLE, paging: { offset: null, limit: null, total: null, totalPages: null, hasNext: null, hasPrev: null } }) });
  });
  // Deliveries — most specific (registered last so it wins)
  await page.route('**/api/webhooks/wh-001/deliveries**', (route: any) =>
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ data: MOCK_DELIVERIES, paging: { offset: null, limit: null, total: 2, totalPages: null, hasNext: null, hasPrev: null } }) })
  );
}

async function mountWebhookListMocks(page: any) {
  await page.route('**/api/accounts**', (route: any) =>
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ data: MOCK_ACCOUNTS, paging: LIST_PAGING(2) }) })
  );
  await page.route('**/api/webhooks**', (route: any) =>
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ data: MOCK_WEBHOOKS, paging: LIST_PAGING(2) }) })
  );
}

test.describe('Webhooks List', () => {
  test.beforeEach(async ({ page }) => {
    await mountWebhookListMocks(page);
    await page.goto(`${BASE_URL}/webhooks`);
    await page.waitForLoadState('networkidle');
  });

  test('renders page heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Webhooks' })).toBeVisible();
  });

  test('renders webhook URLs', async ({ page }) => {
    await expect(page.getByText('https://acme.io/hooks/billing')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('https://globex.com/webhooks')).toBeVisible({ timeout: 5000 });
  });

  test('active webhook shows Active badge', async ({ page }) => {
    await expect(page.getByText('Active', { exact: true }).first()).toBeVisible({ timeout: 5000 });
  });

  test('inactive webhook shows Inactive badge', async ({ page }) => {
    await expect(page.getByText('Inactive', { exact: true })).toBeVisible({ timeout: 5000 });
  });

  test('Register Webhook button opens modal', async ({ page }) => {
    await page.getByRole('button', { name: /register webhook/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('register modal has URL and events fields', async ({ page }) => {
    await page.getByRole('button', { name: /register webhook/i }).click();
    await expect(page.getByLabel(/url/i)).toBeVisible();
    await expect(page.getByRole('dialog').getByText('invoice.paid')).toBeVisible({ timeout: 3000 });
  });

  test('register modal validates required fields', async ({ page }) => {
    await page.getByRole('button', { name: /register webhook/i }).click();
    await page.getByRole('button', { name: /^register$/i }).click();
    await expect(page.getByText(/required/i).first()).toBeVisible({ timeout: 3000 });
  });

  test('clicking URL navigates to webhook detail', async ({ page }) => {
    await page.getByText('https://acme.io/hooks/billing').click();
    await expect(page).toHaveURL(`${BASE_URL}/webhooks/wh-001`);
  });

  test('Deactivate button opens confirmation dialog', async ({ page }) => {
    await page.getByRole('button', { name: /deactivate/i }).first().click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
  });
});

test.describe('Webhook Detail', () => {
  test.beforeEach(async ({ page }) => {
    await mountWebhookDetailMocks(page);
    await page.goto(`${BASE_URL}/webhooks/wh-001`);
    await page.waitForLoadState('networkidle');
  });

  test('renders webhook URL as title', async ({ page }) => {
    await expect(page.getByText('https://acme.io/hooks/billing')).toBeVisible({ timeout: 5000 });
  });

  test('renders subscribed events', async ({ page }) => {
    await expect(page.getByText('invoice.paid').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('invoice.overdue')).toBeVisible({ timeout: 5000 });
  });

  test('renders Delivery History heading', async ({ page }) => {
    await expect(page.getByText('Delivery History')).toBeVisible({ timeout: 5000 });
  });

  test('shows delivered and failed status badges', async ({ page }) => {
    await expect(page.getByText('delivered', { exact: true })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('failed', { exact: true })).toBeVisible({ timeout: 5000 });
  });

  test('shows HTTP status codes', async ({ page }) => {
    await expect(page.getByText('200')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('503')).toBeVisible({ timeout: 5000 });
  });

  test('Deactivate button opens confirmation dialog on active webhook', async ({ page }) => {
    await page.getByRole('button', { name: /deactivate/i }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
  });

  test('back arrow navigates to /webhooks', async ({ page }) => {
    // Two links share href="/webhooks" (nav breadcrumb + back arrow); click the back arrow (first with empty text)
    await page.locator('a[href="/webhooks"]').filter({ hasText: /^$/ }).click();
    await expect(page).toHaveURL(`${BASE_URL}/webhooks`);
  });
});

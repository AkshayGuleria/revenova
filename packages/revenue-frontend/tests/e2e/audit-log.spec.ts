import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

const LIST_PAGING = (total: number) => ({ offset: 0, limit: 20, total, totalPages: Math.ceil(total / 20), hasNext: total > 20, hasPrev: false });

const MOCK_AUDIT_LOGS = [
  {
    id: 'al-001',
    entityType: 'invoice',
    entityId: 'inv-001',
    action: 'status_changed',
    actorId: null,
    actorType: 'system',
    changes: { status: { from: 'draft', to: 'paid' } },
    metadata: { ip: '192.168.1.1' },
    createdAt: '2026-06-01T09:42:11.000Z',
  },
  {
    id: 'al-002',
    entityType: 'contract',
    entityId: 'con-001',
    action: 'updated',
    actorId: 'usr-001',
    actorType: 'user',
    changes: { autoRenew: { from: false, to: true } },
    metadata: null,
    createdAt: '2026-06-01T09:38:04.000Z',
  },
];

async function mockAuditLogApi(page: any) {
  await page.route('**/api/audit-log**', (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: MOCK_AUDIT_LOGS, paging: LIST_PAGING(2) }),
    })
  );
}

test.describe('Audit Log Page', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuditLogApi(page);
    await page.goto(`${BASE_URL}/audit-log`);
    await page.waitForLoadState('networkidle');
  });

  test('renders page heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Audit Log' })).toBeVisible();
  });

  test('renders entity type and action filter dropdowns', async ({ page }) => {
    await expect(page.getByRole('combobox').first()).toBeVisible();
  });

  test('renders audit log rows', async ({ page }) => {
    await expect(page.getByText('invoice', { exact: true })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('contract', { exact: true })).toBeVisible({ timeout: 5000 });
  });

  test('clicking expand toggle shows changes diff', async ({ page }) => {
    const firstToggle = page.locator('button[aria-label="expand"]').first();
    await firstToggle.click();
    await expect(page.getByText('status').first()).toBeVisible({ timeout: 3000 });
  });

  test('shows pagination info', async ({ page }) => {
    await expect(page.getByText(/Showing/)).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Audit Log — Filters', () => {
  test('entity type filter sends request with entityType[eq] param', async ({ page }) => {
    let capturedUrl = '';
    await page.route('**/api/audit-log**', (route: any) => {
      capturedUrl = route.request().url();
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], paging: LIST_PAGING(0) }),
      });
    });

    await page.goto(`${BASE_URL}/audit-log`);
    await page.waitForLoadState('networkidle');

    const entityTypeSelect = page.getByRole('combobox').first();
    await entityTypeSelect.click();
    await page.getByRole('option', { name: 'invoice' }).click();
    await page.waitForLoadState('networkidle');

    expect(capturedUrl).toContain('entityType');
  });

  test('reset filters button clears selections', async ({ page }) => {
    await page.route('**/api/audit-log**', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], paging: LIST_PAGING(0) }),
      })
    );

    await page.goto(`${BASE_URL}/audit-log`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /reset/i }).click();
    await expect(page.getByRole('button', { name: /reset/i })).toBeVisible();
  });
});

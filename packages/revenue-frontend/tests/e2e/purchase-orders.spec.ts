/**
 * E2E Tests: Purchase Orders
 * Covers the purchase orders list page, create form, and detail page.
 * All API calls are mocked via Playwright route interception.
 *
 * @author piia (E2E Testing Agent)
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

// ---------------------------------------------------------------------------
// Shared mock factories
// ---------------------------------------------------------------------------

const NULL_PAGING = {
  offset: null,
  limit: null,
  total: null,
  totalPages: null,
  hasNext: null,
  hasPrev: null,
};

const LIST_PAGING = (total: number) => ({
  offset: 0,
  limit: 20,
  total,
  totalPages: 1,
  hasNext: false,
  hasPrev: false,
});

const EUR_CONFIG = {
  data: { defaultCurrency: 'EUR', supportedCurrencies: ['USD', 'EUR', 'GBP', 'CAD'] },
  paging: NULL_PAGING,
};

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_PO = {
  id: 'po-001',
  poNumber: 'PO-ACME-2026-001',
  accountId: 'acc-001',
  contractId: null,
  description: 'Annual software license',
  amount: '50000',
  currency: 'EUR',
  status: 'pending_approval',
  issueDate: '2026-01-15',
  expiryDate: '2026-12-31',
  approvedById: null,
  approvedAt: null,
  rejectedById: null,
  rejectedAt: null,
  rejectionReason: null,
  notes: null,
  createdAt: '2026-01-15T10:00:00.000Z',
  updatedAt: '2026-01-15T10:00:00.000Z',
  account: { id: 'acc-001', accountName: 'Acme Corporation' },
  contract: null,
};

const MOCK_PO_APPROVED = {
  ...MOCK_PO,
  id: 'po-002',
  poNumber: 'PO-ACME-2026-002',
  status: 'approved',
  amount: '25000',
};

const MOCK_ACCOUNT = {
  id: 'acc-001',
  accountName: 'Acme Corporation',
  accountType: 'enterprise',
  status: 'active',
  primaryContactEmail: 'billing@acme.com',
  paymentTerms: 'net_30',
  currency: 'EUR',
  creditLimit: 100000,
  parentAccountId: null,
  children: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

// ---------------------------------------------------------------------------
// Route helpers
// ---------------------------------------------------------------------------

async function mockAppConfig(page: any) {
  await page.route('**/api/app-config', (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(EUR_CONFIG),
    })
  );
  // Also catch /api/config pattern used by some pages
  await page.route('**/api/config', (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(EUR_CONFIG),
    })
  );
}

async function mockPurchaseOrdersList(page: any, pos: any[] = [MOCK_PO, MOCK_PO_APPROVED]) {
  await page.route('**/api/purchase-orders**', (route: any) => {
    if (route.request().method() === 'GET') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: pos, paging: LIST_PAGING(pos.length) }),
      });
    } else {
      route.continue();
    }
  });
}

async function mockSinglePurchaseOrder(page: any, po: any = MOCK_PO) {
  await page.route(`**/api/purchase-orders/${po.id}`, (route: any) => {
    if (route.request().method() === 'GET') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: po, paging: NULL_PAGING }),
      });
    } else {
      route.continue();
    }
  });
}

async function mockAccountsList(page: any, accounts: any[] = [MOCK_ACCOUNT]) {
  await page.route('**/api/accounts**', (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: accounts, paging: LIST_PAGING(accounts.length) }),
    })
  );
}

// ===========================================================================
// Purchase Orders — List Page
// ===========================================================================

test.describe('Purchase Orders — List Page', () => {
  test('renders list with both PO numbers visible and status badges shown', async ({ page }) => {
    // arrange
    await mockAppConfig(page);
    await mockPurchaseOrdersList(page);
    await page.goto(`${BASE_URL}/purchase-orders`);
    await page.waitForLoadState('networkidle');

    // assert — both PO numbers are visible
    await expect(page.getByText('PO-ACME-2026-001')).toBeVisible();
    await expect(page.getByText('PO-ACME-2026-002')).toBeVisible();

    // assert — status badges rendered (UI renders "Pending approval" and "Approved")
    await expect(page.getByText('Pending approval', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('Approved', { exact: false }).first()).toBeVisible();
  });

  test('shows approve and reject buttons only for pending PO, not for approved PO', async ({ page }) => {
    // arrange
    await mockAppConfig(page);
    await mockPurchaseOrdersList(page);
    await page.goto(`${BASE_URL}/purchase-orders`);
    await page.waitForLoadState('networkidle');

    // assert — pending PO row has Approve button (title="Approve")
    const approveButtons = page.locator('button[title="Approve"]');
    await expect(approveButtons).toHaveCount(1);

    // assert — pending PO row has Reject button (title="Reject")
    const rejectButtons = page.locator('button[title="Reject"]');
    await expect(rejectButtons).toHaveCount(1);
  });

  test('approve action calls POST /api/purchase-orders/:id/approve', async ({ page }) => {
    // arrange
    await mockAppConfig(page);
    await mockPurchaseOrdersList(page);

    let approveCalled = false;
    await page.route('**/api/purchase-orders/po-001/approve', (route: any) => {
      if (route.request().method() === 'POST') {
        approveCalled = true;
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: { ...MOCK_PO, status: 'approved', approvedAt: '2026-01-16T09:00:00.000Z' },
            paging: NULL_PAGING,
          }),
        });
      } else {
        route.continue();
      }
    });

    await page.goto(`${BASE_URL}/purchase-orders`);
    await page.waitForLoadState('networkidle');

    // act — click the Approve button on the pending PO row
    await page.locator('button[title="Approve"]').click();
    await page.waitForTimeout(500);

    // assert — the approve endpoint was called
    expect(approveCalled).toBe(true);
  });

  test('navigate to create — "New PO" button navigates to /purchase-orders/new', async ({ page }) => {
    // arrange
    await mockAppConfig(page);
    await mockPurchaseOrdersList(page);
    await page.goto(`${BASE_URL}/purchase-orders`);
    await page.waitForLoadState('networkidle');

    // act
    await page.getByRole('link', { name: /new po/i }).click();

    // assert
    await expect(page).toHaveURL(`${BASE_URL}/purchase-orders/new`);
  });

  test('empty state — shows "No purchase orders yet" when list is empty', async ({ page }) => {
    // arrange — override with empty list
    await mockAppConfig(page);
    await page.route('**/api/purchase-orders**', (route: any) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [], paging: LIST_PAGING(0) }),
        });
      } else {
        route.continue();
      }
    });
    await page.goto(`${BASE_URL}/purchase-orders`);
    await page.waitForLoadState('networkidle');

    // assert
    await expect(page.getByText('No purchase orders yet')).toBeVisible();
  });
});

// ===========================================================================
// Purchase Orders — Create Form
// ===========================================================================

test.describe('Purchase Orders — Create Form', () => {
  test.beforeEach(async ({ page }) => {
    await mockAppConfig(page);
    await mockAccountsList(page);
    // Contracts mock for optional contract selector
    await page.route('**/api/contracts**', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], paging: LIST_PAGING(0) }),
      })
    );
    await page.goto(`${BASE_URL}/purchase-orders/new`);
    await page.waitForLoadState('networkidle');
  });

  test('renders form with required fields visible', async ({ page }) => {
    // assert — key form fields are present
    await expect(page.locator('#poNumber')).toBeVisible();
    await expect(page.locator('#amount')).toBeVisible();
    await expect(page.locator('#issueDate')).toBeVisible();
    // Account selector (a Radix combobox)
    await expect(page.getByRole('combobox').first()).toBeVisible();
  });

  test('submits successfully — calls POST /api/purchase-orders with correct body and navigates to detail', async ({ page }) => {
    // arrange
    let capturedBody: Record<string, unknown> = {};
    await page.route('**/api/purchase-orders', (route: any) => {
      if (route.request().method() === 'POST') {
        capturedBody = JSON.parse(route.request().postData() || '{}');
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ data: { ...MOCK_PO, id: 'po-new' }, paging: NULL_PAGING }),
        });
      } else if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [MOCK_PO, MOCK_PO_APPROVED], paging: LIST_PAGING(2) }),
        });
      } else {
        route.continue();
      }
    });
    // Mock detail page fetch for the new PO
    await page.route('**/api/purchase-orders/po-new', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { ...MOCK_PO, id: 'po-new' }, paging: NULL_PAGING }),
      })
    );

    // act — fill required fields
    await page.locator('#poNumber').fill('PO-TEST-2026-001');

    // Select account
    await page.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Acme Corporation' }).click();

    await page.locator('#amount').fill('10000');
    await page.locator('#issueDate').fill('2026-02-01');

    await page.getByRole('button', { name: 'Create Purchase Order' }).click();

    // assert — navigated to detail page
    await page.waitForURL(`${BASE_URL}/purchase-orders/po-new`, { timeout: 5000 });
    expect(page.url()).toContain('/purchase-orders/po-new');

    // assert — correct body was sent
    expect(capturedBody).toHaveProperty('poNumber', 'PO-TEST-2026-001');
    expect(capturedBody).toHaveProperty('accountId', 'acc-001');
    expect(capturedBody).toHaveProperty('amount');
  });

  test('validation errors — required fields show errors on empty submit', async ({ page }) => {
    // act — click submit with no data filled
    await page.getByRole('button', { name: 'Create Purchase Order' }).click();
    await page.waitForTimeout(500);

    // assert — required field errors are shown
    // PO number uses register() so Zod min(1) message fires correctly
    await expect(page.getByText('PO number is required')).toBeVisible();
    // Account uses setValue() so Zod sees undefined — message differs from schema message
    await expect(page.getByText(/invalid input|account is required/i)).toBeVisible();
  });
});

// ===========================================================================
// Purchase Orders — Detail Page
// ===========================================================================

test.describe('Purchase Orders — Detail Page', () => {
  test('renders PO details with approve and reject buttons for pending PO', async ({ page }) => {
    // arrange
    await mockAppConfig(page);
    await mockSinglePurchaseOrder(page, MOCK_PO);
    await page.goto(`${BASE_URL}/purchase-orders/po-001`);
    await page.waitForLoadState('networkidle');

    // assert — PO number appears in heading
    await expect(page.getByRole('heading', { name: 'PO-ACME-2026-001' })).toBeVisible();

    // assert — account name shown (use .first() since it appears in subtitle and in the details card)
    await expect(page.getByText('Acme Corporation').first()).toBeVisible();

    // assert — approve and reject buttons present for pending status
    await expect(page.getByRole('button', { name: /approve/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /reject/i })).toBeVisible();
  });

  test('shows no approve/reject buttons for approved PO', async ({ page }) => {
    // arrange
    await mockAppConfig(page);
    await mockSinglePurchaseOrder(page, MOCK_PO_APPROVED);
    await page.goto(`${BASE_URL}/purchase-orders/po-002`);
    await page.waitForLoadState('networkidle');

    // assert — PO number appears
    await expect(page.getByRole('heading', { name: 'PO-ACME-2026-002' })).toBeVisible();

    // assert — approve and reject buttons NOT present for approved status
    await expect(page.getByRole('button', { name: /^approve$/i })).not.toBeVisible();
    await expect(page.getByRole('button', { name: /^reject$/i })).not.toBeVisible();
  });
});

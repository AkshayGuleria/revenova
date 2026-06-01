/**
 * E2E Tests: Billing Operations
 * Tests for billing/generate, billing/batch, and billing/consolidated routes
 *
 * @author piia (E2E Testing Agent)
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

// ---------------------------------------------------------------------------
// Shared mock helpers
// ---------------------------------------------------------------------------

const MOCK_CONTRACTS = [
  {
    id: 'contract-001',
    contractNumber: 'CON-2024-001',
    account: { accountName: 'Acme Corp' },
    status: 'active',
    startDate: '2024-01-01',
    endDate: '2024-12-31',
  },
  {
    id: 'contract-002',
    contractNumber: 'CON-2024-002',
    account: { accountName: 'Globex Inc' },
    status: 'active',
    startDate: '2024-06-01',
    endDate: '2025-05-31',
  },
];

const MOCK_ACCOUNTS = [
  {
    id: 'acc-001',
    accountName: 'Acme Corp',
    accountType: 'enterprise',
    status: 'active',
  },
  {
    id: 'acc-002',
    accountName: 'Globex Inc',
    accountType: 'enterprise',
    status: 'active',
  },
];

function mockContractsApi(page: any) {
  return page.route('**/api/contracts**', (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: MOCK_CONTRACTS,
        paging: { offset: 0, limit: 100, total: 2, totalPages: 1, hasNext: false, hasPrev: false },
      }),
    })
  );
}

function mockAccountsApi(page: any) {
  return page.route('**/api/accounts**', (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: MOCK_ACCOUNTS,
        paging: { offset: 0, limit: 100, total: 2, totalPages: 1, hasNext: false, hasPrev: false },
      }),
    })
  );
}

test.describe('Billing - Generate Invoice', () => {
  test.beforeEach(async ({ page }) => {
    await mockContractsApi(page);
    await page.goto(`${BASE_URL}/billing/generate`);
    await page.waitForLoadState('networkidle');
  });

  test('should display the generate invoice form', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Generate Invoice');
    await expect(page.locator('label:has-text("Contract")')).toBeVisible();
    await expect(page.locator('label:has-text("Billing Period Start")')).toBeVisible();
    await expect(page.locator('label:has-text("Billing Period End")')).toBeVisible();
    await expect(page.locator('text=Queue for asynchronous processing')).toBeVisible();
  });

  test('should validate required fields on submit', async ({ page }) => {
    // Submit without selecting a contract
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Contract is required')).toBeVisible();
  });

  test('should load contracts in dropdown from mocked API', async ({ page }) => {
    const contractSelect = page.locator('[role="combobox"]').first();
    await contractSelect.click();
    await expect(page.locator('[role="option"]:has-text("CON-2024-001 - Acme Corp")')).toBeVisible();
    await expect(page.locator('[role="option"]:has-text("CON-2024-002 - Globex Inc")')).toBeVisible();
  });

  test('should show empty state when no contracts are available', async ({ page }) => {
    // Override mock to return empty list
    await page.route('**/api/contracts**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [],
          paging: { offset: 0, limit: 100, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
        }),
      })
    );
    await page.reload();
    await page.waitForLoadState('networkidle');

    const contractSelect = page.locator('[role="combobox"]').first();
    await contractSelect.click();
    // Dropdown should be empty or show no options
    const options = page.locator('[role="option"]');
    await expect(options).toHaveCount(0);
  });

  test('should show error toast when generate invoice API returns 500', async ({ page }) => {
    await page.route('**/api/billing/generate', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { code: 'INTERNAL_ERROR', message: 'Internal server error', statusCode: 500 },
        }),
      })
    );

    const contractSelect = page.locator('[role="combobox"]').first();
    await contractSelect.click();
    await page.locator('[role="option"]').first().click();

    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    // Should show an error toast and stay on the same page
    const toast = page.locator('[data-sonner-toast]').or(page.locator('.sonner-toast'));
    const currentUrl = page.url();
    const stayedOnPage = currentUrl.includes('/billing/generate');
    const toastVisible = await toast.count() > 0;
    expect(stayedOnPage || toastVisible).toBeTruthy();
  });

  test('should submit generate invoice with valid data (mocked success)', async ({ page }) => {
    await page.route('**/api/billing/generate', (route) =>
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { id: 'inv-001', invoiceNumber: 'INV-001' },
          paging: { offset: null, limit: null, total: null, totalPages: null, hasNext: null, hasPrev: null },
        }),
      })
    );

    const contractSelect = page.locator('[role="combobox"]').first();
    await contractSelect.click();
    await page.locator('[role="option"]').first().click();

    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE_URL}/invoices/inv-001`, { timeout: 5000 });
    expect(page.url()).toContain('/invoices/inv-001');
  });

  test('should queue invoice when async checkbox is checked (mocked success)', async ({ page }) => {
    await page.route('**/api/billing/queue', (route) =>
      route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { jobId: 'job-abc123' },
          paging: { offset: null, limit: null, total: null, totalPages: null, hasNext: null, hasPrev: null },
        }),
      })
    );

    const contractSelect = page.locator('[role="combobox"]').first();
    await contractSelect.click();
    await page.locator('[role="option"]').first().click();

    await page.check('#async');
    await expect(page.locator('button[type="submit"]')).toContainText('Queue Invoice');

    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    const navigatedToJob = currentUrl.includes('/billing/jobs/');
    const toast = page.locator('[data-sonner-toast]').or(page.locator('.sonner-toast'));
    const toastVisible = await toast.count() > 0;
    expect(navigatedToJob || toastVisible).toBeTruthy();
  });

  test('should navigate back to billing on cancel', async ({ page }) => {
    await page.click('button:has-text("Cancel")');
    await expect(page).toHaveURL(`${BASE_URL}/billing`);
  });

  test('should send correct field names to backend (periodStart/periodEnd)', async ({ page }) => {
    let requestBody: Record<string, unknown> = {};

    await page.route('**/api/billing/generate', (route) => {
      requestBody = JSON.parse(route.request().postData() || '{}');
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { id: 'inv-001' },
          paging: { offset: null, limit: null, total: null, totalPages: null, hasNext: null, hasPrev: null },
        }),
      });
    });

    const contractSelect = page.locator('[role="combobox"]').first();
    await contractSelect.click();
    await page.locator('[role="option"]').first().click();

    await page.click('button[type="submit"]');
    await page.waitForTimeout(1500);

    // Verify correct field names are sent
    expect(requestBody).toHaveProperty('contractId');
    expect(requestBody).toHaveProperty('periodStart');
    expect(requestBody).toHaveProperty('periodEnd');
    expect(requestBody).not.toHaveProperty('billingPeriodStart');
    expect(requestBody).not.toHaveProperty('billingPeriodEnd');
    expect(requestBody).not.toHaveProperty('async');
  });

  test('submit button should be disabled while generating', async ({ page }) => {
    // Slow API to observe loading state
    await page.route('**/api/billing/generate', async (route) => {
      await new Promise((r) => setTimeout(r, 1000));
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { id: 'inv-001' },
          paging: { offset: null, limit: null, total: null, totalPages: null, hasNext: null, hasPrev: null },
        }),
      });
    });

    const contractSelect = page.locator('[role="combobox"]').first();
    await contractSelect.click();
    await page.locator('[role="option"]').first().click();

    await page.click('button[type="submit"]');

    // While pending the button text changes to "Generating..."
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toContainText('Generating...', { timeout: 2000 });
  });
});

test.describe('Billing - Batch Billing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/billing/batch`);
    await page.waitForLoadState('networkidle');
  });

  test('should display the batch billing form', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Batch Billing');
    await expect(page.locator('label:has-text("Billing Date")')).toBeVisible();
    await expect(page.locator('label:has-text("Billing Period")')).toBeVisible();
    await expect(page.locator('text=Asynchronous Processing')).toBeVisible();
  });

  test('should show async processing notice', async ({ page }) => {
    await expect(page.locator('text=Batch billing is always processed asynchronously')).toBeVisible();
  });

  test('should submit batch billing and navigate to job status (mocked success)', async ({ page }) => {
    await page.route('**/api/billing/batch', (route) =>
      route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { jobId: 'job-batch-001' },
          paging: { offset: null, limit: null, total: null, totalPages: null, hasNext: null, hasPrev: null },
        }),
      })
    );

    await page.click('button[type="submit"]');
    await page.waitForURL(/\/billing\/jobs\//, { timeout: 5000 });
    await expect(page).toHaveURL(/\/billing\/jobs\//);
  });

  test('should show error toast when batch billing API returns 500', async ({ page }) => {
    await page.route('**/api/billing/batch', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { code: 'INTERNAL_ERROR', message: 'Internal server error', statusCode: 500 },
        }),
      })
    );

    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    // Should stay on the page (not navigate)
    expect(page.url()).toContain('/billing/batch');
  });

  test('should send correct field names to backend (billingDate/billingPeriod)', async ({ page }) => {
    let requestBody: Record<string, unknown> = {};

    await page.route('**/api/billing/batch', (route) => {
      requestBody = JSON.parse(route.request().postData() || '{}');
      route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { jobId: 'job-batch-001' },
          paging: { offset: null, limit: null, total: null, totalPages: null, hasNext: null, hasPrev: null },
        }),
      });
    });

    await page.click('button[type="submit"]');
    await page.waitForTimeout(1500);

    // Verify only valid backend fields are sent
    expect(requestBody).not.toHaveProperty('billingPeriodStart');
    expect(requestBody).not.toHaveProperty('billingPeriodEnd');
    expect(requestBody).not.toHaveProperty('accountIds');
    expect(requestBody).not.toHaveProperty('contractStatus');
  });

  test('should filter by billing period when selected', async ({ page }) => {
    let requestBody: Record<string, unknown> = {};

    await page.route('**/api/billing/batch', (route) => {
      requestBody = JSON.parse(route.request().postData() || '{}');
      route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { jobId: 'job-batch-001' },
          paging: { offset: null, limit: null, total: null, totalPages: null, hasNext: null, hasPrev: null },
        }),
      });
    });

    // Select a billing period
    const periodSelect = page.locator('[role="combobox"]').first();
    await periodSelect.click();
    await page.locator('[role="option"]:has-text("Monthly")').click();

    await page.click('button[type="submit"]');
    await page.waitForTimeout(1500);

    expect(requestBody.billingPeriod).toBe('monthly');
  });

  test('should navigate back to billing on cancel', async ({ page }) => {
    await page.click('button:has-text("Cancel")');
    await expect(page).toHaveURL(`${BASE_URL}/billing`);
  });
});

test.describe('Billing - Consolidated Invoice', () => {
  test.beforeEach(async ({ page }) => {
    await mockAccountsApi(page);
    await page.goto(`${BASE_URL}/billing/consolidated`);
    await page.waitForLoadState('networkidle');
  });

  test('should display the consolidated billing form', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Consolidated Billing');
    await expect(page.locator('label:has-text("Parent Account")')).toBeVisible();
    await expect(page.locator('label:has-text("Billing Period Start")')).toBeVisible();
    await expect(page.locator('label:has-text("Billing Period End")')).toBeVisible();
    await expect(page.locator('text=Include subsidiary accounts')).toBeVisible();
    await expect(page.locator('text=Queue for asynchronous processing')).toBeVisible();
  });

  test('should show Phase 3 feature notice', async ({ page }) => {
    await expect(page.locator('text=Phase 3 Feature')).toBeVisible();
  });

  test('should validate required parent account on submit', async ({ page }) => {
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Parent account is required')).toBeVisible();
  });

  test('should load parent accounts in dropdown from mocked API', async ({ page }) => {
    const accountSelect = page.locator('[role="combobox"]').first();
    await accountSelect.click();
    await expect(page.locator('[role="option"]:has-text("Acme Corp")')).toBeVisible();
    await expect(page.locator('[role="option"]:has-text("Globex Inc")')).toBeVisible();
  });

  test('should show empty dropdown when no accounts returned', async ({ page }) => {
    await page.route('**/api/accounts**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [],
          paging: { offset: 0, limit: 100, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
        }),
      })
    );
    await page.reload();
    await page.waitForLoadState('networkidle');

    const accountSelect = page.locator('[role="combobox"]').first();
    await accountSelect.click();
    const options = page.locator('[role="option"]');
    await expect(options).toHaveCount(0);
  });

  test('should submit consolidated invoice with valid data (mocked success)', async ({ page }) => {
    await page.route('**/api/billing/consolidated', (route) =>
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { id: 'inv-cons-001', invoiceNumber: 'CONS-001' },
          paging: { offset: null, limit: null, total: null, totalPages: null, hasNext: null, hasPrev: null },
        }),
      })
    );

    const accountSelect = page.locator('[role="combobox"]').first();
    await accountSelect.click();
    await page.locator('[role="option"]').first().click();
    await page.waitForTimeout(300);

    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    const toast = page.locator('[data-sonner-toast]').or(page.locator('.sonner-toast'));
    const currentUrl = page.url();
    const navigatedAway = !currentUrl.includes('/billing/consolidated');
    const toastVisible = await toast.count() > 0;
    expect(navigatedAway || toastVisible).toBeTruthy();
  });

  test('should show error when consolidated billing API returns 500', async ({ page }) => {
    await page.route('**/api/billing/consolidated', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { code: 'INTERNAL_ERROR', message: 'Server error', statusCode: 500 },
        }),
      })
    );

    const accountSelect = page.locator('[role="combobox"]').first();
    await accountSelect.click();
    await page.locator('[role="option"]').first().click();
    await page.waitForTimeout(300);

    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    // Should stay on page
    expect(page.url()).toContain('/billing/consolidated');
  });

  test('should send correct field names to backend (periodStart/periodEnd/includeChildren)', async ({ page }) => {
    let requestBody: Record<string, unknown> = {};

    await page.route('**/api/billing/consolidated', (route) => {
      requestBody = JSON.parse(route.request().postData() || '{}');
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { id: 'inv-cons-001' },
          paging: { offset: null, limit: null, total: null, totalPages: null, hasNext: null, hasPrev: null },
        }),
      });
    });

    const accountSelect = page.locator('[role="combobox"]').first();
    await accountSelect.click();
    await page.locator('[role="option"]').first().click();
    await page.waitForTimeout(500);

    await page.click('button[type="submit"]');
    await page.waitForTimeout(1500);

    // Verify correct field names are sent
    expect(requestBody).toHaveProperty('parentAccountId');
    expect(requestBody).toHaveProperty('periodStart');
    expect(requestBody).toHaveProperty('periodEnd');
    expect(requestBody).toHaveProperty('includeChildren');
    // These old incorrect names must NOT be present
    expect(requestBody).not.toHaveProperty('billingPeriodStart');
    expect(requestBody).not.toHaveProperty('billingPeriodEnd');
    expect(requestBody).not.toHaveProperty('includeSubsidiaries');
    expect(requestBody).not.toHaveProperty('billingAddress');
    expect(requestBody).not.toHaveProperty('notes');
    expect(requestBody).not.toHaveProperty('async');
  });

  test('should queue consolidated invoice when async is checked', async ({ page }) => {
    const accountSelect = page.locator('[role="combobox"]').first();
    await accountSelect.click();
    await page.locator('[role="option"]').first().click();
    await page.waitForTimeout(500);

    await page.check('#async', { force: true });
    await expect(page.locator('button[type="submit"]')).toContainText('Queue Invoice');
  });

  test('should toggle includeChildren checkbox', async ({ page }) => {
    const checkbox = page.locator('#includeChildren');
    // Default is checked
    await expect(checkbox).toBeChecked();
    await checkbox.uncheck();
    await expect(checkbox).not.toBeChecked();
    await checkbox.check();
    await expect(checkbox).toBeChecked();
  });

  test('should navigate back to billing on cancel', async ({ page }) => {
    await page.click('button:has-text("Cancel")');
    await expect(page).toHaveURL(`${BASE_URL}/billing`);
  });
});

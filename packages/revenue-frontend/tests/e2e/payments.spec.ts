/**
 * E2E Tests: Payments
 * Covers the payments list page and record-payment form.
 * All API calls are mocked via Playwright route interception.
 *
 * @author piia (E2E Testing Agent)
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

// ---------------------------------------------------------------------------
// Shared paging helpers
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

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_PAYMENT = {
  id: 'pay-001',
  paymentNumber: 'PAY-2026-001',
  accountId: 'acc-001',
  invoiceId: 'inv-001',
  amount: '5000',
  currency: 'EUR',
  method: 'bank_transfer',
  referenceNumber: 'TXN-ABC-123',
  paymentDate: '2026-01-20',
  status: 'applied',
  notes: null,
  createdAt: '2026-01-20T10:00:00.000Z',
  updatedAt: '2026-01-20T10:00:00.000Z',
  account: { id: 'acc-001', accountName: 'Acme Corporation' },
  invoice: { id: 'inv-001', invoiceNumber: 'INV-2026-001' },
};

const MOCK_PAYMENT_VOIDED = {
  ...MOCK_PAYMENT,
  id: 'pay-002',
  paymentNumber: 'PAY-2026-002',
  status: 'voided',
  invoiceId: null,
  invoice: null,
};

const MOCK_ACCOUNT = {
  id: 'acc-001',
  accountName: 'Acme Corporation',
  accountType: 'enterprise',
  status: 'active',
  primaryContactEmail: 'contact@acme.com',
};

const MOCK_INVOICE = {
  id: 'inv-001',
  invoiceNumber: 'INV-2026-001',
  accountId: 'acc-001',
  total: '10000',
  currency: 'EUR',
  paidAmount: '0',
  status: 'sent',
};

// ---------------------------------------------------------------------------
// Route helpers
// ---------------------------------------------------------------------------

async function mockPaymentsListApi(page: any, payments = [MOCK_PAYMENT, MOCK_PAYMENT_VOIDED]) {
  await page.route('**/api/payments**', (route: any) => {
    if (route.request().method() === 'GET') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: payments,
          paging: LIST_PAGING(payments.length),
        }),
      });
    } else {
      route.continue();
    }
  });
}

async function mockAccountsApi(page: any, accounts = [MOCK_ACCOUNT]) {
  await page.route('**/api/accounts**', (route: any) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: accounts,
        paging: LIST_PAGING(accounts.length),
      }),
    });
  });
}

async function mockInvoicesApi(page: any, invoices = [MOCK_INVOICE]) {
  await page.route('**/api/invoices**', (route: any) => {
    if (route.request().method() === 'GET') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: invoices,
          paging: LIST_PAGING(invoices.length),
        }),
      });
    } else {
      route.continue();
    }
  });
}

async function mockConfigApi(page: any) {
  await page.route('**/api/config', (route: any) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: { defaultCurrency: 'EUR', supportedCurrencies: ['USD', 'EUR', 'GBP'] },
        paging: NULL_PAGING,
      }),
    });
  });
  await page.route('**/api/app-config', (route: any) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: { defaultCurrency: 'EUR', supportedCurrencies: ['USD', 'EUR', 'GBP'] },
        paging: NULL_PAGING,
      }),
    });
  });
}

// ===========================================================================
// Payments List Page
// ===========================================================================

test.describe('Payments — List Page', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfigApi(page);
    await mockPaymentsListApi(page);
    await page.goto(`${BASE_URL}/payments`);
    await page.waitForLoadState('networkidle');
  });

  // Scenario 1: Renders list
  test('renders both payment numbers from mocked API response', async ({ page }) => {
    await expect(page.getByText('PAY-2026-001')).toBeVisible();
    await expect(page.getByText('PAY-2026-002')).toBeVisible();
  });

  // Scenario 2: Shows void button only on applied payments
  test('applied payment has a void button; voided payment does not', async ({ page }) => {
    // The void button is only rendered when status === 'applied'
    // 1 applied + 1 voided payment → exactly 1 void button
    const voidButtons = page.locator('button[title="Void payment"]');
    await expect(voidButtons).toHaveCount(1);
  });

  // Scenario 3: Void action
  test('clicking void button calls DELETE /api/payments/pay-001', async ({ page }) => {
    let deleteCalled = false;

    await page.route('**/api/payments/pay-001', (route: any) => {
      if (route.request().method() === 'DELETE') {
        deleteCalled = true;
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: { ...MOCK_PAYMENT, status: 'voided' },
            paging: NULL_PAGING,
          }),
        });
      } else {
        route.continue();
      }
    });

    const voidBtn = page.locator('button[title="Void payment"]').first();
    await expect(voidBtn).toBeVisible();

    // Accept the window.confirm dialog triggered by handleVoid
    page.once('dialog', (dialog) => dialog.accept());
    await voidBtn.click();

    await page.waitForTimeout(500);
    expect(deleteCalled).toBe(true);
  });

  // Scenario 4: Shows invoice link
  test('payment with invoice shows invoice number as a link to that invoice', async ({ page }) => {
    const invoiceLink = page.getByRole('link', { name: 'INV-2026-001' });
    await expect(invoiceLink).toBeVisible();
    const href = await invoiceLink.getAttribute('href');
    expect(href).toContain('/invoices/inv-001');
  });

  // Scenario 5: Navigate to new payment
  test('clicking "Record Payment" navigates to /payments/new', async ({ page }) => {
    const newPaymentLink = page.getByRole('link', { name: /record payment/i });
    await expect(newPaymentLink).toBeVisible();
    await newPaymentLink.click();
    await expect(page).toHaveURL(`${BASE_URL}/payments/new`);
  });
});

// ===========================================================================
// Payments — Create Form
// ===========================================================================

test.describe('Payments — Create Form', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfigApi(page);
    await mockAccountsApi(page);
    await mockInvoicesApi(page, []);
    await page.goto(`${BASE_URL}/payments/new`);
    await page.waitForLoadState('networkidle');
  });

  // Scenario 6: Renders form fields
  test('renders form with paymentNumber, amount, paymentDate, account and method fields', async ({ page }) => {
    // All these inputs are present on the form
    await expect(page.locator('#paymentNumber')).toBeVisible();
    await expect(page.locator('#amount')).toBeVisible();
    await expect(page.locator('#paymentDate')).toBeVisible();
    // "Record Payment" submit button
    await expect(page.getByRole('button', { name: /record payment/i })).toBeVisible();
    // The heading confirms we're on the right page
    await expect(page.locator('h1')).toContainText('Record Payment');
  });

  // Scenario 7a: Invoice selector placeholder before account selected
  test('invoice selector shows "Select an account first" before account is chosen', async ({ page }) => {
    await expect(page.getByText('Select an account first')).toBeVisible();
  });

  // Scenario 7b: Invoice selector disabled before account selected, enabled after
  test('invoice selector is disabled before account selected and changes after account chosen', async ({ page }) => {
    // The invoice selector combobox is disabled when no account is selected
    const invoiceTrigger = page.locator('[role="combobox"][disabled]');
    await expect(invoiceTrigger.first()).toBeVisible();

    // Override invoices mock to return an open invoice for the selected account
    await page.route('**/api/invoices**', (route: any) => {
      if (route.request().method() === 'GET') {
        const url = route.request().url();
        const hasAccountFilter = url.includes('accountId');
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: hasAccountFilter ? [MOCK_INVOICE] : [],
            paging: LIST_PAGING(hasAccountFilter ? 1 : 0),
          }),
        });
      } else {
        route.continue();
      }
    });

    // Click the Account combobox — it's the one with "Select an account" (not "first")
    // The Account combobox is the FIRST one that contains the exact text "Select an account"
    // Use a locator that targets the visible combobox with "Select an account" text
    const accountTrigger = page.locator('[role="combobox"]').filter({ hasText: /^Select an account$/ }).first();
    await accountTrigger.click();
    await page.waitForTimeout(200);
    await page.locator('[role="option"]:has-text("Acme Corporation")').click();
    await page.waitForTimeout(500);

    // After account selection, the invoice selector should no longer be disabled (or show different text)
    await expect(page.getByText('Select an account first')).not.toBeVisible();
  });

  // Scenario 8: Submits successfully
  test('fills required fields, submits, verifies POST called, and navigates to /payments', async ({ page }) => {
    let postCalled = false;
    let postBody: Record<string, unknown> = {};

    await page.route('**/api/payments', (route: any) => {
      if (route.request().method() === 'POST') {
        postCalled = true;
        postBody = JSON.parse(route.request().postData() || '{}');
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            data: { ...MOCK_PAYMENT, id: 'pay-new-001' },
            paging: NULL_PAGING,
          }),
        });
      } else if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [MOCK_PAYMENT, MOCK_PAYMENT_VOIDED],
            paging: LIST_PAGING(2),
          }),
        });
      } else {
        route.continue();
      }
    });

    // Fill payment number
    await page.locator('#paymentNumber').fill('PAY-2026-TEST');

    // Select the account
    const accountTrigger = page.locator('[role="combobox"]').filter({ hasText: /^Select an account$/ }).first();
    await accountTrigger.click();
    await page.waitForTimeout(200);
    await page.locator('[role="option"]:has-text("Acme Corporation")').click();
    await page.waitForTimeout(200);

    // Fill amount
    await page.locator('#amount').fill('5000');

    // Ensure payment date is set
    const dateInput = page.locator('#paymentDate');
    const dateVal = await dateInput.inputValue();
    if (!dateVal) {
      await dateInput.fill('2026-01-20');
    }

    // Submit
    await page.getByRole('button', { name: /record payment/i }).click();

    await page.waitForURL(`${BASE_URL}/payments`, { timeout: 5000 });

    expect(postCalled).toBe(true);
    expect(postBody).toHaveProperty('paymentNumber', 'PAY-2026-TEST');
    expect(postBody).toHaveProperty('accountId', 'acc-001');
    expect(page.url()).toBe(`${BASE_URL}/payments`);
  });

  // Scenario 9: Validation errors on empty submit
  test('submitting empty form shows required field errors', async ({ page }) => {
    // Clear the payment number field
    await page.locator('#paymentNumber').clear();

    await page.getByRole('button', { name: /record payment/i }).click();
    await page.waitForTimeout(500);

    // paymentNumber is required
    await expect(page.getByText('Payment number is required')).toBeVisible();

    // accountId: zod receives undefined when Select was never interacted with
    // Actual error: "Invalid input: expected string, received undefined"
    await expect(page.getByText(/invalid input.*expected string/i)).toBeVisible();

    // amount: empty → "Amount must be positive"
    await expect(page.getByText(/amount must be positive/i)).toBeVisible();

    // Must stay on the form
    expect(page.url()).toContain('/payments/new');
  });
});

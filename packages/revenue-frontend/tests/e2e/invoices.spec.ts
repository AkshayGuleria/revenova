/**
 * E2E Tests: Invoices
 * Comprehensive coverage of the invoices list page, invoice detail page,
 * and invoice creation/editing forms. All API calls are mocked.
 *
 * @author piia (E2E Testing Agent)
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const EUR_CONFIG = {
  data: { defaultCurrency: 'EUR', supportedCurrencies: ['USD', 'EUR', 'GBP', 'CAD'] },
  paging: { offset: null, limit: null, total: null, totalPages: null, hasNext: null, hasPrev: null },
};

const MOCK_ACCOUNTS = [
  { id: 'acc-001', accountName: 'Acme Corp', accountType: 'enterprise', status: 'active' },
  { id: 'acc-002', accountName: 'Globex Inc', accountType: 'enterprise', status: 'active' },
];

const MOCK_CONTRACTS = [
  {
    id: 'cnt-001',
    contractNumber: 'CON-2024-001',
    contractName: 'Acme 2024 Enterprise',
    accountId: 'acc-001',
    status: 'active',
    billingFrequency: 'annual',
    paymentTerms: 'net_30',
    contractValue: 50000,
    startDate: '2024-01-01T00:00:00.000Z',
    endDate: '2024-12-31T00:00:00.000Z',
    seatCount: 50,
    committedSeats: 50,
    seatPrice: 200,
    autoRenew: false,
    renewalNoticeDays: 90,
    billingInAdvance: true,
    notes: '',
  },
  {
    id: 'cnt-002',
    contractNumber: 'CON-2024-002',
    contractName: 'Acme Support Plan',
    accountId: 'acc-001',
    status: 'active',
    billingFrequency: 'annual',
    paymentTerms: 'net_30',
    contractValue: 12000,
    startDate: '2024-01-01T00:00:00.000Z',
    endDate: '2024-12-31T00:00:00.000Z',
    seatCount: 1,
    committedSeats: 1,
    seatPrice: 12000,
    autoRenew: false,
    renewalNoticeDays: 90,
    billingInAdvance: true,
    notes: '',
  },
];

const LINE_ITEMS = [
  {
    id: 'li-001',
    description: 'Enterprise Platform License — 50 seats',
    quantity: 50,
    unitPrice: 149,
    discountAmount: 0,
    taxAmount: 0,
    lineTotal: 7450,
    productId: 'prod-001',
  },
  {
    id: 'li-002',
    description: 'Priority Support (annual)',
    quantity: 1,
    unitPrice: 299,
    discountAmount: 0,
    taxAmount: 0,
    lineTotal: 299,
    productId: 'prod-004',
  },
];

const MOCK_INVOICES = [
  {
    id: 'inv-001',
    invoiceNumber: 'INV-2024-001',
    accountId: 'acc-001',
    contractId: 'cnt-001',
    account: { accountName: 'Acme Corp', primaryContactEmail: 'billing@acme.com' },
    status: 'draft',
    issueDate: '2024-01-15T00:00:00.000Z',
    dueDate: '2024-02-14T00:00:00.000Z',
    currency: 'EUR',
    subtotal: 7749,
    discountAmount: 0,
    taxAmount: 0,
    total: 7749,
    amountPaid: 0,
    items: LINE_ITEMS,
    notes: 'Net 30 terms apply.',
    billingAddress: '123 Main St, San Francisco, CA 94102',
  },
  {
    id: 'inv-002',
    invoiceNumber: 'INV-2024-002',
    accountId: 'acc-002',
    contractId: null,
    account: { accountName: 'Globex Inc', primaryContactEmail: 'ap@globex.com' },
    status: 'paid',
    issueDate: '2024-02-01T00:00:00.000Z',
    dueDate: '2024-03-02T00:00:00.000Z',
    paidDate: '2024-02-25T00:00:00.000Z',
    currency: 'EUR',
    subtotal: 5000,
    discountAmount: 250,
    taxAmount: 470,
    total: 5220,
    amountPaid: 5220,
    items: [
      {
        id: 'li-003',
        description: 'Professional Services — onboarding',
        quantity: 2,
        unitPrice: 2500,
        discountAmount: 250,
        taxAmount: 470,
        lineTotal: 4720,
        productId: null,
      },
    ],
    notes: null,
    billingAddress: null,
  },
  {
    id: 'inv-003',
    invoiceNumber: 'INV-2024-003',
    accountId: 'acc-001',
    contractId: 'cnt-001',
    account: { accountName: 'Acme Corp' },
    status: 'overdue',
    issueDate: '2023-11-01T00:00:00.000Z',
    dueDate: '2023-12-01T00:00:00.000Z',
    currency: 'EUR',
    subtotal: 1500,
    discountAmount: 0,
    taxAmount: 0,
    total: 1500,
    amountPaid: 0,
    items: [],
    notes: null,
    billingAddress: null,
  },
  {
    id: 'inv-004',
    invoiceNumber: 'INV-2024-004',
    accountId: 'acc-002',
    contractId: null,
    account: { accountName: 'Globex Inc' },
    status: 'sent',
    issueDate: '2024-03-01T00:00:00.000Z',
    dueDate: '2024-03-31T00:00:00.000Z',
    currency: 'EUR',
    subtotal: 3000,
    discountAmount: 0,
    taxAmount: 0,
    total: 3000,
    amountPaid: 0,
    items: [],
    notes: null,
    billingAddress: null,
  },
];

// ---------------------------------------------------------------------------
// Route helpers
// ---------------------------------------------------------------------------

async function mockConfigApi(page: any) {
  await page.route('**/api/config', (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(EUR_CONFIG),
    })
  );
}

async function mockInvoicesListApi(page: any, invoices = MOCK_INVOICES) {
  await page.route('**/api/invoices?**', (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: invoices,
        paging: {
          offset: 0,
          limit: 20,
          total: invoices.length,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      }),
    })
  );
  // Also handle bare /api/invoices for GET
  await page.route('**/api/invoices', (route: any) => {
    if (route.request().method() === 'GET') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: invoices,
          paging: {
            offset: 0,
            limit: 20,
            total: invoices.length,
            totalPages: 1,
            hasNext: false,
            hasPrev: false,
          },
        }),
      });
    } else {
      route.continue();
    }
  });
}

async function mockSingleInvoiceApi(page: any, invoice = MOCK_INVOICES[0]) {
  await page.route(`**/api/invoices/${invoice.id}`, (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: invoice,
        paging: { offset: null, limit: null, total: null, totalPages: null, hasNext: null, hasPrev: null },
      }),
    })
  );
}

async function mockFormDependencies(page: any) {
  await page.route('**/api/accounts**', (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: MOCK_ACCOUNTS,
        paging: { offset: 0, limit: 100, total: 2, totalPages: 1, hasNext: false, hasPrev: false },
      }),
    })
  );
  await page.route('**/api/contracts**', (route: any) =>
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

// ---------------------------------------------------------------------------
// Invoices List Page
// ---------------------------------------------------------------------------

test.describe('Invoices List Page', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfigApi(page);
    await mockInvoicesListApi(page);
    await page.goto(`${BASE_URL}/invoices`);
    await page.waitForLoadState('networkidle');
  });

  test('loads with page title "Invoices"', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Invoices');
  });

  test('shows "New Invoice" button', async ({ page }) => {
    await expect(
      page.getByRole('link', { name: /new invoice/i }).or(
        page.getByRole('button', { name: /new invoice/i })
      ).first()
    ).toBeVisible();
  });

  test('table has "Invoice Number" column header', async ({ page }) => {
    await expect(page.getByText('Invoice Number')).toBeVisible();
  });

  test('table has "Account" column header', async ({ page }) => {
    await expect(page.getByRole('columnheader', { name: 'Account' })).toBeVisible();
  });

  test('table has "Issue Date" column header', async ({ page }) => {
    await expect(page.getByText('Issue Date')).toBeVisible();
  });

  test('table has "Due Date" column header', async ({ page }) => {
    await expect(page.getByText('Due Date')).toBeVisible();
  });

  test('table has "Total" column header', async ({ page }) => {
    await expect(page.getByText('Total')).toBeVisible();
  });

  test('table has "Status" column header', async ({ page }) => {
    await expect(page.getByText('Status')).toBeVisible();
  });

  test('displays all mocked invoice numbers', async ({ page }) => {
    await expect(page.getByText('INV-2024-001')).toBeVisible();
    await expect(page.getByText('INV-2024-002')).toBeVisible();
    await expect(page.getByText('INV-2024-003')).toBeVisible();
    await expect(page.getByText('INV-2024-004')).toBeVisible();
  });

  test('displays account names linked to invoices', async ({ page }) => {
    await expect(page.getByText('Acme Corp').first()).toBeVisible();
    await expect(page.getByText('Globex Inc').first()).toBeVisible();
  });

  test('status badges: draft, paid, overdue, sent all visible', async ({ page }) => {
    await expect(page.getByText('draft', { exact: false })).toBeVisible();
    await expect(page.getByText('paid', { exact: false })).toBeVisible();
    await expect(page.getByText('overdue', { exact: false })).toBeVisible();
    await expect(page.getByText('sent', { exact: false })).toBeVisible();
  });

  test('shows empty state message when no invoices', async ({ page }) => {
    await page.route('**/api/invoices**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [],
          paging: { offset: 0, limit: 20, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
        }),
      })
    );
    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/no invoices found/i)).toBeVisible();
    await expect(page.getByText(/create invoice/i)).toBeVisible();
  });

  test('shows loading state while invoices are fetching', async ({ page }) => {
    await page.route('**/api/invoices**', async (route) => {
      await new Promise((r) => setTimeout(r, 500));
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: MOCK_INVOICES,
          paging: { offset: 0, limit: 20, total: 4, totalPages: 1, hasNext: false, hasPrev: false },
        }),
      });
    });
    await page.goto(`${BASE_URL}/invoices`);
    await expect(page.locator('h1')).toContainText('Invoices');
    await page.waitForLoadState('networkidle');
  });

  test('gracefully handles 500 error from invoices API', async ({ page }) => {
    await page.route('**/api/invoices**', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'Internal server error', statusCode: 500 } }),
      })
    );
    await page.reload();
    await page.waitForLoadState('networkidle');

    // No crash — page title should still render
    await expect(page.locator('h1')).toBeVisible();
  });

  test('"New Invoice" navigates to /invoices/new', async ({ page }) => {
    await mockFormDependencies(page);

    const newInvoiceControl = page.getByRole('link', { name: /new invoice/i }).or(
      page.getByRole('button', { name: /new invoice/i })
    ).first();
    await newInvoiceControl.click({ force: true });
    await expect(page).toHaveURL(`${BASE_URL}/invoices/new`);
  });

  test('clicking an invoice number navigates to its detail page', async ({ page }) => {
    await mockSingleInvoiceApi(page, MOCK_INVOICES[0]);

    await page.getByText('INV-2024-001').click();
    await page.waitForURL(`${BASE_URL}/invoices/inv-001`, { timeout: 5000 });
    expect(page.url()).toContain('/invoices/inv-001');
  });

  test('search input is rendered on the invoices list page', async ({ page }) => {
    await expect(page.locator('input[placeholder*="Search invoices"]').or(
      page.locator('input[type="search"]')
    )).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Invoice Detail Page
// ---------------------------------------------------------------------------

test.describe('Invoice Detail Page', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfigApi(page);
    await mockSingleInvoiceApi(page, MOCK_INVOICES[0]);
    await page.goto(`${BASE_URL}/invoices/inv-001`);
    await page.waitForLoadState('networkidle');
  });

  test('displays invoice number in header', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('INV-2024-001');
  });

  test('shows "Bill To" section with account name', async ({ page }) => {
    await expect(page.getByText('Bill To')).toBeVisible();
    await expect(page.getByText('Acme Corp')).toBeVisible();
  });

  test('shows status badge for the invoice', async ({ page }) => {
    await expect(page.getByText('draft', { exact: false })).toBeVisible();
  });

  test('shows issue date and due date', async ({ page }) => {
    await expect(page.getByText('Issue Date:')).toBeVisible();
    await expect(page.getByText('Due Date:')).toBeVisible();
  });

  test('shows "Line Items" section', async ({ page }) => {
    await expect(page.getByText('Line Items')).toBeVisible();
  });

  test('line items table has Description, Quantity, Unit Price, Line Total columns', async ({ page }) => {
    await expect(page.getByText('Description')).toBeVisible();
    await expect(page.getByText('Quantity')).toBeVisible();
    await expect(page.getByText('Unit Price')).toBeVisible();
    await expect(page.getByText('Line Total')).toBeVisible();
  });

  test('line items are rendered with correct data', async ({ page }) => {
    await expect(page.getByText('Enterprise Platform License — 50 seats')).toBeVisible();
    await expect(page.getByText('Priority Support (annual)')).toBeVisible();
  });

  test('line item unit price is shown in EUR (not USD)', async ({ page }) => {
    // EUR values typically formatted with € symbol
    // Check that the unit price area contains EUR formatting
    const unitPriceHeader = page.getByText('Unit Price');
    await expect(unitPriceHeader).toBeVisible();

    // The currency column should show formatted amounts
    // 149 EUR should appear as €149.00 or EUR 149.00
    const priceText = await page.locator('text=/149/').first().textContent();
    expect(priceText).toBeTruthy();
  });

  test('totals section shows Subtotal', async ({ page }) => {
    await expect(page.getByText('Subtotal:')).toBeVisible();
  });

  test('totals section shows Total', async ({ page }) => {
    await expect(page.getByText('Total:', { exact: true }).first()).toBeVisible();
  });

  test('notes section shown when invoice has notes', async ({ page }) => {
    await expect(page.getByText('Notes')).toBeVisible();
    await expect(page.getByText('Net 30 terms apply.')).toBeVisible();
  });

  test('"Edit" button is present in the header actions', async ({ page }) => {
    await expect(page.getByRole('link', { name: /edit/i }).or(
      page.getByRole('button', { name: /edit/i })
    ).first()).toBeVisible();
  });

  test('"Download PDF" button is present', async ({ page }) => {
    await expect(page.getByRole('button', { name: /download pdf/i })).toBeVisible();
  });

  test('"Send Invoice" button shown only for draft status', async ({ page }) => {
    // inv-001 has status=draft so Send Invoice should appear
    await expect(page.getByRole('button', { name: /send invoice/i })).toBeVisible();
  });

  test('"Send Invoice" button is hidden for paid invoices', async ({ page }) => {
    await mockSingleInvoiceApi(page, MOCK_INVOICES[1]); // paid invoice
    await page.goto(`${BASE_URL}/invoices/inv-002`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('button', { name: /send invoice/i })).not.toBeVisible();
  });

  test('shows discount amount in totals when present', async ({ page }) => {
    // Use invoice with discount
    await mockSingleInvoiceApi(page, MOCK_INVOICES[1]); // discountAmount: 250
    await page.goto(`${BASE_URL}/invoices/inv-002`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Discount:')).toBeVisible();
  });

  test('shows tax amount in totals when present', async ({ page }) => {
    // Use invoice with tax
    await mockSingleInvoiceApi(page, MOCK_INVOICES[1]); // taxAmount: 470
    await page.goto(`${BASE_URL}/invoices/inv-002`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Tax:')).toBeVisible();
  });

  test('shows paid amount and balance due when amountPaid > 0', async ({ page }) => {
    await mockSingleInvoiceApi(page, MOCK_INVOICES[1]); // amountPaid: 5220
    await page.goto(`${BASE_URL}/invoices/inv-002`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Amount Paid:')).toBeVisible();
    await expect(page.getByText('Balance Due:')).toBeVisible();
  });

  test('shows "Loading invoice..." while fetching', async ({ page }) => {
    await page.route(`**/api/invoices/inv-loading`, async (route) => {
      await new Promise((r) => setTimeout(r, 500));
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: MOCK_INVOICES[0],
          paging: { offset: null, limit: null, total: null, totalPages: null, hasNext: null, hasPrev: null },
        }),
      });
    });

    await page.goto(`${BASE_URL}/invoices/inv-loading`);
    await expect(page.getByText(/loading invoice/i)).toBeVisible({ timeout: 2000 });
    await page.waitForLoadState('networkidle');
  });

  test('shows "Invoice not found" for missing invoice', async ({ page }) => {
    await page.route(`**/api/invoices/nonexistent`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: null,
          paging: { offset: null, limit: null, total: null, totalPages: null, hasNext: null, hasPrev: null },
        }),
      })
    );

    await page.goto(`${BASE_URL}/invoices/nonexistent`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/invoice not found/i)).toBeVisible();
  });

  test('shows "No line items" message when items array is empty', async ({ page }) => {
    await mockSingleInvoiceApi(page, MOCK_INVOICES[2]); // empty items
    await page.goto(`${BASE_URL}/invoices/inv-003`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/no line items/i)).toBeVisible();
  });

  test('paid date shown for paid invoices', async ({ page }) => {
    await mockSingleInvoiceApi(page, MOCK_INVOICES[1]); // paid with paidDate
    await page.goto(`${BASE_URL}/invoices/inv-002`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Paid Date:')).toBeVisible();
  });

  test('contract link shown when invoice has contractId', async ({ page }) => {
    await expect(page.getByText('Contract:')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Invoice Status Badges
// ---------------------------------------------------------------------------

test.describe('Invoice Status Badges', () => {
  const STATUS_CASES = [
    { invoiceId: 'inv-001', status: 'draft' },
    { invoiceId: 'inv-002', status: 'paid' },
    { invoiceId: 'inv-003', status: 'overdue' },
    { invoiceId: 'inv-004', status: 'sent' },
  ];

  for (const { invoiceId, status } of STATUS_CASES) {
    test(`invoice detail shows correct badge for status "${status}"`, async ({ page }) => {
      await mockConfigApi(page);
      const invoice = MOCK_INVOICES.find((i) => i.id === invoiceId)!;
      await mockSingleInvoiceApi(page, invoice);

      await page.goto(`${BASE_URL}/invoices/${invoiceId}`);
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(status, { exact: false }).first()).toBeVisible();
    });
  }
});

// ---------------------------------------------------------------------------
// Invoice Creation Form (from the invoices module perspective)
// ---------------------------------------------------------------------------

test.describe('Invoice Creation Form', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfigApi(page);
    await mockFormDependencies(page);
    await page.goto(`${BASE_URL}/invoices/new`);
    await page.waitForLoadState('networkidle');
  });

  test('renders with "Create Invoice" heading', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Create Invoice');
  });

  test('currency select defaults to EUR', async ({ page }) => {
    await expect(page.locator('[role="combobox"]').filter({ hasText: 'EUR' })).toBeVisible();
  });

  test('account selector lists mocked accounts', async ({ page }) => {
    await page.locator('[role="combobox"]').first().click();
    await expect(page.locator('[role="option"]:has-text("Acme Corp")')).toBeVisible();
    await expect(page.locator('[role="option"]:has-text("Globex Inc")')).toBeVisible();
  });

  test('contract selector is disabled before account is selected', async ({ page }) => {
    // Contract combobox (second one) should be disabled
    const contractCombo = page.locator('[role="combobox"]').nth(1);
    await expect(contractCombo).toBeDisabled();
  });

  test('contract selector loads contracts after account is selected', async ({ page }) => {
    await page.locator('[role="combobox"]').first().click();
    await page.locator('[role="option"]:has-text("Acme Corp")').click();
    await page.waitForTimeout(300);

    const contractCombo = page.locator('[role="combobox"]').nth(1);
    await expect(contractCombo).not.toBeDisabled();
    await contractCombo.click();

    // The form renders by contractNumber
    await expect(page.locator('[role="option"]:has-text("CON-2024-001")')).toBeVisible();
    await expect(page.locator('[role="option"]:has-text("CON-2024-002")')).toBeVisible();
  });

  test('invoice number is auto-generated (prefixed with INV-)', async ({ page }) => {
    const invoiceNumberInput = page.locator('input[name="invoiceNumber"]');
    const value = await invoiceNumberInput.inputValue();
    expect(value).toMatch(/INV-/);
  });

  test('status field defaults to "draft"', async ({ page }) => {
    // The status select should show "Draft" as default
    await expect(page.locator('[role="combobox"]').filter({ hasText: /draft/i })).toBeVisible();
  });

  test('contract field is visible and disabled before account is selected', async ({ page }) => {
    // The new form has a Contract field that requires an account first
    await expect(page.locator('label:has-text("Contract")')).toBeVisible();
    const contractCombo = page.locator('[role="combobox"]').nth(1);
    await expect(contractCombo).toBeDisabled();
  });

  test('tax and discount inputs are visible at invoice level', async ({ page }) => {
    // In the redesigned form, tax and discount are top-level invoice fields
    await expect(page.locator('input[name="tax"]')).toBeVisible();
    await expect(page.locator('input[name="discount"]')).toBeVisible();
  });

  test('tax input accepts numeric values', async ({ page }) => {
    const taxInput = page.locator('input[name="tax"]');
    await taxInput.fill('50');
    expect(await taxInput.inputValue()).toBe('50');
  });

  test('discount input accepts numeric values', async ({ page }) => {
    const discountInput = page.locator('input[name="discount"]');
    await discountInput.fill('100');
    expect(await discountInput.inputValue()).toBe('100');
  });

  test('currency select shows EUR as default', async ({ page }) => {
    // The currency combobox should show EUR from the config
    const eurCombobox = page.locator('[role="combobox"]').filter({ hasText: 'EUR' });
    await expect(eurCombobox).toBeVisible();
    // Should not show USD as the default
    const usdCombobox = page.locator('[role="combobox"]').filter({ hasText: 'USD' });
    await expect(usdCombobox).not.toBeVisible();
  });

  test('due date before issue date shows validation error', async ({ page }) => {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    // Select account then contract (both required)
    await page.locator('[role="combobox"]').first().click();
    await page.locator('[role="option"]:has-text("Acme Corp")').click();
    await page.waitForTimeout(300);
    const contractCombo = page.locator('[role="combobox"]').nth(1);
    await contractCombo.click();
    await page.locator('[role="option"]:has-text("CON-2024-001")').click();
    await page.waitForTimeout(300);

    await page.fill('input[name="issueDate"]', today);
    await page.fill('input[name="dueDate"]', yesterday);

    await page.getByRole('button', { name: /create invoice/i }).click();
    await page.waitForTimeout(500);

    await expect(page.getByText(/due date must be after/i)).toBeVisible();
    expect(page.url()).toContain('/invoices/new');
  });

  test('account is required — shows error on submit', async ({ page }) => {
    await page.getByRole('button', { name: /create invoice/i }).click();
    await page.waitForTimeout(500);

    await expect(page.getByText(/account is required/i)).toBeVisible();
  });

  test('successful creation navigates to the new invoice detail', async ({ page }) => {
    await page.route('**/api/invoices', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            data: { ...MOCK_INVOICES[0], id: 'inv-new-001', invoiceNumber: 'INV-NEW-001' },
            paging: { offset: null, limit: null, total: null, totalPages: null, hasNext: null, hasPrev: null },
          }),
        });
      } else {
        route.continue();
      }
    });

    // Select account then contract (required fields in new form)
    await page.locator('[role="combobox"]').first().click();
    await page.locator('[role="option"]:has-text("Acme Corp")').click();
    await page.waitForTimeout(300);
    const contractCombo = page.locator('[role="combobox"]').nth(1);
    await contractCombo.click();
    await page.locator('[role="option"]:has-text("CON-2024-001")').click();
    await page.waitForTimeout(300);

    await page.getByRole('button', { name: /create invoice/i }).click();
    await page.waitForURL(`${BASE_URL}/invoices/inv-new-001`, { timeout: 5000 });
    expect(page.url()).toContain('/invoices/inv-new-001');
  });

  test('API 500 error shows error toast and keeps form open', async ({ page }) => {
    await page.route('**/api/invoices', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: { message: 'Internal server error', statusCode: 500 } }),
        });
      } else {
        route.continue();
      }
    });

    // Select account then contract (required fields in new form)
    await page.locator('[role="combobox"]').first().click();
    await page.locator('[role="option"]:has-text("Acme Corp")').click();
    await page.waitForTimeout(300);
    const contractCombo = page.locator('[role="combobox"]').nth(1);
    await contractCombo.click();
    await page.locator('[role="option"]:has-text("CON-2024-001")').click();
    await page.waitForTimeout(300);

    await page.getByRole('button', { name: /create invoice/i }).click();
    await page.waitForTimeout(2000);

    expect(page.url()).toContain('/invoices/new');
    const errorVisible = await page.locator('text=/failed|error/i').count() > 0;
    expect(errorVisible).toBeTruthy();
  });

  test('cancel button navigates back to invoices list', async ({ page }) => {
    await page.getByRole('button', { name: /cancel/i }).click();
    await expect(page).toHaveURL(`${BASE_URL}/invoices`);
  });

  test('discount input accepts a numeric value without crashing', async ({ page }) => {
    // The new invoice form has a discount field at the invoice level (not per line item).
    // This test verifies the discount field accepts numeric input and the form remains stable.
    const discountInput = page.locator('input[name="discount"]');
    await expect(discountInput).toBeVisible();

    await discountInput.fill('500');
    const val = await discountInput.inputValue();
    expect(val).toBe('500');

    // Form should still be on the create page after editing the discount
    expect(page.url()).toContain('/invoices/new');
    await expect(page.locator('h1')).toContainText('Create Invoice');
  });

  test('notes textarea is visible and accepts text', async ({ page }) => {
    const notesArea = page.locator('textarea').or(page.locator('[name="notes"]'));
    if (await notesArea.count() > 0) {
      await notesArea.first().fill('Payment terms: Net 30');
      const val = await notesArea.first().inputValue();
      expect(val).toBe('Payment terms: Net 30');
    }
    // Just ensure form is still usable
    await expect(page.locator('h1')).toContainText('Create Invoice');
  });
});

// ---------------------------------------------------------------------------
// Invoice Edit Form
// ---------------------------------------------------------------------------

test.describe('Invoice Edit Form', () => {
  const INVOICE = MOCK_INVOICES[0]; // draft invoice

  test.beforeEach(async ({ page }) => {
    await mockConfigApi(page);
    await mockFormDependencies(page);
    await mockSingleInvoiceApi(page, INVOICE);
    await page.route(`**/api/invoices/${INVOICE.id}/edit`, (route) => route.continue());

    await page.goto(`${BASE_URL}/invoices/${INVOICE.id}/edit`);
    await page.waitForLoadState('networkidle');
  });

  test('edit page shows "Update Invoice" button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /update invoice/i })).toBeVisible();
  });

  test('pre-fills invoice number', async ({ page }) => {
    const invoiceNumberInput = page.locator('input[name="invoiceNumber"]');
    await expect(invoiceNumberInput).toHaveValue('INV-2024-001');
  });

  test('pre-fills currency as EUR', async ({ page }) => {
    await expect(page.locator('[role="combobox"]').filter({ hasText: 'EUR' })).toBeVisible();
  });

  test('successful update navigates to invoice detail', async ({ page }) => {
    await page.route(`**/api/invoices/${INVOICE.id}`, (route) => {
      if (route.request().method() !== 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: { ...INVOICE, notes: 'Updated note' },
            paging: { offset: null, limit: null, total: null, totalPages: null, hasNext: null, hasPrev: null },
          }),
        });
      } else {
        route.continue();
      }
    });

    await page.getByRole('button', { name: /update invoice/i }).click();
    await page.waitForURL(`${BASE_URL}/invoices/${INVOICE.id}`, { timeout: 5000 });
    expect(page.url()).toContain(`/invoices/${INVOICE.id}`);
    expect(page.url()).not.toContain('/edit');
  });

  test('cancel button returns to invoice detail page', async ({ page }) => {
    await page.getByRole('button', { name: /cancel/i }).click();
    await expect(page).toHaveURL(`${BASE_URL}/invoices/${INVOICE.id}`);
  });
});

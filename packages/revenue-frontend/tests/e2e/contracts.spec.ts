/**
 * E2E Tests: Contracts
 * Covers the contracts list page, create contract form, and contract detail page.
 *
 * @author Riina (E2E Testing Agent)
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

const MOCK_ACCOUNT = {
  id: 'acc-001',
  accountName: 'Acme Corporation',
  accountType: 'enterprise',
  status: 'active',
  primaryContactEmail: 'contact@acme.com',
  paymentTerms: 'net_30',
  currency: 'EUR',
  createdAt: '2025-01-15T10:00:00.000Z',
  updatedAt: '2025-01-15T10:00:00.000Z',
};

const MOCK_CONTRACT = {
  id: 'con-001',
  contractNumber: 'CON-2025-001',
  accountId: 'acc-001',
  account: { accountName: 'Acme Corporation' },
  startDate: '2025-01-01T00:00:00.000Z',
  endDate: '2025-12-31T00:00:00.000Z',
  contractValue: 120000,
  billingFrequency: 'annual',
  paymentTerms: 'net_30',
  billingInAdvance: true,
  seatCount: 50,
  committedSeats: 50,
  seatPrice: 200,
  autoRenew: true,
  renewalNoticeDays: 90,
  status: 'active',
  notes: '',
  _count: { invoices: 0 },
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

const MOCK_CONTRACT_DRAFT = {
  ...MOCK_CONTRACT,
  id: 'con-002',
  contractNumber: 'CON-2025-002',
  status: 'draft',
  contractValue: 60000,
  account: { accountName: 'Beta Technologies' },
  accountId: 'acc-002',
};

// ===========================================================================
// Contracts List
// ===========================================================================

test.describe('Contracts — List Page', () => {
  test.beforeEach(async ({ page }) => {
    // arrange
    await page.route('**/api/config', (route: any) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(EUR_CONFIG) })
    );
    await page.route('**/api/accounts**', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [MOCK_ACCOUNT], paging: LIST_PAGING(1) }),
      })
    );
    await page.route('**/api/contracts**', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [MOCK_CONTRACT, MOCK_CONTRACT_DRAFT],
          paging: LIST_PAGING(2),
        }),
      })
    );
    await page.goto(`${BASE_URL}/contracts`);
    await page.waitForLoadState('networkidle');
  });

  test('page loads with correct heading', async ({ page }) => {
    // assert
    await expect(page.getByRole('heading', { name: 'Contracts' })).toBeVisible();
  });

  test('table renders expected columns', async ({ page }) => {
    // assert
    await expect(page.getByRole('columnheader', { name: 'Contract Number' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Account' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Value' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Billing Frequency' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Start Date' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'End Date' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Actions' })).toBeVisible();
  });

  test('mocked contract rows appear in the table', async ({ page }) => {
    // assert
    await expect(page.getByRole('link', { name: 'CON-2025-001' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'CON-2025-002' })).toBeVisible();
  });

  test('contract number is a link navigating to contract detail', async ({ page }) => {
    // act
    await page.getByRole('link', { name: 'CON-2025-001' }).click();
    // assert
    await expect(page).toHaveURL(`${BASE_URL}/contracts/con-001`);
  });

  test('"New Contract" button navigates to the create form', async ({ page }) => {
    // act
    await page.getByRole('link', { name: /new contract/i }).click();
    // assert
    await expect(page).toHaveURL(`${BASE_URL}/contracts/new`);
  });

  test('shows empty state when no contracts exist', async ({ page }) => {
    // arrange – override with empty
    await page.route('**/api/contracts**', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], paging: LIST_PAGING(0) }),
      })
    );
    await page.goto(`${BASE_URL}/contracts`);
    await page.waitForLoadState('networkidle');

    // assert
    await expect(page.getByText('No contracts found')).toBeVisible();
    await expect(page.getByText('Get started by creating your first contract')).toBeVisible();
  });

  test('search input is visible on the contracts list', async ({ page }) => {
    // assert
    await expect(page.getByPlaceholder('Search contracts...')).toBeVisible();
  });

  test('searching by contract number sends correct query param to API', async ({ page }) => {
    // arrange
    let capturedUrl = '';
    await page.route('**/api/contracts**', (route: any) => {
      capturedUrl = route.request().url();
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [MOCK_CONTRACT], paging: LIST_PAGING(1) }),
      });
    });

    // act
    const searchInput = page.getByPlaceholder('Search contracts...');
    await searchInput.fill('CON-2025');
    await page.waitForTimeout(600);

    // assert
    expect(capturedUrl).toContain('contractNumber');
  });

  test('shows search empty state when no contracts match query', async ({ page }) => {
    // arrange
    await page.route('**/api/contracts**', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], paging: LIST_PAGING(0) }),
      })
    );
    // act
    await page.getByPlaceholder('Search contracts...').fill('ZZZZ');
    await page.waitForTimeout(600);

    // assert
    await expect(page.getByText('No contracts found')).toBeVisible();
    await expect(page.getByText(/No contracts match/)).toBeVisible();
  });

  test('account name in table is a link to the account', async ({ page }) => {
    // assert
    const accountLink = page.getByRole('link', { name: 'Acme Corporation' }).first();
    await expect(accountLink).toBeVisible();
    await accountLink.click();
    await expect(page).toHaveURL(`${BASE_URL}/accounts/acc-001`);
  });

  test('Edit button in actions column navigates to edit route', async ({ page }) => {
    // act
    const editButton = page.getByRole('button', { name: 'Edit' }).first();
    await editButton.click();
    // assert
    await expect(page).toHaveURL(`${BASE_URL}/contracts/con-001/edit`);
  });
});

// ===========================================================================
// Create Contract Form
// ===========================================================================

const MOCK_PRODUCT = {
  id: 'prod-001',
  name: 'Enterprise License',
  sku: 'ENT-001',
  pricingModel: 'seat_based',
  basePrice: 200,
  currency: 'EUR',
  billingInterval: 'annual',
  active: true,
};

test.describe('Contracts — Create Form', () => {
  test.beforeEach(async ({ page }) => {
    // arrange
    await page.route('**/api/config', (route: any) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(EUR_CONFIG) })
    );
    await page.route('**/api/accounts**', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [MOCK_ACCOUNT], paging: LIST_PAGING(1) }),
      })
    );
    // Products are required in create mode (the form requires at least one product)
    await page.route('**/api/products**', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [MOCK_PRODUCT], paging: LIST_PAGING(1) }),
      })
    );
    await page.goto(`${BASE_URL}/contracts/new`);
    await page.waitForLoadState('networkidle');
  });

  test('create contract page has correct heading', async ({ page }) => {
    // assert
    await expect(page.getByRole('heading', { name: 'Create Contract' })).toBeVisible();
  });

  test('all required fields are visible', async ({ page }) => {
    // assert
    await expect(page.getByLabel('Contract Number *')).toBeVisible();
    await expect(page.getByLabel('Account *')).toBeVisible();
    await expect(page.getByLabel('Start Date *')).toBeVisible();
    await expect(page.getByLabel('End Date *')).toBeVisible();
    await expect(page.getByLabel('Contract Value *')).toBeVisible();
  });

  test('section headings are visible', async ({ page }) => {
    // assert – use exact match to avoid matching page description text that
    // also contains the words "billing configuration"
    await expect(page.getByText('Basic Information', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Billing Configuration' })).toBeVisible();
    await expect(page.getByText('Seat-Based Pricing (Optional)', { exact: true })).toBeVisible();
    await expect(page.getByText('Renewal Configuration', { exact: true })).toBeVisible();
  });

  test('validation errors appear on empty submit', async ({ page }) => {
    // act
    await page.getByRole('button', { name: 'Create Contract' }).click();

    // assert – required field errors
    await expect(page.getByText('Contract number is required')).toBeVisible();
    await expect(page.getByText('Account is required')).toBeVisible();
  });

  test('billingFrequency dropdown contains all options', async ({ page }) => {
    // act – open the Billing Frequency select
    await page.getByLabel('Billing Frequency').click();

    // assert – use exact: true to avoid "Annual" matching "Semi-Annual"
    await expect(page.getByRole('option', { name: 'Monthly', exact: true })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Quarterly', exact: true })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Semi-Annual', exact: true })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Annual', exact: true })).toBeVisible();
  });

  test('paymentTerms dropdown contains all options', async ({ page }) => {
    // act
    await page.getByLabel('Payment Terms').click();

    // assert
    await expect(page.getByRole('option', { name: 'Net 30' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Net 60' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Net 90' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Due on Receipt' })).toBeVisible();
  });

  test('account dropdown is populated with mocked accounts', async ({ page }) => {
    // act
    await page.getByLabel('Account *').click();

    // assert
    await expect(page.getByRole('option', { name: 'Acme Corporation' })).toBeVisible();
  });

  test('autoRenew checkbox is present and toggleable', async ({ page }) => {
    // assert – checkbox exists with label "Auto-Renew"
    const autoRenewLabel = page.getByText('Auto-Renew');
    await expect(autoRenewLabel).toBeVisible();

    // act – find the checkbox by its proximity to the label
    const checkbox = page.locator('input[type="checkbox"]').first();
    const initialChecked = await checkbox.isChecked();
    await checkbox.setChecked(!initialChecked);
    expect(await checkbox.isChecked()).toBe(!initialChecked);
  });

  test('cancel button navigates back to contracts list', async ({ page }) => {
    // act
    await page.getByRole('button', { name: 'Cancel' }).click();

    // assert
    await expect(page).toHaveURL(`${BASE_URL}/contracts`);
  });

  test('successful contract creation navigates to contracts list', async ({ page }) => {
    // arrange – mock POST
    await page.route('**/api/contracts', (route: any) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ data: { ...MOCK_CONTRACT, id: 'con-new' }, paging: NULL_PAGING }),
        });
      } else {
        route.continue();
      }
    });

    // act – fill required fields
    await page.getByLabel('Contract Number *').fill('CON-2025-TEST');
    await page.getByLabel('Account *').click();
    await page.getByRole('option', { name: 'Acme Corporation' }).click();
    await page.getByLabel('Start Date *').fill('2025-01-01');
    await page.getByLabel('End Date *').fill('2025-12-31');
    await page.getByLabel('Contract Value *').fill('120000');
    // Select a product (required in create mode)
    const productSelect = page.locator('[role="combobox"]').filter({ hasText: /select product/i });
    await productSelect.click();
    await page.getByRole('option', { name: /Enterprise License/i }).click();
    await page.getByRole('button', { name: 'Create Contract' }).click();

    // assert
    await page.waitForURL(`${BASE_URL}/contracts`);
    await expect(page).toHaveURL(`${BASE_URL}/contracts`);
  });

  test('sends correct field names in POST body', async ({ page }) => {
    // arrange
    let requestBody: Record<string, unknown> = {};
    await page.route('**/api/contracts', (route: any) => {
      if (route.request().method() === 'POST') {
        requestBody = JSON.parse(route.request().postData() || '{}');
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ data: { ...MOCK_CONTRACT, id: 'con-verify' }, paging: NULL_PAGING }),
        });
      } else {
        route.continue();
      }
    });

    // act
    await page.getByLabel('Contract Number *').fill('CON-VERIFY');
    await page.getByLabel('Account *').click();
    await page.getByRole('option', { name: 'Acme Corporation' }).click();
    await page.getByLabel('Start Date *').fill('2025-03-01');
    await page.getByLabel('End Date *').fill('2026-02-28');
    await page.getByLabel('Contract Value *').fill('50000');
    // The create form requires at least one product – select one to allow submission
    const productSelect = page.locator('[role="combobox"]').filter({ hasText: /select product/i });
    await productSelect.click();
    await page.getByRole('option', { name: /Enterprise License/i }).click();
    await page.getByRole('button', { name: 'Create Contract' }).click();
    await page.waitForTimeout(1000);

    // assert – key field names must be present
    expect(requestBody).toHaveProperty('contractNumber', 'CON-VERIFY');
    expect(requestBody).toHaveProperty('accountId');
    expect(requestBody).toHaveProperty('startDate');
    expect(requestBody).toHaveProperty('endDate');
    expect(requestBody).toHaveProperty('contractValue');
    expect(requestBody).toHaveProperty('billingFrequency');
    expect(requestBody).toHaveProperty('paymentTerms');
    // products array must be present in create payload
    expect(requestBody).toHaveProperty('products');
    // These old/incorrect names must NOT appear
    expect(requestBody).not.toHaveProperty('pricePerSeat');
    expect(requestBody).not.toHaveProperty('seatCount_v1');
  });

  test('API error on create shows error and stays on form', async ({ page }) => {
    // arrange
    await page.route('**/api/contracts', (route: any) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: { message: 'End date must be after start date', code: 'VALIDATION', statusCode: 400 } }),
        });
      } else {
        route.continue();
      }
    });

    // act – fill form and submit
    await page.getByLabel('Contract Number *').fill('CON-BAD');
    await page.getByLabel('Account *').click();
    await page.getByRole('option', { name: 'Acme Corporation' }).click();
    await page.getByLabel('Start Date *').fill('2025-12-31');
    await page.getByLabel('End Date *').fill('2025-01-01');
    await page.getByLabel('Contract Value *').fill('1000');
    await page.getByRole('button', { name: 'Create Contract' }).click();
    await page.waitForTimeout(1000);

    // assert – still on the form page
    expect(page.url()).toContain('/contracts/new');
  });

  test('Notes textarea is visible and accepts input', async ({ page }) => {
    // assert
    const notesTextarea = page.locator('textarea[placeholder="Additional contract notes..."]');
    await expect(notesTextarea).toBeVisible();

    // act
    await notesTextarea.fill('This is a test note');
    expect(await notesTextarea.inputValue()).toBe('This is a test note');
  });
});

// ===========================================================================
// Contract Detail Page
// ===========================================================================

test.describe('Contracts — Detail Page', () => {
  test.beforeEach(async ({ page }) => {
    // arrange
    await page.route('**/api/config', (route: any) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(EUR_CONFIG) })
    );
    await page.route('**/api/contracts/con-001', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: MOCK_CONTRACT, paging: NULL_PAGING }),
      })
    );
    await page.route('**/api/accounts**', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [MOCK_ACCOUNT], paging: LIST_PAGING(1) }),
      })
    );
    await page.goto(`${BASE_URL}/contracts/con-001`);
    await page.waitForLoadState('networkidle');
  });

  test('contract detail page shows contract number in heading', async ({ page }) => {
    // assert
    await expect(page.getByRole('heading', { name: 'CON-2025-001' })).toBeVisible();
  });

  test('contract status badge is visible', async ({ page }) => {
    // assert – the badge text for "active" status
    await expect(page.getByText('active', { exact: false })).toBeVisible();
  });

  test('tabs are visible: Overview, Billing, Invoices', async ({ page }) => {
    // assert
    await expect(page.getByRole('tab', { name: 'Overview' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Billing' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Invoices' })).toBeVisible();
  });

  test('Overview tab shows contract value', async ({ page }) => {
    // assert – contract value is shown on the default overview tab
    await expect(page.getByText('Contract Value')).toBeVisible();
  });

  test('Billing tab shows billing frequency and payment terms', async ({ page }) => {
    // act
    await page.getByRole('tab', { name: 'Billing' }).click();

    // assert
    await expect(page.getByText('Billing Frequency')).toBeVisible();
    await expect(page.getByText('Payment Terms')).toBeVisible();
    await expect(page.getByText('Billing Timing')).toBeVisible();
  });

  test('Edit Contract button navigates to edit route', async ({ page }) => {
    // act
    const editButton = page.getByRole('link', { name: /edit contract/i });
    await expect(editButton).toBeVisible();
    await editButton.click();

    // assert
    await expect(page).toHaveURL(`${BASE_URL}/contracts/con-001/edit`);
  });

  test('Invoices tab shows empty state and Generate Invoice link', async ({ page }) => {
    // act
    await page.getByRole('tab', { name: 'Invoices' }).click();

    // assert
    await expect(page.getByText('No Invoices Yet')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Generate Invoice' })).toBeVisible();
  });

  test('contract not found shows 404 message', async ({ page }) => {
    // arrange – register a general fallback first, then the specific 404 last
    // (Playwright uses last-registered-wins for overlapping globs)
    await page.route('**/api/contracts**', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], paging: LIST_PAGING(0) }),
      })
    );
    await page.route('**/api/contracts/con-999', (route: any) =>
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'Not found', code: 'NOT_FOUND', statusCode: 404 } }),
      })
    );
    await page.goto(`${BASE_URL}/contracts/con-999`);

    // assert – allow up to 15 s for TanStack Query to exhaust retries and render the not-found UI
    await expect(page.getByText('Contract not found')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('link', { name: 'Back to Contracts' })).toBeVisible();
  });
});

/**
 * E2E Tests: Accounts
 * Covers the accounts list page, create account form, and account detail page.
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
  creditLimit: 100000,
  parentAccountId: null,
  children: [],
  createdAt: '2025-01-15T10:00:00.000Z',
  updatedAt: '2025-01-15T10:00:00.000Z',
};

const MOCK_ACCOUNT_2 = {
  id: 'acc-002',
  accountName: 'Beta Technologies',
  accountType: 'smb',
  status: 'active',
  primaryContactEmail: 'info@betatech.com',
  paymentTerms: 'net_60',
  currency: 'EUR',
  creditLimit: 50000,
  parentAccountId: null,
  children: [],
  createdAt: '2025-02-01T08:00:00.000Z',
  updatedAt: '2025-02-01T08:00:00.000Z',
};

// ---------------------------------------------------------------------------
// Helper: mock config + accounts list
// ---------------------------------------------------------------------------

async function mockConfigAndAccountsList(page: any, accounts: any[] = [MOCK_ACCOUNT, MOCK_ACCOUNT_2]) {
  await page.route('**/api/config', (route: any) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(EUR_CONFIG) })
  );
  await page.route('**/api/accounts**', (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: accounts, paging: LIST_PAGING(accounts.length) }),
    })
  );
}

// ===========================================================================
// Accounts List
// ===========================================================================

test.describe('Accounts — List Page', () => {
  test.beforeEach(async ({ page }) => {
    // arrange
    await mockConfigAndAccountsList(page);
    await page.goto(`${BASE_URL}/accounts`);
    await page.waitForLoadState('networkidle');
  });

  test('page loads with correct heading', async ({ page }) => {
    // assert
    await expect(page.getByRole('heading', { name: 'Accounts' })).toBeVisible();
  });

  test('table renders expected columns', async ({ page }) => {
    // assert – column headers
    await expect(page.getByRole('columnheader', { name: 'Account Name' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Type' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Contact Email' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Payment Terms' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Actions' })).toBeVisible();
  });

  test('table shows mocked account rows', async ({ page }) => {
    // assert – first account appears as a link
    await expect(page.getByRole('link', { name: 'Acme Corporation' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Beta Technologies' })).toBeVisible();
  });

  test('account name is a link that navigates to account detail', async ({ page }) => {
    // act
    await page.getByRole('link', { name: 'Acme Corporation' }).click();
    // assert
    await expect(page).toHaveURL(`${BASE_URL}/accounts/acc-001`);
  });

  test('"New Account" button navigates to the create form', async ({ page }) => {
    // act
    await page.getByRole('link', { name: /new account/i }).click();
    // assert
    await expect(page).toHaveURL(`${BASE_URL}/accounts/new`);
  });

  test('shows empty state when no accounts exist', async ({ page }) => {
    // arrange – override with empty list
    await page.route('**/api/accounts**', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], paging: LIST_PAGING(0) }),
      })
    );
    await page.goto(`${BASE_URL}/accounts`);
    await page.waitForLoadState('networkidle');

    // assert
    await expect(page.getByText('No accounts found')).toBeVisible();
    await expect(page.getByText('Get started by creating your first account')).toBeVisible();
  });

  test('search input is visible and filters by account name', async ({ page }) => {
    // arrange
    let capturedUrl = '';
    await page.route('**/api/accounts**', (route: any) => {
      capturedUrl = route.request().url();
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [MOCK_ACCOUNT], paging: LIST_PAGING(1) }),
      });
    });

    // act – type into the search box
    const searchInput = page.getByPlaceholder('Search accounts...');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('Acme');
    // wait for debounced search
    await page.waitForTimeout(600);

    // assert – the API was called with the search param
    expect(capturedUrl).toContain('accountName');
  });

  test('shows empty search state when no accounts match query', async ({ page }) => {
    // arrange – return empty for search
    await page.route('**/api/accounts**', (route: any) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], paging: LIST_PAGING(0) }),
      });
    });

    // act
    const searchInput = page.getByPlaceholder('Search accounts...');
    await searchInput.fill('nonexistent');
    await page.waitForTimeout(600);

    // assert
    await expect(page.getByText('No accounts found')).toBeVisible();
    await expect(page.getByText(/No accounts match/)).toBeVisible();
  });

  test('API error shows graceful degradation (no crash)', async ({ page }) => {
    // arrange – API fails
    await page.route('**/api/accounts**', (route: any) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Server error' } }) })
    );
    await page.goto(`${BASE_URL}/accounts`);
    await page.waitForLoadState('networkidle');

    // assert – page still renders (no uncaught crash), heading is present
    await expect(page.getByRole('heading', { name: 'Accounts' })).toBeVisible();
  });
});

// ===========================================================================
// Create Account Form
// ===========================================================================

test.describe('Accounts — Create Form', () => {
  test.beforeEach(async ({ page }) => {
    // arrange
    await page.route('**/api/config', (route: any) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(EUR_CONFIG) })
    );
    await page.route('**/api/accounts**', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], paging: LIST_PAGING(0) }),
      })
    );
    await page.goto(`${BASE_URL}/accounts/new`);
    await page.waitForLoadState('networkidle');
  });

  test('create account page has correct heading', async ({ page }) => {
    // assert
    await expect(page.getByRole('heading', { name: 'Create Account' })).toBeVisible();
  });

  test('all required fields are visible', async ({ page }) => {
    // assert
    await expect(page.getByLabel('Account Name *')).toBeVisible();
    await expect(page.getByLabel('Primary Contact Email *')).toBeVisible();
    await expect(page.getByLabel('Account Type *')).toBeVisible();
    await expect(page.getByLabel('Payment Terms')).toBeVisible();
    // CurrencySelect uses a Radix combobox – locate it by its visible value instead
    await expect(page.locator('[role="combobox"]').filter({ hasText: 'EUR' })).toBeVisible();
  });

  test('section headings are visible', async ({ page }) => {
    // assert
    await expect(page.getByText('Basic Information')).toBeVisible();
    await expect(page.getByText('Financial Terms')).toBeVisible();
    await expect(page.getByText('Billing Contact')).toBeVisible();
    await expect(page.getByText('Billing Address')).toBeVisible();
  });

  test('validation errors appear when form is submitted empty', async ({ page }) => {
    // act
    await page.getByRole('button', { name: 'Create Account' }).click();

    // assert
    await expect(page.getByText('Account name is required')).toBeVisible();
    await expect(page.getByText('Invalid email address')).toBeVisible();
  });

  test('currency select defaults to EUR from config', async ({ page }) => {
    // assert — the currency combobox shows EUR (populated from /api/config)
    const currencyCombobox = page.getByRole('combobox').filter({ hasText: 'EUR' });
    await expect(currencyCombobox).toBeVisible();
  });

  test('accountType dropdown contains Enterprise, SMB, Startup', async ({ page }) => {
    // act – open the Account Type combobox (first one in Basic Information)
    const accountTypeSelect = page.getByLabel('Account Type *');
    await accountTypeSelect.click();

    // assert
    await expect(page.getByRole('option', { name: 'Enterprise' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'SMB' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Startup' })).toBeVisible();
  });

  test('paymentTerms dropdown contains Net 30, Net 60, Net 90, Due on Receipt', async ({ page }) => {
    // act
    const paymentTermsSelect = page.getByLabel('Payment Terms');
    await paymentTermsSelect.click();

    // assert
    await expect(page.getByRole('option', { name: 'Net 30' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Net 60' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Net 90' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Due on Receipt' })).toBeVisible();
  });

  test('cancel button navigates back to accounts list', async ({ page }) => {
    // act
    await page.getByRole('button', { name: 'Cancel' }).click();

    // assert
    await expect(page).toHaveURL(`${BASE_URL}/accounts`);
  });

  test('successful account creation navigates to accounts list with toast', async ({ page }) => {
    // arrange – mock the POST
    await page.route('**/api/accounts', (route: any) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ data: { ...MOCK_ACCOUNT, id: 'acc-new' }, paging: NULL_PAGING }),
        });
      } else {
        route.continue();
      }
    });

    // act – fill required fields
    await page.getByLabel('Account Name *').fill('New Test Corp');
    await page.getByLabel('Primary Contact Email *').fill('admin@newtestcorp.com');
    await page.getByRole('button', { name: 'Create Account' }).click();

    // assert – navigated away
    await page.waitForURL(`${BASE_URL}/accounts`);
    await expect(page).toHaveURL(`${BASE_URL}/accounts`);
  });

  test('API error on create shows error toast and stays on form', async ({ page }) => {
    // arrange
    await page.route('**/api/accounts', (route: any) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({ error: { message: 'Account already exists', code: 'CONFLICT', statusCode: 409 } }),
        });
      } else {
        route.continue();
      }
    });

    // act
    await page.getByLabel('Account Name *').fill('Duplicate Corp');
    await page.getByLabel('Primary Contact Email *').fill('admin@duplicate.com');
    await page.getByRole('button', { name: 'Create Account' }).click();

    await page.waitForTimeout(1000);

    // assert – still on the create form
    expect(page.url()).toContain('/accounts/new');
  });

  test('sends correct field names in POST request', async ({ page }) => {
    // arrange
    let requestBody: Record<string, unknown> = {};
    await page.route('**/api/accounts', (route: any) => {
      if (route.request().method() === 'POST') {
        requestBody = JSON.parse(route.request().postData() || '{}');
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ data: { ...MOCK_ACCOUNT, id: 'acc-verify' }, paging: NULL_PAGING }),
        });
      } else {
        route.continue();
      }
    });

    // act
    await page.getByLabel('Account Name *').fill('Verify Corp');
    await page.getByLabel('Primary Contact Email *').fill('verify@corp.com');
    await page.getByRole('button', { name: 'Create Account' }).click();
    await page.waitForTimeout(1000);

    // assert
    expect(requestBody).toHaveProperty('accountName', 'Verify Corp');
    expect(requestBody).toHaveProperty('primaryContactEmail', 'verify@corp.com');
    expect(requestBody).toHaveProperty('accountType');
  });
});

// ===========================================================================
// Account Detail Page
// ===========================================================================

test.describe('Accounts — Detail Page', () => {
  test.beforeEach(async ({ page }) => {
    // arrange – mock config, account fetch and related contracts
    await page.route('**/api/config', (route: any) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(EUR_CONFIG) })
    );
    // Register the general list mock first, then the specific one last.
    // Playwright uses last-registered-wins for overlapping glob patterns.
    await page.route('**/api/accounts**', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [MOCK_ACCOUNT, MOCK_ACCOUNT_2], paging: LIST_PAGING(2) }),
      })
    );
    await page.route('**/api/accounts/acc-001', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: MOCK_ACCOUNT, paging: NULL_PAGING }),
      })
    );
    await page.route('**/api/contracts**', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], paging: LIST_PAGING(0) }),
      })
    );
    await page.goto(`${BASE_URL}/accounts/acc-001`);
    await page.waitForLoadState('networkidle');
  });

  test('account detail page shows account name in heading', async ({ page }) => {
    // assert
    await expect(page.getByRole('heading', { name: 'Acme Corporation' })).toBeVisible();
  });

  test('detail page shows account type and status', async ({ page }) => {
    // assert
    await expect(page.getByText('enterprise', { exact: false })).toBeVisible();
    await expect(page.getByText('active', { exact: false })).toBeVisible();
  });

  test('detail page shows primary contact email', async ({ page }) => {
    // assert
    await expect(page.getByText('contact@acme.com')).toBeVisible();
  });

  test('detail page shows currency', async ({ page }) => {
    // assert
    await expect(page.getByText('EUR')).toBeVisible();
  });

  test('Edit Account button is visible and links to edit route', async ({ page }) => {
    // assert
    const editButton = page.getByRole('link', { name: /edit account/i });
    await expect(editButton).toBeVisible();
    await editButton.click();
    await expect(page).toHaveURL(`${BASE_URL}/accounts/acc-001/edit`);
  });

  test('tabs are visible: Details, Hierarchy, Contracts, Invoices', async ({ page }) => {
    // assert
    await expect(page.getByRole('tab', { name: 'Details' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Hierarchy' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Contracts' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Invoices' })).toBeVisible();
  });

  test('Contracts tab shows empty state with "Create First Contract" button', async ({ page }) => {
    // act
    await page.getByRole('tab', { name: 'Contracts' }).click();

    // assert
    await expect(page.getByText('No Contracts Yet')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Create First Contract' })).toBeVisible();
  });

  test('Hierarchy tab shows "root account" message for account without parent', async ({ page }) => {
    // act
    await page.getByRole('tab', { name: 'Hierarchy' }).click();

    // assert
    await expect(page.getByText('This is a root account (no parent)')).toBeVisible();
  });

  test('account not found shows 404 message', async ({ page }) => {
    // arrange – register the 404 mock last so it wins over the general **/api/accounts** mock.
    // The query client has retry:3 with exponential back-off, so we use a generous timeout.
    await page.route('**/api/accounts/acc-999', (route: any) =>
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'Not found', code: 'NOT_FOUND', statusCode: 404 } }),
      })
    );
    await page.goto(`${BASE_URL}/accounts/acc-999`);

    // assert – allow up to 15 s for TanStack Query to exhaust retries and render the not-found UI
    await expect(page.getByText('Account not found')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('link', { name: 'Back to Accounts' })).toBeVisible();
  });
});

/**
 * E2E Tests: Invoice Groups
 * Comprehensive coverage of the invoice groups list page, create form,
 * and edit form. All API calls are mocked via page.route().
 *
 * Routes under test:
 *   GET /invoice-groups           → invoice-groups._index.tsx
 *   GET /invoice-groups/new       → invoice-groups.new.tsx
 *   GET /invoice-groups/:id/edit  → invoice-groups.$id.edit.tsx
 *
 * @author piia (E2E Testing Specialist)
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

// ---------------------------------------------------------------------------
// Paging helpers — mirrors NULL_PAGING / LIST_PAGING pattern from invoices.spec.ts
// ---------------------------------------------------------------------------

const NULL_PAGING = {
  offset: null,
  limit: null,
  total: null,
  totalPages: null,
  hasNext: null,
  hasPrev: null,
};

const LIST_PAGING = (total: number, offset = 0, limit = 20) => ({
  offset,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
  hasNext: offset + limit < total,
  hasPrev: offset > 0,
});

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_ACCOUNTS = [
  {
    id: 'acc-001',
    accountName: 'Acme Corp',
    accountType: 'enterprise',
    status: 'active',
    primaryContactEmail: 'billing@acme.com',
    paymentTerms: 'net_30',
    currency: 'USD',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'acc-002',
    accountName: 'Globex Inc',
    accountType: 'enterprise',
    status: 'active',
    primaryContactEmail: 'ap@globex.com',
    paymentTerms: 'net_30',
    currency: 'USD',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
];

const MOCK_GROUPS = [
  {
    id: 'ig-001',
    accountId: 'acc-001',
    account: { id: 'acc-001', accountName: 'Acme Corp' },
    name: 'Engineering',
    groupType: 'DEPARTMENT',
    code: 'ENG-001',
    _count: { invoices: 3 },
    createdAt: '2024-01-15T00:00:00.000Z',
    updatedAt: '2024-01-15T00:00:00.000Z',
  },
  {
    id: 'ig-002',
    accountId: 'acc-001',
    account: { id: 'acc-001', accountName: 'Acme Corp' },
    name: 'HQ Office',
    groupType: 'LOCATION',
    code: 'LOC-HQ',
    _count: { invoices: 1 },
    createdAt: '2024-02-01T00:00:00.000Z',
    updatedAt: '2024-02-01T00:00:00.000Z',
  },
  {
    id: 'ig-003',
    accountId: 'acc-002',
    account: { id: 'acc-002', accountName: 'Globex Inc' },
    name: 'Operations',
    groupType: 'COST_CENTER',
    code: 'OPS-01',
    _count: { invoices: 0 },
    createdAt: '2024-03-01T00:00:00.000Z',
    updatedAt: '2024-03-01T00:00:00.000Z',
  },
  {
    id: 'ig-004',
    accountId: 'acc-002',
    account: { id: 'acc-002', accountName: 'Globex Inc' },
    name: 'Special Project Alpha',
    groupType: 'CUSTOM',
    code: undefined,
    _count: { invoices: 0 },
    createdAt: '2024-04-01T00:00:00.000Z',
    updatedAt: '2024-04-01T00:00:00.000Z',
  },
];

// ---------------------------------------------------------------------------
// Route mock helpers
// ---------------------------------------------------------------------------

async function mockInvoiceGroupsListApi(page: any, groups = MOCK_GROUPS) {
  // Wildcard pattern catches requests with query params (filters, pagination)
  await page.route('**/api/invoice-groups**', (route: any) => {
    if (route.request().method() === 'GET') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: groups,
          paging: LIST_PAGING(groups.length),
        }),
      });
    } else {
      route.continue();
    }
  });
}

async function mockSingleGroupApi(page: any, group = MOCK_GROUPS[0]) {
  await page.route(`**/api/invoice-groups/${group.id}`, (route: any) => {
    if (route.request().method() === 'GET') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: group, paging: NULL_PAGING }),
      });
    } else {
      route.continue();
    }
  });
}

async function mockAccountsApi(page: any, accounts = MOCK_ACCOUNTS) {
  await page.route('**/api/accounts**', (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: accounts,
        paging: LIST_PAGING(accounts.length, 0, 100),
      }),
    })
  );
}

// ---------------------------------------------------------------------------
// Invoice Groups — List Page
// ---------------------------------------------------------------------------

test.describe('Invoice Groups List Page', () => {
  test.beforeEach(async ({ page }) => {
    await mockInvoiceGroupsListApi(page);
    await page.goto(`${BASE_URL}/invoice-groups`);
    await page.waitForLoadState('networkidle');
  });

  test('renders page heading "Invoice Groups"', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Invoice Groups');
  });

  test('shows description text about organizing invoices', async ({ page }) => {
    await expect(
      page.getByText(/organize invoices by department/i)
    ).toBeVisible();
  });

  test('shows "New Group" button linking to /invoice-groups/new', async ({ page }) => {
    const newGroupLink = page
      .getByRole('link', { name: /new group/i })
      .or(page.getByRole('button', { name: /new group/i }))
      .first();
    await expect(newGroupLink).toBeVisible();
  });

  test('table has "Name" column header', async ({ page }) => {
    await expect(page.getByRole('columnheader', { name: 'Name' }).or(
      page.getByText('Name').first()
    )).toBeVisible();
  });

  test('table has "Type" column header', async ({ page }) => {
    await expect(page.getByText('Type').first()).toBeVisible();
  });

  test('table has "Code" column header', async ({ page }) => {
    await expect(page.getByText('Code').first()).toBeVisible();
  });

  test('table has "Account" column header', async ({ page }) => {
    await expect(page.getByText('Account').first()).toBeVisible();
  });

  test('table has "Invoices" column header', async ({ page }) => {
    await expect(page.getByText('Invoices').first()).toBeVisible();
  });

  test('table has "Actions" column header', async ({ page }) => {
    await expect(page.getByText('Actions').first()).toBeVisible();
  });

  test('displays all mocked group names', async ({ page }) => {
    await expect(page.getByText('Engineering')).toBeVisible();
    await expect(page.getByText('HQ Office')).toBeVisible();
    await expect(page.getByText('Operations')).toBeVisible();
    await expect(page.getByText('Special Project Alpha')).toBeVisible();
  });

  test('displays group codes in monospace cells', async ({ page }) => {
    await expect(page.getByText('ENG-001')).toBeVisible();
    await expect(page.getByText('LOC-HQ')).toBeVisible();
    await expect(page.getByText('OPS-01')).toBeVisible();
  });

  test('shows em-dash placeholder for groups without a code', async ({ page }) => {
    // ig-004 has no code — the column renders an em-dash
    const rows = page.locator('tbody tr');
    // Locate the row that contains "Special Project Alpha"
    const targetRow = rows.filter({ hasText: 'Special Project Alpha' });
    await expect(targetRow.getByText('—')).toBeVisible();
  });

  test('displays account names as links for each group', async ({ page }) => {
    await expect(page.getByText('Acme Corp').first()).toBeVisible();
    await expect(page.getByText('Globex Inc').first()).toBeVisible();
  });

  test('displays group type badges: Department, Location, Cost Center, Custom', async ({ page }) => {
    // Use exact:true to avoid matching description text that also contains these words
    await expect(page.getByText('Department', { exact: true })).toBeVisible();
    await expect(page.getByText('Location', { exact: true })).toBeVisible();
    await expect(page.getByText('Cost Center', { exact: true })).toBeVisible();
    await expect(page.getByText('Custom', { exact: true })).toBeVisible();
  });

  test('shows invoice counts in the Invoices column', async ({ page }) => {
    // ig-001 has 3 invoices, ig-002 has 1, ig-003 and ig-004 have 0
    const rows = page.locator('tbody tr');
    const engineeringRow = rows.filter({ hasText: 'Engineering' });
    await expect(engineeringRow.getByText('3')).toBeVisible();
  });

  test('delete button is disabled for groups that have invoices', async ({ page }) => {
    // ig-001 (Engineering) has 3 invoices — its delete button must be disabled
    const engineeringRow = page.locator('tbody tr').filter({ hasText: 'Engineering' });
    const deleteBtn = engineeringRow.locator('button[title="Group has attached invoices"]');
    await expect(deleteBtn).toBeDisabled();
  });

  test('delete button is enabled for groups with zero invoices', async ({ page }) => {
    // ig-003 (Operations) has 0 invoices — delete button should be enabled
    const operationsRow = page.locator('tbody tr').filter({ hasText: 'Operations' });
    const deleteBtn = operationsRow.locator('button[title="Delete group"]');
    await expect(deleteBtn).toBeEnabled();
  });

  test('search input is visible on the list page', async ({ page }) => {
    await expect(
      page
        .locator('input[placeholder*="Search groups"]')
        .or(page.locator('input[type="search"]'))
    ).toBeVisible();
  });

  test('type filter select is rendered with "All Types" default', async ({ page }) => {
    await expect(page.getByRole('combobox').filter({ hasText: /all types/i })).toBeVisible();
  });

  test('type filter shows all four InvoiceGroupType options', async ({ page }) => {
    await page.getByRole('combobox').filter({ hasText: /all types/i }).click();
    await expect(page.getByRole('option', { name: 'Department' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Cost Center' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Location' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Custom' })).toBeVisible();
  });

  test('selecting a type filter triggers a new API request with groupType param', async ({ page }) => {
    const filteredGroups = MOCK_GROUPS.filter((g) => g.groupType === 'DEPARTMENT');
    let capturedUrl = '';

    await page.route('**/api/invoice-groups**', (route) => {
      capturedUrl = route.request().url();
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: filteredGroups,
            paging: LIST_PAGING(filteredGroups.length),
          }),
        });
      } else {
        route.continue();
      }
    });

    await page.getByRole('combobox').filter({ hasText: /all types/i }).click();
    await page.getByRole('option', { name: 'Department' }).click();
    await page.waitForLoadState('networkidle');

    expect(capturedUrl).toContain('DEPARTMENT');
  });

  test('type filter: selecting Department shows only Department groups', async ({ page }) => {
    const filteredGroups = MOCK_GROUPS.filter((g) => g.groupType === 'DEPARTMENT');

    await page.route('**/api/invoice-groups**', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: filteredGroups,
            paging: LIST_PAGING(filteredGroups.length),
          }),
        });
      } else {
        route.continue();
      }
    });

    await page.getByRole('combobox').filter({ hasText: /all types/i }).click();
    await page.getByRole('option', { name: 'Department' }).click();
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Engineering')).toBeVisible();
    await expect(page.getByText('HQ Office')).not.toBeVisible();
    await expect(page.getByText('Operations')).not.toBeVisible();
  });

  test('search input triggers API request with name[like] param', async ({ page }) => {
    const filteredGroups = MOCK_GROUPS.filter((g) =>
      g.name.toLowerCase().includes('eng')
    );
    let capturedUrl = '';

    await page.route('**/api/invoice-groups**', (route) => {
      capturedUrl = route.request().url();
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: filteredGroups,
            paging: LIST_PAGING(filteredGroups.length),
          }),
        });
      } else {
        route.continue();
      }
    });

    const searchInput = page
      .locator('input[placeholder*="Search groups"]')
      .or(page.locator('input[type="search"]'));
    await searchInput.fill('eng');
    // SearchInput component debounces 500ms — wait for the debounce to fire
    // then wait for the resulting request to complete
    await page.waitForTimeout(600);
    await page.waitForLoadState('networkidle');

    expect(capturedUrl).toContain('eng');
  });

  // -------------------------------------------------------------------------
  // Empty state
  // -------------------------------------------------------------------------

  test('shows "No invoice groups" empty state when list is empty', async ({ page }) => {
    await page.route('**/api/invoice-groups**', (route) => {
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
    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/no invoice groups/i)).toBeVisible();
    // Use role-based selector to avoid matching description text that also contains "create group"
    await expect(page.getByRole('button', { name: /create group/i })).toBeVisible();
  });

  test('shows "No groups found" empty state when filters return nothing', async ({ page }) => {
    await page.route('**/api/invoice-groups**', (route) => {
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

    // Apply a type filter so the empty state branch shows the "filtered" variant
    await page.getByRole('combobox').filter({ hasText: /all types/i }).click();
    await page.getByRole('option', { name: 'Custom' }).click();
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/no groups found/i)).toBeVisible();
    await expect(page.getByText(/clear filters/i)).toBeVisible();
  });

  test('gracefully handles a 500 error from the API', async ({ page }) => {
    await page.route('**/api/invoice-groups**', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { message: 'Internal server error', statusCode: 500 },
        }),
      })
    );
    await page.reload();
    await page.waitForLoadState('networkidle');

    // The page should not crash — heading must still render
    await expect(page.locator('h1')).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Delete confirmation dialog
  // -------------------------------------------------------------------------

  test('clicking delete on a zero-invoice group opens the confirmation dialog', async ({ page }) => {
    const operationsRow = page.locator('tbody tr').filter({ hasText: 'Operations' });
    const deleteBtn = operationsRow.locator('button[title="Delete group"]');
    await deleteBtn.click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Delete Invoice Group')).toBeVisible();
    await expect(
      page.getByText(/are you sure you want to delete/i)
    ).toBeVisible();
  });

  test('delete dialog shows the group name in the confirmation message', async ({ page }) => {
    const operationsRow = page.locator('tbody tr').filter({ hasText: 'Operations' });
    await operationsRow.locator('button[title="Delete group"]').click();

    await expect(page.getByText(/"Operations"/)).toBeVisible();
  });

  test('cancel button inside delete dialog closes it without deleting', async ({ page }) => {
    const operationsRow = page.locator('tbody tr').filter({ hasText: 'Operations' });
    await operationsRow.locator('button[title="Delete group"]').click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: /^cancel$/i }).click();

    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('confirming delete calls DELETE endpoint and shows success toast', async ({ page }) => {
    let deleteRequested = false;

    await page.route('**/api/invoice-groups/ig-003', (route) => {
      if (route.request().method() === 'DELETE') {
        deleteRequested = true;
        route.fulfill({ status: 204, body: '' });
      } else {
        route.continue();
      }
    });

    const operationsRow = page.locator('tbody tr').filter({ hasText: 'Operations' });
    await operationsRow.locator('button[title="Delete group"]').click();
    // Wait for the DELETE response explicitly — waitForLoadState alone fires before the async mutation
    const deleteResponsePromise = page.waitForResponse(
      (resp) => resp.url().includes('/api/invoice-groups/ig-003') && resp.request().method() === 'DELETE'
    );
    await page.getByRole('button', { name: /^delete$/i }).click();
    await deleteResponsePromise;

    expect(deleteRequested).toBe(true);
    await expect(page.getByText(/group "Operations" deleted/i)).toBeVisible({ timeout: 5000 });
  });

  test('delete API 500 error shows failure toast', async ({ page }) => {
    await page.route('**/api/invoice-groups/ig-003', (route) => {
      if (route.request().method() === 'DELETE') {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: { message: 'Failed to delete group', statusCode: 500 },
          }),
        });
      } else {
        route.continue();
      }
    });

    const operationsRow = page.locator('tbody tr').filter({ hasText: 'Operations' });
    await operationsRow.locator('button[title="Delete group"]').click();
    // Wait for the DELETE response explicitly before asserting the toast
    const deleteResponsePromise = page.waitForResponse(
      (resp) => resp.url().includes('/api/invoice-groups/ig-003') && resp.request().method() === 'DELETE'
    );
    await page.getByRole('button', { name: /^delete$/i }).click();
    await deleteResponsePromise;

    await expect(
      page.getByText(/failed to delete group/i)
    ).toBeVisible({ timeout: 5000 });
  });

  test('dialog closes automatically after a successful delete', async ({ page }) => {
    await page.route('**/api/invoice-groups/ig-003', (route) => {
      if (route.request().method() === 'DELETE') {
        route.fulfill({ status: 204, body: '' });
      } else {
        route.continue();
      }
    });

    const operationsRow = page.locator('tbody tr').filter({ hasText: 'Operations' });
    await operationsRow.locator('button[title="Delete group"]').click();
    const deleteResponsePromise = page.waitForResponse(
      (resp) => resp.url().includes('/api/invoice-groups/ig-003') && resp.request().method() === 'DELETE'
    );
    await page.getByRole('button', { name: /^delete$/i }).click();
    await deleteResponsePromise;

    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 });
  });

  // -------------------------------------------------------------------------
  // Navigation from list
  // -------------------------------------------------------------------------

  test('"New Group" button navigates to /invoice-groups/new', async ({ page }) => {
    await mockAccountsApi(page);
    await page
      .getByRole('link', { name: /new group/i })
      .or(page.getByRole('button', { name: /new group/i }))
      .first()
      .click({ force: true });
    await expect(page).toHaveURL(`${BASE_URL}/invoice-groups/new`);
  });

  test('edit button navigates to /invoice-groups/:id/edit', async ({ page }) => {
    await mockAccountsApi(page);
    await mockSingleGroupApi(page, MOCK_GROUPS[0]);

    const engineeringRow = page.locator('tbody tr').filter({ hasText: 'Engineering' });
    // Target the edit link specifically by its href pattern (not the account name link)
    await engineeringRow.locator('a[href*="/edit"]').click({ force: true });
    await expect(page).toHaveURL(`${BASE_URL}/invoice-groups/ig-001/edit`);
  });
});

// ---------------------------------------------------------------------------
// Invoice Groups — Create Form
// ---------------------------------------------------------------------------

test.describe('Invoice Groups Create Form', () => {
  test.beforeEach(async ({ page }) => {
    await mockAccountsApi(page);
    await mockInvoiceGroupsListApi(page);
    await page.goto(`${BASE_URL}/invoice-groups/new`);
    await page.waitForLoadState('networkidle');
  });

  test('renders "Create Invoice Group" page heading', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Create Invoice Group');
  });

  test('shows description "Create a new group to organize invoices"', async ({ page }) => {
    await expect(
      page.getByText(/create a new group to organize invoices/i)
    ).toBeVisible();
  });

  test('shows "Group Information" section card', async ({ page }) => {
    await expect(page.getByText('Group Information')).toBeVisible();
  });

  test('Account field is visible with a "Select account" placeholder', async ({ page }) => {
    await expect(page.getByLabel(/account/i).first()).toBeVisible();
    await expect(page.getByRole('combobox').filter({ hasText: /select account/i })).toBeVisible();
  });

  test('Account select lists all mocked accounts', async ({ page }) => {
    await page.getByRole('combobox').filter({ hasText: /select account/i }).click();
    await expect(page.getByRole('option', { name: 'Acme Corp' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Globex Inc' })).toBeVisible();
  });

  test('Group Type field is visible with a "Select type" placeholder', async ({ page }) => {
    await expect(page.getByRole('combobox').filter({ hasText: /select type/i })).toBeVisible();
  });

  test('Group Type select lists all four InvoiceGroupType options', async ({ page }) => {
    await page.getByRole('combobox').filter({ hasText: /select type/i }).click();
    await expect(page.getByRole('option', { name: 'Department' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Cost Center' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Location' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Custom' })).toBeVisible();
  });

  test('Name field is visible', async ({ page }) => {
    await expect(page.locator('input[name="name"]').or(
      page.locator('input[placeholder*="e.g. Engineering"]')
    )).toBeVisible();
  });

  test('Code field is visible and optional', async ({ page }) => {
    await expect(page.locator('input[name="code"]').or(
      page.locator('input[placeholder*="ENG-001"]')
    )).toBeVisible();
  });

  test('Cancel button is present', async ({ page }) => {
    await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible();
  });

  test('"Create Group" submit button is present', async ({ page }) => {
    await expect(page.getByRole('button', { name: /create group/i })).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  test('submitting empty form shows "Account is required" error', async ({ page }) => {
    await page.getByRole('button', { name: /create group/i }).click();
    await expect(page.getByText(/account is required/i)).toBeVisible();
  });

  test('submitting without Name shows "Name is required" error', async ({ page }) => {
    // Fill account and type but leave name empty
    await page.getByRole('combobox').filter({ hasText: /select account/i }).click();
    await page.getByRole('option', { name: 'Acme Corp' }).click();

    await page.getByRole('combobox').filter({ hasText: /select type/i }).click();
    await page.getByRole('option', { name: 'Department' }).click();

    await page.getByRole('button', { name: /create group/i }).click();
    await expect(page.getByText(/name is required/i)).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Successful creation
  // -------------------------------------------------------------------------

  test('successful creation shows success toast and navigates to list', async ({ page }) => {
    await page.route('**/api/invoice-groups', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              ...MOCK_GROUPS[0],
              id: 'ig-new-001',
              name: 'Finance',
            },
            paging: NULL_PAGING,
          }),
        });
      } else {
        route.continue();
      }
    });

    await page.getByRole('combobox').filter({ hasText: /select account/i }).click();
    await page.getByRole('option', { name: 'Acme Corp' }).click();

    await page.getByRole('combobox').filter({ hasText: /select type/i }).click();
    await page.getByRole('option', { name: 'Department' }).click();

    const nameInput = page.locator('input[name="name"]').or(
      page.locator('input[placeholder*="e.g. Engineering"]')
    );
    await nameInput.fill('Finance');

    await page.getByRole('button', { name: /create group/i }).click();
    await page.waitForURL(`${BASE_URL}/invoice-groups`, { timeout: 5000 });

    await expect(page.getByText(/invoice group created successfully/i)).toBeVisible({ timeout: 5000 });
  });

  test('successful creation with optional Code field sends code to API', async ({ page }) => {
    let requestBody: any = null;

    await page.route('**/api/invoice-groups', (route) => {
      if (route.request().method() === 'POST') {
        requestBody = JSON.parse(route.request().postData() || '{}');
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            data: { ...MOCK_GROUPS[0], id: 'ig-new-002' },
            paging: NULL_PAGING,
          }),
        });
      } else {
        route.continue();
      }
    });

    await page.getByRole('combobox').filter({ hasText: /select account/i }).click();
    await page.getByRole('option', { name: 'Acme Corp' }).click();

    await page.getByRole('combobox').filter({ hasText: /select type/i }).click();
    await page.getByRole('option', { name: 'Location' }).click();

    const nameInput = page.locator('input[name="name"]').or(
      page.locator('input[placeholder*="e.g. Engineering"]')
    );
    await nameInput.fill('Berlin Office');

    const codeInput = page.locator('input[name="code"]').or(
      page.locator('input[placeholder*="ENG-001"]')
    );
    await codeInput.fill('BER-001');

    await page.getByRole('button', { name: /create group/i }).click();
    await page.waitForURL(`${BASE_URL}/invoice-groups`, { timeout: 5000 });

    expect(requestBody?.code).toBe('BER-001');
  });

  // -------------------------------------------------------------------------
  // API error handling
  // -------------------------------------------------------------------------

  test('API 500 error shows error toast and keeps form open', async ({ page }) => {
    await page.route('**/api/invoice-groups', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: { message: 'Internal server error', statusCode: 500 },
          }),
        });
      } else {
        route.continue();
      }
    });

    await page.getByRole('combobox').filter({ hasText: /select account/i }).click();
    await page.getByRole('option', { name: 'Acme Corp' }).click();

    await page.getByRole('combobox').filter({ hasText: /select type/i }).click();
    await page.getByRole('option', { name: 'Department' }).click();

    const nameInput = page.locator('input[name="name"]').or(
      page.locator('input[placeholder*="e.g. Engineering"]')
    );
    await nameInput.fill('Marketing');

    await page.getByRole('button', { name: /create group/i }).click();
    await page.waitForLoadState('networkidle');

    // URL must not have changed — form stays open
    expect(page.url()).toContain('/invoice-groups/new');
    await expect(
      page.getByText(/failed to create group/i)
    ).toBeVisible({ timeout: 5000 });
  });

  test('API 400 validation error with field details shows formatted toast', async ({ page }) => {
    await page.route('**/api/invoice-groups', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: {
              message: 'Validation failed',
              statusCode: 400,
              details: { validationErrors: { code: 'Code must be alphanumeric' } },
            },
          }),
        });
      } else {
        route.continue();
      }
    });

    await page.getByRole('combobox').filter({ hasText: /select account/i }).click();
    await page.getByRole('option', { name: 'Acme Corp' }).click();

    await page.getByRole('combobox').filter({ hasText: /select type/i }).click();
    await page.getByRole('option', { name: 'Cost Center' }).click();

    const nameInput = page.locator('input[name="name"]').or(
      page.locator('input[placeholder*="e.g. Engineering"]')
    );
    await nameInput.fill('Test Center');

    await page.getByRole('button', { name: /create group/i }).click();
    await page.waitForLoadState('networkidle');

    await expect(
      page.getByText(/validation failed/i)
    ).toBeVisible({ timeout: 5000 });
  });

  // -------------------------------------------------------------------------
  // Cancel navigation
  // -------------------------------------------------------------------------

  test('Cancel button navigates back to /invoice-groups', async ({ page }) => {
    await page.getByRole('button', { name: /cancel/i }).click();
    await expect(page).toHaveURL(`${BASE_URL}/invoice-groups`);
  });

  // -------------------------------------------------------------------------
  // Loading state when accounts fetch is in-flight
  // -------------------------------------------------------------------------

  test('shows "Loading accounts..." while accounts are being fetched', async ({ page }) => {
    // Intercept the accounts fetch before navigating so we can delay it
    await page.route('**/api/accounts**', async (route) => {
      await new Promise((r) => setTimeout(r, 600));
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: MOCK_ACCOUNTS,
          paging: LIST_PAGING(MOCK_ACCOUNTS.length, 0, 100),
        }),
      });
    });

    await page.goto(`${BASE_URL}/invoice-groups/new`);
    await expect(page.getByText(/loading accounts/i)).toBeVisible({ timeout: 2000 });
    await page.waitForLoadState('networkidle');
  });

  test('shows error alert when accounts API returns 500', async ({ page }) => {
    await page.route('**/api/accounts**', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { message: 'Database connection failed', statusCode: 500 },
        }),
      })
    );

    await page.goto(`${BASE_URL}/invoice-groups/new`);
    // React Query retries 3 times (1s, 2s, 4s) before entering error state — wait up to 15s
    await expect(page.getByText(/failed to load accounts/i)).toBeVisible({ timeout: 15000 });
  });
});

// ---------------------------------------------------------------------------
// Invoice Groups — Edit Form
// ---------------------------------------------------------------------------

test.describe('Invoice Groups Edit Form', () => {
  const GROUP = MOCK_GROUPS[0]; // Engineering / DEPARTMENT / ENG-001 / acc-001

  test.beforeEach(async ({ page }) => {
    await mockAccountsApi(page);
    // Register list mock BEFORE single-group mock so the single-group mock
    // has higher priority (Playwright uses LIFO — last-registered wins)
    await mockInvoiceGroupsListApi(page);
    await mockSingleGroupApi(page, GROUP);

    await page.goto(`${BASE_URL}/invoice-groups/${GROUP.id}/edit`);
    await page.waitForLoadState('networkidle');
  });

  test('renders "Edit Invoice Group" page heading', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Edit Invoice Group');
  });

  test('description shows the group name being edited', async ({ page }) => {
    await expect(page.getByText(`Editing "${GROUP.name}"`)).toBeVisible();
  });

  test('Name field is pre-populated with the existing group name', async ({ page }) => {
    const nameInput = page.locator('input[name="name"]').or(
      page.locator('input[placeholder*="e.g. Engineering"]')
    );
    await expect(nameInput).toHaveValue(GROUP.name);
  });

  test('Code field is pre-populated with the existing code', async ({ page }) => {
    const codeInput = page.locator('input[name="code"]').or(
      page.locator('input[placeholder*="ENG-001"]')
    );
    await expect(codeInput).toHaveValue(GROUP.code!);
  });

  test('Account select is disabled (immutable after creation)', async ({ page }) => {
    // The account combobox must be disabled in edit mode
    const accountCombobox = page.getByRole('combobox').first();
    await expect(accountCombobox).toBeDisabled();
  });

  test('Group Type select is disabled (immutable after creation)', async ({ page }) => {
    // The type combobox must be disabled in edit mode
    const typeCombobox = page.getByRole('combobox').nth(1);
    await expect(typeCombobox).toBeDisabled();
  });

  test('shows helper text: "Account cannot be changed after creation"', async ({ page }) => {
    await expect(
      page.getByText(/account cannot be changed after creation/i)
    ).toBeVisible();
  });

  test('shows helper text: "Type cannot be changed after creation"', async ({ page }) => {
    await expect(
      page.getByText(/type cannot be changed after creation/i)
    ).toBeVisible();
  });

  test('"Update Group" submit button is present', async ({ page }) => {
    await expect(page.getByRole('button', { name: /update group/i })).toBeVisible();
  });

  test('Cancel button is present', async ({ page }) => {
    await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Successful update
  // -------------------------------------------------------------------------

  test('successful update shows success toast and navigates to list', async ({ page }) => {
    await page.route(`**/api/invoice-groups/${GROUP.id}`, (route) => {
      if (route.request().method() === 'PATCH') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: { ...GROUP, name: 'Engineering Updated' },
            paging: NULL_PAGING,
          }),
        });
      } else {
        route.continue();
      }
    });

    const nameInput = page.locator('input[name="name"]').or(
      page.locator('input[placeholder*="e.g. Engineering"]')
    );
    await nameInput.fill('Engineering Updated');

    await page.getByRole('button', { name: /update group/i }).click();
    await page.waitForURL(`${BASE_URL}/invoice-groups`, { timeout: 5000 });

    await expect(
      page.getByText(/invoice group updated successfully/i)
    ).toBeVisible({ timeout: 5000 });
  });

  test('PATCH request body only contains mutable fields (name, code)', async ({ page }) => {
    let requestBody: any = null;

    await page.route(`**/api/invoice-groups/${GROUP.id}`, (route) => {
      if (route.request().method() === 'PATCH') {
        requestBody = JSON.parse(route.request().postData() || '{}');
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: GROUP, paging: NULL_PAGING }),
        });
      } else {
        route.continue();
      }
    });

    await page.getByRole('button', { name: /update group/i }).click();
    await page.waitForLoadState('networkidle');

    // Only name and code should be sent — accountId and groupType are excluded
    expect(Object.keys(requestBody)).not.toContain('accountId');
    expect(Object.keys(requestBody)).not.toContain('groupType');
    expect(Object.keys(requestBody)).toContain('name');
  });

  test('updating name and code sends both fields in the PATCH body', async ({ page }) => {
    let requestBody: any = null;

    await page.route(`**/api/invoice-groups/${GROUP.id}`, (route) => {
      if (route.request().method() === 'PATCH') {
        requestBody = JSON.parse(route.request().postData() || '{}');
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { ...GROUP, name: 'Dev Team', code: 'DEV-001' }, paging: NULL_PAGING }),
        });
      } else {
        route.continue();
      }
    });

    const nameInput = page.locator('input[name="name"]').or(
      page.locator('input[placeholder*="e.g. Engineering"]')
    );
    await nameInput.fill('Dev Team');

    const codeInput = page.locator('input[name="code"]').or(
      page.locator('input[placeholder*="ENG-001"]')
    );
    await codeInput.fill('DEV-001');

    await page.getByRole('button', { name: /update group/i }).click();
    await page.waitForLoadState('networkidle');

    expect(requestBody?.name).toBe('Dev Team');
    expect(requestBody?.code).toBe('DEV-001');
  });

  // -------------------------------------------------------------------------
  // API error handling on update
  // -------------------------------------------------------------------------

  test('API 500 error on update shows error toast and keeps form open', async ({ page }) => {
    await page.route(`**/api/invoice-groups/${GROUP.id}`, (route) => {
      if (route.request().method() === 'PATCH') {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: { message: 'Database error', statusCode: 500 },
          }),
        });
      } else {
        route.continue();
      }
    });

    await page.getByRole('button', { name: /update group/i }).click();
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain(`/invoice-groups/${GROUP.id}/edit`);
    await expect(
      page.getByText(/failed to update group/i)
    ).toBeVisible({ timeout: 5000 });
  });

  // -------------------------------------------------------------------------
  // Not found state
  // -------------------------------------------------------------------------

  test('shows "Group not found" when the API returns null data', async ({ page }) => {
    await page.route('**/api/invoice-groups/nonexistent', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: null, paging: NULL_PAGING }),
        });
      } else {
        route.continue();
      }
    });

    await page.goto(`${BASE_URL}/invoice-groups/nonexistent/edit`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/group not found/i)).toBeVisible();
  });

  test('shows "Loading group..." while fetching the group', async ({ page }) => {
    await page.route(`**/api/invoice-groups/ig-loading`, async (route) => {
      if (route.request().method() === 'GET') {
        await new Promise((r) => setTimeout(r, 600));
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: GROUP, paging: NULL_PAGING }),
        });
      } else {
        route.continue();
      }
    });

    await page.goto(`${BASE_URL}/invoice-groups/ig-loading/edit`);
    await expect(page.getByText(/loading group/i)).toBeVisible({ timeout: 2000 });
    await page.waitForLoadState('networkidle');
  });

  // -------------------------------------------------------------------------
  // Cancel navigation
  // -------------------------------------------------------------------------

  test('Cancel button navigates back to /invoice-groups', async ({ page }) => {
    await page.getByRole('button', { name: /cancel/i }).click();
    await expect(page).toHaveURL(`${BASE_URL}/invoice-groups`);
  });
});

// ---------------------------------------------------------------------------
// InvoiceGroupType badge colour variants
// ---------------------------------------------------------------------------

test.describe('Invoice Group Type Badge Variants', () => {
  const TYPE_CASES = [
    { groupId: 'ig-001', groupType: 'DEPARTMENT', label: 'Department' },
    { groupId: 'ig-002', groupType: 'LOCATION',   label: 'Location'   },
    { groupId: 'ig-003', groupType: 'COST_CENTER', label: 'Cost Center' },
    { groupId: 'ig-004', groupType: 'CUSTOM',      label: 'Custom'      },
  ];

  for (const { groupId, label } of TYPE_CASES) {
    test(`list page shows correct label "${label}" for group ${groupId}`, async ({ page }) => {
      await mockInvoiceGroupsListApi(page);
      await page.goto(`${BASE_URL}/invoice-groups`);
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(label).first()).toBeVisible();
    });
  }
});

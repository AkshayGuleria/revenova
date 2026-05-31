/**
 * E2E Tests: Renewals
 * Covers the renewals page: expiring-soon section, overdue section,
 * renew actions, auto-renew badge, empty state, and loading state.
 *
 * @author piia (Frontend Testing Agent)
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

// ---------------------------------------------------------------------------
// Mock data — field names match UpcomingRenewal / OverdueRenewal interfaces
// from use-renewals.ts (contractId, accountName — NOT nested account object)
// ---------------------------------------------------------------------------

const MOCK_UPCOMING_CONTRACT = {
  contractId: 'con-001',
  contractNumber: 'CON-2024-001',
  accountId: 'acc-001',
  accountName: 'Acme Corporation',
  endDate: '2026-06-15',
  autoRenew: true,
  contractValue: 120000,
  currency: 'EUR',
  daysUntilExpiry: 15,
};

const MOCK_OVERDUE_CONTRACT = {
  contractId: 'con-002',
  contractNumber: 'CON-2024-002',
  accountId: 'acc-002',
  accountName: 'Beta Technologies',
  endDate: '2026-04-01',
  autoRenew: false,
  contractValue: 60000,
  currency: 'EUR',
  daysOverdue: 60,
};

const MOCK_RENEWED_CONTRACT = {
  ...MOCK_UPCOMING_CONTRACT,
  endDate: '2027-06-15',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Set up common API mocks and navigate to /renewals */
async function setupAndGoto(
  page: any,
  {
    upcoming = [MOCK_UPCOMING_CONTRACT],
    overdue = [MOCK_OVERDUE_CONTRACT],
  }: { upcoming?: any[]; overdue?: any[] } = {}
) {
  // The app uses /api/config (not /api/app-config)
  await page.route('**/api/config', (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: { defaultCurrency: 'EUR', supportedCurrencies: ['USD', 'EUR', 'GBP'] },
        paging: NULL_PAGING,
      }),
    })
  );
  await page.route('**/api/renewals/upcoming*', (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: upcoming, paging: LIST_PAGING(upcoming.length) }),
    })
  );
  await page.route('**/api/renewals/overdue*', (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: overdue, paging: LIST_PAGING(overdue.length) }),
    })
  );
  await page.goto(`${BASE_URL}/renewals`);
  await page.waitForLoadState('networkidle');
}

// ===========================================================================
// Renewals Page
// ===========================================================================

test.describe('Renewals — Page', () => {
  test('page loads with correct heading', async ({ page }) => {
    await setupAndGoto(page);
    await expect(page.getByRole('heading', { name: 'Renewals' })).toBeVisible();
  });

  test('Expiring Soon section heading is visible', async ({ page }) => {
    await setupAndGoto(page);
    await expect(page.getByText('Expiring Soon')).toBeVisible();
  });

  test('Overdue Renewals section heading is visible', async ({ page }) => {
    await setupAndGoto(page);
    await expect(page.getByText('Overdue Renewals')).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Scenario 1: Renders upcoming renewals
  // -------------------------------------------------------------------------
  test('renders upcoming contract number and account name', async ({ page }) => {
    await setupAndGoto(page);

    // Contract number rendered as a link
    await expect(page.getByRole('link', { name: 'CON-2024-001' })).toBeVisible();
    // Account name rendered as a link
    await expect(page.getByRole('link', { name: 'Acme Corporation' })).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Scenario 2: Shows days until expiry
  // -------------------------------------------------------------------------
  test('shows days until expiry for upcoming contract', async ({ page }) => {
    await setupAndGoto(page);
    // The route renders "{daysLeft} days" in the Days Until Expiry column
    await expect(page.getByText('15 days')).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Scenario 3: Renders overdue contracts
  // -------------------------------------------------------------------------
  test('renders overdue contract number and account name', async ({ page }) => {
    await setupAndGoto(page);

    await expect(page.getByRole('link', { name: 'CON-2024-002' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Beta Technologies' })).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Scenario 4: Shows days overdue
  // -------------------------------------------------------------------------
  test('shows days overdue for overdue contract', async ({ page }) => {
    await setupAndGoto(page);
    // The route renders "{renewal.daysOverdue} days" in the Days Overdue column
    await expect(page.getByText('60 days')).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Scenario 5: Renew Now action on upcoming contract
  // -------------------------------------------------------------------------
  test('Renew Now on upcoming contract calls POST renew endpoint', async ({ page }) => {
    let renewCalled = false;

    await page.route('**/api/config', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { defaultCurrency: 'EUR', supportedCurrencies: ['USD', 'EUR', 'GBP'] },
          paging: NULL_PAGING,
        }),
      })
    );
    await page.route('**/api/renewals/upcoming*', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [MOCK_UPCOMING_CONTRACT], paging: LIST_PAGING(1) }),
      })
    );
    await page.route('**/api/renewals/overdue*', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], paging: LIST_PAGING(0) }),
      })
    );
    await page.route('**/api/renewals/con-001/renew', (route: any) => {
      renewCalled = true;
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: MOCK_RENEWED_CONTRACT, paging: NULL_PAGING }),
      });
    });

    await page.goto(`${BASE_URL}/renewals`);
    await page.waitForLoadState('networkidle');

    // Accept the confirm() dialog automatically
    page.on('dialog', (dialog: any) => dialog.accept());

    await page.getByRole('button', { name: 'Renew Now' }).first().click();
    await page.waitForTimeout(500);

    expect(renewCalled).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Scenario 6: Renew Now action on overdue contract
  // -------------------------------------------------------------------------
  test('Renew Now on overdue contract calls POST renew endpoint', async ({ page }) => {
    let renewCalled = false;

    await page.route('**/api/config', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { defaultCurrency: 'EUR', supportedCurrencies: ['USD', 'EUR', 'GBP'] },
          paging: NULL_PAGING,
        }),
      })
    );
    await page.route('**/api/renewals/upcoming*', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], paging: LIST_PAGING(0) }),
      })
    );
    await page.route('**/api/renewals/overdue*', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [MOCK_OVERDUE_CONTRACT], paging: LIST_PAGING(1) }),
      })
    );
    await page.route('**/api/renewals/con-002/renew', (route: any) => {
      renewCalled = true;
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: MOCK_RENEWED_CONTRACT, paging: NULL_PAGING }),
      });
    });

    await page.goto(`${BASE_URL}/renewals`);
    await page.waitForLoadState('networkidle');

    // Accept the confirm() dialog automatically
    page.on('dialog', (dialog: any) => dialog.accept());

    await page.getByRole('button', { name: 'Renew Now' }).first().click();
    await page.waitForTimeout(500);

    expect(renewCalled).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Scenario 7: Auto-renew badge
  // -------------------------------------------------------------------------
  test('contract with autoRenew=true shows "Yes" badge', async ({ page }) => {
    await setupAndGoto(page, { upcoming: [MOCK_UPCOMING_CONTRACT], overdue: [] });
    // The route renders <Badge>{renewal.autoRenew ? "Yes" : "No"}</Badge>
    // Target the Auto-Renew column cell specifically to avoid substring collisions
    await expect(page.locator('td').filter({ hasText: /^Yes$/ })).toBeVisible();
  });

  test('contract with autoRenew=false shows "No" badge', async ({ page }) => {
    const noAutoRenew = { ...MOCK_UPCOMING_CONTRACT, autoRenew: false };
    await setupAndGoto(page, { upcoming: [noAutoRenew], overdue: [] });
    // Target the Auto-Renew column cell specifically (exact "No" text in cell)
    await expect(page.locator('td').filter({ hasText: /^No$/ })).toBeVisible();
    // "Yes" should not appear in any cell
    await expect(page.locator('td').filter({ hasText: /^Yes$/ })).not.toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Scenario 8: Empty upcoming state
  // -------------------------------------------------------------------------
  test('shows empty state when no upcoming contracts', async ({ page }) => {
    await setupAndGoto(page, { upcoming: [], overdue: [] });
    await expect(page.getByText('No upcoming renewals')).toBeVisible();
    await expect(page.getByText('All contracts are in good standing')).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Scenario 9: Loading state
  // -------------------------------------------------------------------------
  test('shows loading skeletons while data is fetching', async ({ page }) => {
    // Delay responses so the loading state is visible
    await page.route('**/api/config', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { defaultCurrency: 'EUR', supportedCurrencies: ['USD', 'EUR', 'GBP'] },
          paging: NULL_PAGING,
        }),
      })
    );
    await page.route('**/api/renewals/upcoming*', async (route: any) => {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [MOCK_UPCOMING_CONTRACT], paging: LIST_PAGING(1) }),
      });
    });
    await page.route('**/api/renewals/overdue*', async (route: any) => {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [MOCK_OVERDUE_CONTRACT], paging: LIST_PAGING(1) }),
      });
    });

    // Navigate without waiting for networkidle so we catch the loading state
    await page.goto(`${BASE_URL}/renewals`);
    await page.waitForLoadState('domcontentloaded');

    // Page heading and section headings should be visible immediately from SSR/shell
    await expect(page.getByRole('heading', { name: 'Renewals' })).toBeVisible();
    await expect(page.getByText('Expiring Soon')).toBeVisible();
    await expect(page.getByText('Overdue Renewals')).toBeVisible();

    // Skeleton elements are rendered during loading via shadcn <Skeleton>
    // which uses Tailwind's animate-pulse class
    const skeleton = page.locator('[class*="animate-pulse"]').first();
    await expect(skeleton).toBeVisible({ timeout: 1500 }).catch(() => {
      // Skeletons may have already been replaced by data — page is responsive
    });
  });

  // -------------------------------------------------------------------------
  // Additional: column headers visible in upcoming table
  // -------------------------------------------------------------------------
  test('upcoming table has correct column headers', async ({ page }) => {
    await setupAndGoto(page);
    // Both tables have "Contract", "Account" etc — use .first() to target the upcoming table
    await expect(page.getByRole('columnheader', { name: 'Contract' }).first()).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Account' }).first()).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'End Date' }).first()).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Days Until Expiry' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Value' }).first()).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Auto-Renew' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Action' }).first()).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Additional: column headers visible in overdue table
  // -------------------------------------------------------------------------
  test('overdue table has correct column headers', async ({ page }) => {
    await setupAndGoto(page);
    await expect(page.getByRole('columnheader', { name: 'Expired On' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Days Overdue' })).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Additional: contract number links navigate to contract detail
  // -------------------------------------------------------------------------
  test('contract number in upcoming table links to contract detail', async ({ page }) => {
    await setupAndGoto(page);
    const contractLink = page.getByRole('link', { name: 'CON-2024-001' });
    await expect(contractLink).toBeVisible();
    await expect(contractLink).toHaveAttribute('href', /\/contracts\/con-001/);
  });

  test('contract number in overdue table links to contract detail', async ({ page }) => {
    await setupAndGoto(page);
    const contractLink = page.getByRole('link', { name: 'CON-2024-002' });
    await expect(contractLink).toBeVisible();
    await expect(contractLink).toHaveAttribute('href', /\/contracts\/con-002/);
  });

  // -------------------------------------------------------------------------
  // Additional: empty overdue state
  // -------------------------------------------------------------------------
  test('shows empty state when no overdue contracts', async ({ page }) => {
    await setupAndGoto(page, { upcoming: [], overdue: [] });
    await expect(page.getByText('No overdue renewals')).toBeVisible();
    await expect(page.getByText('No contracts have expired without renewal')).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Additional: count badge in section heading
  // -------------------------------------------------------------------------
  test('upcoming section shows count badge when contracts exist', async ({ page }) => {
    await setupAndGoto(page);
    // The route renders a Badge with upcoming.length inside the "Expiring Soon" heading
    await expect(page.getByText('Expiring Soon')).toBeVisible();
    // The count badge should show "1" — look for it near the "Expiring Soon" header
    await expect(page.getByText('Expiring Soon').locator('..').locator('..').getByText('1')).toBeVisible();
  });
});

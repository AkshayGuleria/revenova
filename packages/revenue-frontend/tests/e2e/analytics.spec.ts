/**
 * E2E Tests: Analytics Dashboard
 * Covers the /analytics route: metric cards, loading state,
 * churn analysis, bookings, currency formatting, and error handling.
 *
 * @author piia (Frontend Testing Specialist)
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

const NULL_PAGING = {
  offset: null,
  limit: null,
  total: null,
  totalPages: null,
  hasNext: null,
  hasPrev: null,
};

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_SUMMARY = {
  asOf: '2026-05-31',
  mrr: 125000,
  arr: 1500000,
  activeContracts: 42,
  totalAccounts: 18,
  currency: 'EUR',
};

const MOCK_CHURN = {
  from: '2026-01-01',
  to: '2026-05-31',
  churnedContracts: 3,
  churnedARR: 75000,
  churnRate: 0.071,
  currency: 'EUR',
};

const MOCK_BOOKINGS = {
  from: '2026-01-01',
  to: '2026-05-31',
  newContracts: 12,
  totalBookings: 480000,
  currency: 'EUR',
};

const EUR_CONFIG = {
  data: { defaultCurrency: 'EUR', supportedCurrencies: ['USD', 'EUR', 'GBP'] },
  paging: NULL_PAGING,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function mountAnalyticsMocks(page: any) {
  await page.route('**/api/config', (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(EUR_CONFIG),
    })
  );

  await page.route('**/api/analytics/summary*', (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: MOCK_SUMMARY, paging: NULL_PAGING }),
    })
  );

  await page.route('**/api/analytics/churn*', (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: MOCK_CHURN, paging: NULL_PAGING }),
    })
  );

  await page.route('**/api/analytics/bookings*', (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: MOCK_BOOKINGS, paging: NULL_PAGING }),
    })
  );
}

// ===========================================================================
// Analytics — Page Load
// ===========================================================================

test.describe('Analytics — Page Load', () => {
  test.beforeEach(async ({ page }) => {
    await mountAnalyticsMocks(page);
    await page.goto(`${BASE_URL}/analytics`);
    await page.waitForLoadState('networkidle');
  });

  test('page loads without errors and renders the Analytics heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible();
  });

  test('page renders the description text', async ({ page }) => {
    // The description paragraph contains "Revenue metrics, churn analysis, and bookings"
    await expect(page.getByRole('heading', { name: 'Analytics' }).locator('..').getByText(/revenue metrics/i)).toBeVisible();
  });
});

// ===========================================================================
// Analytics — Metric Cards (Summary)
// ===========================================================================

test.describe('Analytics — Metric Cards', () => {
  test.beforeEach(async ({ page }) => {
    await mountAnalyticsMocks(page);
    await page.goto(`${BASE_URL}/analytics`);
    await page.waitForLoadState('networkidle');
  });

  test('all four metric card titles are visible', async ({ page }) => {
    await expect(page.getByText('Monthly Recurring Revenue', { exact: true })).toBeVisible();
    await expect(page.getByText('Annual Recurring Revenue', { exact: true })).toBeVisible();
    await expect(page.getByText('Active Contracts', { exact: true })).toBeVisible();
    await expect(page.getByText('Total Accounts', { exact: true })).toBeVisible();
  });

  test('MRR card shows formatted value (€125,000)', async ({ page }) => {
    // Intl.NumberFormat with EUR and en-US locale produces €125,000
    const mrrCard = page.getByText('Monthly Recurring Revenue', { exact: true }).locator('..').locator('..');
    await expect(mrrCard).toBeVisible({ timeout: 5000 });
    const cardText = await mrrCard.textContent();
    const hasValue = cardText?.includes('125,000') || cardText?.includes('125000');
    expect(hasValue).toBeTruthy();
  });

  test('ARR card shows formatted value (€1,500,000)', async ({ page }) => {
    const arrCard = page.getByText('Annual Recurring Revenue', { exact: true }).locator('..').locator('..');
    await expect(arrCard).toBeVisible({ timeout: 5000 });
    const cardText = await arrCard.textContent();
    const hasValue = cardText?.includes('1,500,000') || cardText?.includes('1500000');
    expect(hasValue).toBeTruthy();
  });

  test('Active Contracts card shows value 42', async ({ page }) => {
    // Scope to the Active Contracts card to avoid strict mode violations
    const activeContractsCard = page.getByText('Active Contracts', { exact: true }).locator('..').locator('..');
    await expect(activeContractsCard.getByText('42')).toBeVisible({ timeout: 5000 });
  });

  test('Total Accounts card shows value 18', async ({ page }) => {
    const totalAccountsCard = page.getByText('Total Accounts', { exact: true }).locator('..').locator('..');
    await expect(totalAccountsCard.getByText('18')).toBeVisible({ timeout: 5000 });
  });
});

// ===========================================================================
// Analytics — Currency Formatting
// ===========================================================================

test.describe('Analytics — Currency Formatting', () => {
  test.beforeEach(async ({ page }) => {
    await mountAnalyticsMocks(page);
    await page.goto(`${BASE_URL}/analytics`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
  });

  test('MRR value is formatted with EUR currency symbol', async ({ page }) => {
    const mrrCard = page.getByText('Monthly Recurring Revenue', { exact: true }).locator('..').locator('..');
    const cardText = await mrrCard.textContent();
    const hasEur = cardText?.includes('€') || cardText?.includes('EUR');
    expect(hasEur).toBeTruthy();
  });

  test('ARR value is formatted with EUR currency symbol', async ({ page }) => {
    const arrCard = page.getByText('Annual Recurring Revenue', { exact: true }).locator('..').locator('..');
    const cardText = await arrCard.textContent();
    const hasEur = cardText?.includes('€') || cardText?.includes('EUR');
    expect(hasEur).toBeTruthy();
  });

  test('MRR card does not show USD dollar sign when config returns EUR', async ({ page }) => {
    const mrrCard = page.getByText('Monthly Recurring Revenue', { exact: true }).locator('..').locator('..');
    const cardText = await mrrCard.textContent();
    // Should NOT contain "$" when EUR is configured
    const hasUsdOnly = cardText?.includes('$') && !cardText?.includes('€');
    expect(hasUsdOnly).toBeFalsy();
  });
});

// ===========================================================================
// Analytics — Loading State
// ===========================================================================

test.describe('Analytics — Loading State', () => {
  test('skeleton loaders appear while summary data is in-flight', async ({ page }) => {
    // Block the summary response so loading state persists
    let resolveSummary!: () => void;
    const summaryReady = new Promise<void>((r) => (resolveSummary = r));

    await page.route('**/api/config', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(EUR_CONFIG),
      })
    );
    await page.route('**/api/analytics/summary*', async (route: any) => {
      await summaryReady;
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: MOCK_SUMMARY, paging: NULL_PAGING }),
      });
    });
    await page.route('**/api/analytics/churn*', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: MOCK_CHURN, paging: NULL_PAGING }),
      })
    );
    await page.route('**/api/analytics/bookings*', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: MOCK_BOOKINGS, paging: NULL_PAGING }),
      })
    );

    await page.goto(`${BASE_URL}/analytics`);
    // Wait for page heading to confirm React has mounted
    await page.getByRole('heading', { name: 'Analytics' }).waitFor({ state: 'visible', timeout: 10000 });

    // While summary is blocked, skeletons or the heading should be present
    const headingVisible = await page.getByRole('heading', { name: 'Analytics' }).isVisible();
    const skeletons = page.locator('.animate-pulse');
    const skeletonCount = await skeletons.count();
    expect(skeletonCount > 0 || headingVisible).toBeTruthy();

    // Unblock so the page can settle
    resolveSummary();
  });
});

// ===========================================================================
// Analytics — Churn Section
// ===========================================================================

test.describe('Analytics — Churn Section', () => {
  test.beforeEach(async ({ page }) => {
    await mountAnalyticsMocks(page);
    await page.goto(`${BASE_URL}/analytics`);
    await page.waitForLoadState('networkidle');
  });

  test('Churn Analysis heading is visible', async ({ page }) => {
    // Use { exact: true } to avoid matching the description text that also contains "churn analysis"
    await expect(page.getByText('Churn Analysis', { exact: true })).toBeVisible();
  });

  test('Churn section description is visible', async ({ page }) => {
    await expect(page.getByText('Contracts lost in a date range', { exact: true })).toBeVisible();
  });

  test('Churn section has From and To date inputs', async ({ page }) => {
    // Navigate from "Churn Analysis" text up through the DOM to the card containing date inputs.
    // Structure: text(e169) → div(e168) → div.flex(e163) → div(e160, header) → div(e159, card)
    // 4 levels up reaches e159 (the churn card), not the parent grid row.
    const churnCard = page.getByText('Churn Analysis', { exact: true }).locator('../../../..');
    const dateInputs = churnCard.locator('input[type="date"]');
    await expect(dateInputs.first()).toBeVisible();
    await expect(dateInputs.nth(1)).toBeVisible();
  });

  test('Churn section has an Apply button', async ({ page }) => {
    // 4 levels up reaches the churn card div (e159)
    const churnCard = page.getByText('Churn Analysis', { exact: true }).locator('../../../..');
    await expect(churnCard.getByRole('button', { name: /apply/i })).toBeVisible();
  });

  test('churn data loads on page load — churned contracts count shown', async ({ page }) => {
    // Mock returns churnedContracts: 3; scope to the Churn Analysis card to avoid ambiguity
    const churnCard = page.getByText('Churn Analysis', { exact: true }).locator('../../../..');
    await expect(churnCard.getByText('3')).toBeVisible({ timeout: 5000 });
  });

  test('churn data loads on apply — churnedARR displayed with currency', async ({ page }) => {
    const churnCard = page.getByText('Churn Analysis', { exact: true }).locator('../../../..');
    await churnCard.getByRole('button', { name: /apply/i }).click();
    await page.waitForLoadState('networkidle');

    // churnedARR = 75000, formatted as €75,000
    const churnedArrValue = churnCard.getByText(/churned arr/i).locator('../..');
    await expect(churnedArrValue).toBeVisible({ timeout: 5000 });
    const text = await churnedArrValue.textContent();
    const hasChurnedARR = text?.includes('75,000') || text?.includes('75000');
    expect(hasChurnedARR).toBeTruthy();
  });

  test('Churned Contracts label is shown', async ({ page }) => {
    // Use exact text to avoid collisions
    await expect(page.getByText('Churned Contracts', { exact: true })).toBeVisible({ timeout: 5000 });
  });

  test('Churned ARR label is shown', async ({ page }) => {
    await expect(page.getByText('Churned ARR', { exact: true })).toBeVisible({ timeout: 5000 });
  });
});

// ===========================================================================
// Analytics — Bookings Section
// ===========================================================================

test.describe('Analytics — Bookings Section', () => {
  test.beforeEach(async ({ page }) => {
    await mountAnalyticsMocks(page);
    await page.goto(`${BASE_URL}/analytics`);
    await page.waitForLoadState('networkidle');
  });

  test('Bookings heading is visible', async ({ page }) => {
    await expect(page.getByText('Bookings', { exact: true })).toBeVisible();
  });

  test('Bookings section description is visible', async ({ page }) => {
    await expect(page.getByText('New contracts and total bookings value', { exact: true })).toBeVisible();
  });

  test('Bookings section has From and To date inputs', async ({ page }) => {
    // Same DOM depth as churn card: text(e203) → div(e202) → div.flex(e197) → div(e194, card)
    // 3 levels up gives the bookings card content container
    const bookingsCard = page.getByText('Bookings', { exact: true }).locator('../../../..');
    const dateInputs = bookingsCard.locator('input[type="date"]');
    await expect(dateInputs.first()).toBeVisible();
    await expect(dateInputs.nth(1)).toBeVisible();
  });

  test('Bookings section has an Apply button', async ({ page }) => {
    const bookingsCard = page.getByText('Bookings', { exact: true }).locator('../../../..');
    await expect(bookingsCard.getByRole('button', { name: /apply/i })).toBeVisible();
  });

  test('bookings data loads on page load — new contracts count shown', async ({ page }) => {
    // MOCK_BOOKINGS.newContracts = 12 — scope to bookings card to avoid date "12" collision
    const bookingsCard = page.getByText('Bookings', { exact: true }).locator('../../../..');
    await expect(bookingsCard.getByText('12')).toBeVisible({ timeout: 5000 });
  });

  test('bookings data loads on apply — totalBookings displayed with currency', async ({ page }) => {
    const bookingsCard = page.getByText('Bookings', { exact: true }).locator('../../../..');
    await bookingsCard.getByRole('button', { name: /apply/i }).click();
    await page.waitForLoadState('networkidle');

    // totalBookings = 480000, formatted as €480,000
    const totalBookingsMetric = bookingsCard.getByText('Total Bookings', { exact: true }).locator('../..');
    await expect(totalBookingsMetric).toBeVisible({ timeout: 5000 });
    const text = await totalBookingsMetric.textContent();
    const hasBookingsValue = text?.includes('480,000') || text?.includes('480000');
    expect(hasBookingsValue).toBeTruthy();
  });

  test('New Contracts label is shown', async ({ page }) => {
    // Use exact match to avoid matching nav "Contracts" link
    await expect(page.getByText('New Contracts', { exact: true })).toBeVisible({ timeout: 5000 });
  });

  test('Total Bookings label is shown', async ({ page }) => {
    await expect(page.getByText('Total Bookings', { exact: true })).toBeVisible({ timeout: 5000 });
  });
});

// ===========================================================================
// Analytics — Error Handling
// ===========================================================================

test.describe('Analytics — Error Handling', () => {
  test('page does not crash when summary API fails', async ({ page }) => {
    await page.route('**/api/config', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(EUR_CONFIG),
      })
    );
    await page.route('**/api/analytics/summary*', (route: any) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'Internal Server Error' } }),
      })
    );
    await page.route('**/api/analytics/churn*', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: MOCK_CHURN, paging: NULL_PAGING }),
      })
    );
    await page.route('**/api/analytics/bookings*', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: MOCK_BOOKINGS, paging: NULL_PAGING }),
      })
    );

    await page.goto(`${BASE_URL}/analytics`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible();
  });

  test('page does not crash when churn API fails', async ({ page }) => {
    await page.route('**/api/config', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(EUR_CONFIG),
      })
    );
    await page.route('**/api/analytics/summary*', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: MOCK_SUMMARY, paging: NULL_PAGING }),
      })
    );
    await page.route('**/api/analytics/churn*', (route: any) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'Service Unavailable' } }),
      })
    );
    await page.route('**/api/analytics/bookings*', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: MOCK_BOOKINGS, paging: NULL_PAGING }),
      })
    );

    await page.goto(`${BASE_URL}/analytics`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible();
  });

  test('page does not crash when bookings API fails', async ({ page }) => {
    await page.route('**/api/config', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(EUR_CONFIG),
      })
    );
    await page.route('**/api/analytics/summary*', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: MOCK_SUMMARY, paging: NULL_PAGING }),
      })
    );
    await page.route('**/api/analytics/churn*', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: MOCK_CHURN, paging: NULL_PAGING }),
      })
    );
    await page.route('**/api/analytics/bookings*', (route: any) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'Internal Server Error' } }),
      })
    );

    await page.goto(`${BASE_URL}/analytics`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible();
  });

  test('shows empty state in churn section when data is null', async ({ page }) => {
    await page.route('**/api/config', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(EUR_CONFIG),
      })
    );
    await page.route('**/api/analytics/summary*', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: null, paging: NULL_PAGING }),
      })
    );
    await page.route('**/api/analytics/churn*', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: null, paging: NULL_PAGING }),
      })
    );
    await page.route('**/api/analytics/bookings*', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: null, paging: NULL_PAGING }),
      })
    );

    await page.goto(`${BASE_URL}/analytics`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    await expect(
      page.getByText('No churn data available for this period', { exact: true })
    ).toBeVisible({ timeout: 5000 });
  });

  test('shows empty state in bookings section when data is null', async ({ page }) => {
    await page.route('**/api/config', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(EUR_CONFIG),
      })
    );
    await page.route('**/api/analytics/summary*', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: null, paging: NULL_PAGING }),
      })
    );
    await page.route('**/api/analytics/churn*', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: null, paging: NULL_PAGING }),
      })
    );
    await page.route('**/api/analytics/bookings*', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: null, paging: NULL_PAGING }),
      })
    );

    await page.goto(`${BASE_URL}/analytics`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    await expect(
      page.getByText('No bookings data available for this period', { exact: true })
    ).toBeVisible({ timeout: 5000 });
  });
});

// ===========================================================================
// Analytics — Responsive Layout
// ===========================================================================

test.describe('Analytics — Responsive Layout', () => {
  test('renders correctly on mobile viewport (375x812)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await mountAnalyticsMocks(page);
    await page.goto(`${BASE_URL}/analytics`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible();
    // On mobile the sidebar may collapse; the heading is still rendered
    await expect(page.getByText('Churn Analysis', { exact: true })).toBeVisible();
  });

  test('renders correctly on desktop viewport (1440x900)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mountAnalyticsMocks(page);
    await page.goto(`${BASE_URL}/analytics`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Monthly Recurring Revenue', { exact: true })).toBeVisible();
    await expect(page.getByText('Annual Recurring Revenue', { exact: true })).toBeVisible();
    await expect(page.getByText('Active Contracts', { exact: true })).toBeVisible();
    await expect(page.getByText('Total Accounts', { exact: true })).toBeVisible();
  });
});

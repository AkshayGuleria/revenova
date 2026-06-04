# Analytics

**Status:** Implemented ✅
**Phase:** Phase 5 — Analytics & Optimization
**Implementation Date:** May 2026
**ADR Compliance:** [ADR-003: REST API Response Structure & Query Parameters](../adrs/003-rest-api-response-structure.md)

---

## Overview

The Analytics module exposes read-only financial metrics derived from the contracts data set. It provides point-in-time snapshots of recurring revenue (MRR/ARR), a combined dashboard summary, and date-range reports for churn and new bookings. All calculations run directly against the Prisma `contract` model — no materialised views or separate analytics store.

## Business Context

- Revenue Operations and Finance need current MRR/ARR figures without writing SQL
- The dashboard summary card powers the frontend KPI strip (MRR, ARR, active contracts, total accounts)
- Churn and bookings reports cover the current fiscal year by default, with optional custom ranges for board packs or ad-hoc analysis
- All monetary values are in EUR (the platform's single currency at this phase)

---

## Calculation Logic

### MRR normalisation

Each active contract contributes to MRR according to its `billingFrequency`:

| Billing frequency | Contribution |
|-------------------|-------------|
| `monthly` | `contractValue` (already per month) |
| `quarterly` | `contractValue / 3` |
| `annual` (default) | `contractValue / 12` |

Any unrecognised `billingFrequency` value falls back to annual (`/ 12`).

### ARR

`ARR = MRR × 12` — computed by calling `getMrr` internally and multiplying.

### Churn annualisation

Churned contract values are annualised for the `churnedArr` field:

| Billing frequency | Annualised value |
|-------------------|-----------------|
| `annual` | `contractValue` |
| `quarterly` | `contractValue × 4` |
| `monthly` | `contractValue × 12` |

### Bookings

`totalBookings` is the raw sum of `contractValue` for new contracts in the date range — **not** annualised. This represents total deal value as signed.

---

## API Endpoints

All analytics endpoints are read-only (`GET`). They return a single data object with all paging fields set to `null` (ADR-003 single-resource shape).

---

### `GET /api/analytics/mrr`

Returns MRR for all active contracts as of a point in time.

**Query parameters:**

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `asOf` | No | today | ISO date string — point in time for the calculation |

**Example request:**
```
GET /api/analytics/mrr?asOf=2026-05-31
```

**Example response (200):**
```json
{
  "data": {
    "asOf": "2026-05-31",
    "mrr": 47250.00,
    "activeContracts": 18
  },
  "paging": {
    "offset": null,
    "limit": null,
    "total": null,
    "totalPages": null,
    "hasNext": null,
    "hasPrev": null
  }
}
```

---

### `GET /api/analytics/arr`

Returns ARR (MRR × 12) for all active contracts as of a point in time.

**Query parameters:** Same as `/mrr` — `asOf` (optional, defaults to today).

**Example response (200):**
```json
{
  "data": {
    "asOf": "2026-05-31",
    "arr": 567000.00,
    "mrr": 47250.00,
    "activeContracts": 18
  },
  "paging": { "offset": null, "limit": null, "total": null, "totalPages": null, "hasNext": null, "hasPrev": null }
}
```

---

### `GET /api/analytics/summary`

Combined dashboard view: MRR, ARR, active contract count, total active accounts.

**Query parameters:** `asOf` (optional, defaults to today).

**Example response (200):**
```json
{
  "data": {
    "asOf": "2026-05-31",
    "mrr": 47250.00,
    "arr": 567000.00,
    "activeContracts": 18,
    "totalAccounts": 7,
    "currency": "EUR"
  },
  "paging": { "offset": null, "limit": null, "total": null, "totalPages": null, "hasNext": null, "hasPrev": null }
}
```

`totalAccounts` counts accounts where `status = 'active'` AND `deletedAt IS NULL`.

---

### `GET /api/analytics/churn`

Returns contracts that moved to `expired` or `cancelled` within the date range, along with their total annualised value lost.

**Query parameters:**

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `from` | No | Start of current year | ISO date string |
| `to` | No | today | ISO date string |

**Validation:** `from` must be before `to`; violating this returns `400`.

**Example request:**
```
GET /api/analytics/churn?from=2026-01-01&to=2026-05-31
```

**Example response (200):**
```json
{
  "data": {
    "from": "2026-01-01",
    "to": "2026-05-31",
    "churnedContracts": 3,
    "churnedArr": 156000.00
  },
  "paging": { "offset": null, "limit": null, "total": null, "totalPages": null, "hasNext": null, "hasPrev": null }
}
```

**Error responses:**
- `400` — `from` date is after `to` date

---

### `GET /api/analytics/bookings`

Returns new contracts created within the date range and their total booked value.

**Query parameters:** Same as `/churn` — `from` and `to`, both optional.

**Example request:**
```
GET /api/analytics/bookings?from=2026-01-01&to=2026-05-31
```

**Example response (200):**
```json
{
  "data": {
    "from": "2026-01-01",
    "to": "2026-05-31",
    "newContracts": 11,
    "totalBookings": 825000.00
  },
  "paging": { "offset": null, "limit": null, "total": null, "totalPages": null, "hasNext": null, "hasPrev": null }
}
```

**Error responses:**
- `400` — `from` date is after `to` date

---

## Implementation Details

### Project Structure

```
src/modules/analytics/
├── analytics.controller.ts
├── analytics.service.ts
├── analytics.module.ts
└── dto/
    └── analytics-query.dto.ts   # AnalyticsPointInTimeDto, AnalyticsDateRangeDto
```

### Key Implementation Notes

1. **No separate analytics store** — all metrics are computed at query time by scanning the `contract` table. Suitable for the current data volumes; a materialised view or time-series cache can be added in a later phase.
2. **`getMrr` reuse** — `getArr` and `getSummary` call `getMrr` internally rather than duplicating the billing-frequency normalisation logic.
3. **`getSummary` parallelism** — uses `Promise.all` to run `contract.count`, `account.count`, and `getMrr` concurrently, minimising latency on the dashboard call.
4. **Default date ranges** — churn and bookings default `from` to start-of-current-year (Jan 1 00:00 local) and `to` to the current moment. The `_startOfYear()` helper sets month=0, day=1, time=00:00:00.000.
5. **Monetary precision** — all monetary outputs use `parseFloat(value.toFixed(2))` — two decimal places, returned as a JSON number.
6. **`asOf` window** — active contracts are filtered by `startDate <= asOf` AND `endDate >= asOf`, giving a true point-in-time snapshot.

---

## Testing

**Service spec:** `src/modules/analytics/analytics.service.spec.ts`

Test scenarios covered:

| Scenario | Assertion |
|----------|-----------|
| getMrr — no contracts | `mrr: 0`, `activeContracts: 0` |
| getMrr — annual | `contractValue / 12` |
| getMrr — quarterly | `contractValue / 3` |
| getMrr — monthly | `contractValue` unchanged |
| getMrr — mixed frequencies | correct aggregate |
| getMrr — unrecognised frequency | falls back to annual (`/ 12`) |
| getMrr — no `asOf` | defaults to today |
| getMrr — query shape | `startDate[lte]` / `endDate[gte]` used |
| getArr — happy path | `arr = mrr * 12` |
| getArr — no contracts | `arr: 0`, `mrr: 0` |
| getArr — carries activeContracts | count preserved |
| getSummary — combined | mrr, arr, counts, currency `EUR` all present |
| getSummary — paging shape | all paging fields null |
| getChurn — annualisation | annual/quarterly/monthly contracts annualised correctly |
| getChurn — no churn | `churnedContracts: 0`, `churnedArr: 0` |
| getChurn — status filter | queries `status: { in: ['expired', 'cancelled'] }` |
| getChurn — invalid range | `BadRequestException` when `from > to` |
| getBookings — sum | `totalBookings` is raw sum of `contractValue` |
| getBookings — no contracts | `newContracts: 0`, `totalBookings: 0` |
| getBookings — date filter | `createdAt: { gte, lte }` used |
| getBookings — invalid range | `BadRequestException` when `from > to` |
| getBookings — fractional values | rounding to 2dp correct |

**Run tests:**
```bash
cd packages/revenue-backend
npx jest analytics --no-coverage
```

---

## Usage Examples

**Current MRR:**
```bash
curl http://localhost:5177/api/analytics/mrr
```

**Dashboard summary as of a specific date:**
```bash
curl "http://localhost:5177/api/analytics/summary?asOf=2026-03-31"
```

**Year-to-date churn:**
```bash
curl "http://localhost:5177/api/analytics/churn?from=2026-01-01&to=2026-05-31"
```

**Q1 bookings:**
```bash
curl "http://localhost:5177/api/analytics/bookings?from=2026-01-01&to=2026-03-31"
```

---

## Performance

- All analytics queries run against the `contract` table's `status`, `startDate`, `endDate`, and `createdAt` columns — ensure these are indexed
- `getSummary` fires three Prisma queries in parallel (`Promise.all`) — total latency is bounded by the slowest query rather than their sum
- For large contract counts (> 10k), consider adding a materialised view for MRR pre-aggregation and refreshing it nightly via the BullMQ job scheduler

---

## Security

- All endpoints are read-only (`GET`)
- No user-supplied values are interpolated into raw SQL — all filtering uses Prisma's typed query builder
- `asOf`, `from`, `to` validated as ISO date strings via `class-validator`'s `@IsDateString()`

---

## Related Features

- [Contracts](./contracts.md)
- [Billing Engine](./billing.md)
- [Renewals](./renewals.md)

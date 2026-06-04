# Renewals

**Status:** Implemented ✅
**Phase:** Phase 5 — Analytics & Optimization
**Implementation Date:** May 2026
**ADR Compliance:** [ADR-003: REST API Response Structure & Query Parameters](../adrs/003-rest-api-response-structure.md)

---

## Overview

The Renewals module provides proactive contract lifecycle management. It surfaces contracts that are approaching expiry or have already lapsed, computes renewal status for individual contracts, and exposes a one-click renewal action that extends a contract's end date by one year.

## Business Context

- Customer Success and Sales teams need a prioritised list of upcoming renewals to act on before contracts lapse
- Contracts that are still `active` but past their `endDate` represent a data quality risk and a potential churn signal — the `overdue` endpoint makes these visible
- The `renew` action provides a simple administrative shortcut for extending a contract without recreating it; it mutates only `endDate` and leaves all other contract fields unchanged

---

## Renewal Status Classification

The `renewalStatus` field is computed dynamically from the contract's current state:

| Condition | `renewalStatus` |
|-----------|----------------|
| `status` is `expired` or `cancelled` | `expired` |
| `status` is `active` and `endDate < today` | `overdue` |
| `status` is `active` and `daysUntilExpiry <= 90` | `expiring_soon` |
| `status` is `active` and `daysUntilExpiry > 90` | `active` |

`daysUntilExpiry` is `ceil((endDate - today) / 86_400_000)`. For overdue contracts this value will be negative.

---

## API Endpoints

### `GET /api/renewals/upcoming`

Returns active contracts expiring within the next N days, ordered by `endDate` ascending (soonest first). Each item includes a computed `daysUntilExpiry` field.

**Query parameters:**

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `days` | No | `90` | Lookahead window in days |
| `offset[eq]` | No | `0` | Pagination offset |
| `limit[eq]` | No | `20` | Page size (max: 100) |

**Example request:**
```
GET /api/renewals/upcoming?days=60&offset[eq]=0&limit[eq]=10
```

**Example response (200):**
```json
{
  "data": [
    {
      "id": "contract-uuid",
      "contractNumber": "CNT-2026-001",
      "status": "active",
      "autoRenew": true,
      "endDate": "2026-07-15T00:00:00.000Z",
      "accountId": "account-uuid",
      "account": { "id": "account-uuid", "accountName": "Acme Corp" },
      "daysUntilExpiry": 41
    }
  ],
  "paging": {
    "offset": 0,
    "limit": 10,
    "total": 5,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  }
}
```

---

### `GET /api/renewals/overdue`

Returns active contracts whose `endDate` is in the past (i.e., they should have expired but `status` was never updated to `expired`). Each item includes a `daysOverdue` field.

**Query parameters:**

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `offset[eq]` | No | `0` | Pagination offset |
| `limit[eq]` | No | `20` | Page size (max: 100) |

**Example response (200):**
```json
{
  "data": [
    {
      "id": "contract-uuid",
      "contractNumber": "CNT-2025-088",
      "status": "active",
      "endDate": "2026-05-01T00:00:00.000Z",
      "account": { "id": "account-uuid", "accountName": "Beta Ltd" },
      "daysOverdue": 33
    }
  ],
  "paging": {
    "offset": 0,
    "limit": 20,
    "total": 1,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  }
}
```

---

### `GET /api/renewals/:contractId/status`

Returns the computed renewal status for a single contract.

**Path parameter:** `contractId` — UUID of the contract.

**Example response (200):**
```json
{
  "data": {
    "contractId": "contract-uuid",
    "contractNumber": "CNT-2026-001",
    "accountId": "account-uuid",
    "accountName": "Acme Corp",
    "endDate": "2026-07-15",
    "daysUntilExpiry": 41,
    "autoRenew": true,
    "renewalStatus": "expiring_soon"
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

**Error responses:**
- `404` — contract not found

---

### `POST /api/renewals/:contractId/renew`

Renew a contract by extending its `endDate` by exactly one calendar year. Only `active` contracts can be renewed.

**Path parameter:** `contractId` — UUID of the contract.

**Request body:** None.

**Example response (200):**
```json
{
  "data": {
    "id": "contract-uuid",
    "contractNumber": "CNT-2026-001",
    "status": "active",
    "endDate": "2027-07-15T00:00:00.000Z",
    "autoRenew": true,
    "account": { "id": "account-uuid", "accountName": "Acme Corp" }
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

**Error responses:**
- `400` — contract is not `active` (e.g. `expired` or `cancelled`)
- `404` — contract not found

---

## Implementation Details

### Project Structure

```
src/modules/renewals/
├── renewals.controller.ts
├── renewals.service.ts
└── renewals.module.ts
```

No DTOs — the module uses primitive query parameters parsed inline in the controller.

### Key Business Rules

1. **Upcoming window** — `endDate` must be `>= today` AND `<= today + days`. This means contracts expiring today appear in `upcoming` (not `overdue`).
2. **Overdue detection** — queries for `status: 'active'` with `endDate < today`. The contract must still be `active`; truly expired contracts (status updated) are excluded.
3. **`daysUntilExpiry` / `daysOverdue` computation** — added to each result in the service layer via `Array.map`; not a DB-computed column.
4. **Renew mutation** — sets `newEndDate = endDate + 1 year` via `setFullYear(year + 1)`. The only modified field is `endDate`; no audit fields or status changes are applied by this action.
5. **Renew guard** — rejects any contract with `status !== 'active'`. This includes `expired`, `cancelled`, and `draft`.
6. **Pagination** — both list endpoints use `buildPaginatedListResponse` with offset/limit; `limit` is capped at 100 in the controller.

---

## Testing

**Service spec:** `src/modules/renewals/renewals.service.spec.ts`

Test scenarios covered:

| Scenario | Assertion |
|----------|-----------|
| getUpcoming — contract expiring in 60 days | returned with correct `daysUntilExpiry` (±1 day tolerance) |
| getUpcoming — custom `days`, `offset`, `limit` | Prisma `skip`/`take` match, paging metadata correct |
| getUpcoming — no expiring contracts | empty data, total 0 |
| getOverdue — contract 30 days past end | returned with correct `daysOverdue` |
| getOverdue — no overdue contracts | empty data |
| getStatus — `<= 90 days` remaining | `renewalStatus: 'expiring_soon'` |
| getStatus — overdue active contract | `renewalStatus: 'overdue'`, negative `daysUntilExpiry` |
| getStatus — `> 90 days` remaining | `renewalStatus: 'active'` |
| getStatus — `status: 'expired'` | `renewalStatus: 'expired'` |
| getStatus — `status: 'cancelled'` | `renewalStatus: 'expired'` |
| getStatus — not found | `NotFoundException` |
| getStatus — includes `accountName` and ISO `endDate` | format validated |
| renew — active contract | `endDate` extended by 1 year, only `endDate` mutated |
| renew — expired contract | `BadRequestException` |
| renew — cancelled contract | `BadRequestException` |
| renew — not found | `NotFoundException` |
| renew — preserves all other fields | `contractNumber`, `autoRenew`, `totalValue` unchanged |

**Run tests:**
```bash
cd packages/revenue-backend
npx jest renewals --no-coverage
```

---

## Usage Examples

**List contracts expiring in the next 30 days:**
```bash
curl "http://localhost:5177/api/renewals/upcoming?days=30"
```

**List all overdue active contracts:**
```bash
curl "http://localhost:5177/api/renewals/overdue"
```

**Check renewal status for a specific contract:**
```bash
curl "http://localhost:5177/api/renewals/contract-uuid/status"
```

**Renew a contract:**
```bash
curl -X POST "http://localhost:5177/api/renewals/contract-uuid/renew"
```

---

## Performance

- `endDate` and `status` on the `contract` table should be indexed; the upcoming and overdue queries both filter on both columns simultaneously
- Results are ordered by `endDate ASC`, which benefits from the index on `endDate`
- `daysUntilExpiry` / `daysOverdue` are computed in JS after the DB fetch — no additional query round-trips

---

## Security

- `renew` is an idempotent mutation — calling it multiple times simply shifts the end date forward by one year each time
- The action is not guarded by authorization at this phase — access control should be layered on top in a future auth phase
- No financial data is mutated; only `endDate` is updated

---

## Related Features

- [Contracts](./contracts.md)
- [Analytics](./analytics.md)
- [Audit Log](./audit-log.md)
- [Webhooks](./webhooks.md) — `contract.renewed` and `contract.expiring` events dispatched on lifecycle changes

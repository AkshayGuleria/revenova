# Credit Management

**Status:** Implemented ✅
**Phase:** Phase 4 — Enterprise Operations
**Implementation Date:** April 2026
**ADR Compliance:** [ADR-003: REST API Response Structure & Query Parameters](../adrs/003-rest-api-response-structure.md)

---

## Overview

Provides per-account credit limit tracking and a credit hold guard that blocks invoice creation for accounts whose credit is suspended. Credit data lives on the `Account` model. Two dedicated endpoints on the Accounts API expose credit status reads and updates. A NestJS `CanActivate` guard (`CreditHoldGuard`) is applied to mutation endpoints to enforce the hold at the application layer.

## Business Context

- Enterprise B2B vendors extend credit terms to customers; a credit limit caps the total outstanding receivables permitted at any time
- When a customer is delinquent, the billing team places them on "credit hold" — this prevents new invoices from being issued until balances are resolved
- Real-time credit utilisation (`totalOutstanding / creditLimit × 100`) gives AR teams an at-a-glance risk view without running manual reports
- The guard prevents invoice creation at the API layer without requiring application code changes in the invoices module

---

## Data Model

Credit fields live on the `Account` model (no separate table):

```prisma
model Account {
  ...
  creditLimit   Decimal?  @map("credit_limit") @db.Decimal(12, 2)
  creditHold    Boolean   @default(false) @map("credit_hold")
  ...
}
```

`creditLimit` — maximum outstanding invoice balance allowed (in the account's currency). `null` means no limit enforced.

`creditHold` — boolean flag. When `true`, the `CreditHoldGuard` blocks any endpoint whose request body contains `accountId`.

---

## Credit Hold Guard

**File:** `src/modules/credit-management/credit-hold.guard.ts`

The guard implements NestJS `CanActivate`. It inspects `request.body.accountId` and queries the account's `creditHold` field:

```
If accountId is absent from request body  → allow (guard is a no-op)
If account not found                       → allow (NotFoundException raised elsewhere)
If account.creditHold === false            → allow
If account.creditHold === true             → throw ForbiddenException(
    "Account is on credit hold. Contact billing to resolve before creating invoices."
  )
```

The guard is exported from `CreditManagementModule` and must be explicitly applied to controllers via `@UseGuards(CreditHoldGuard)`. It is currently wired to the invoice creation endpoint.

**Module:** `src/modules/credit-management/credit-management.module.ts`

```typescript
@Module({
  imports: [PrismaModule],
  providers: [CreditHoldGuard],
  exports: [CreditHoldGuard],
})
export class CreditManagementModule {}
```

---

## API Endpoints

Both credit endpoints are sub-routes of the Accounts controller (`src/modules/accounts/accounts.controller.ts`).

### GET /api/accounts/:id/credit-status

Returns the current credit utilisation snapshot for an account.

Calculates `totalOutstanding` as the sum of `total` across all invoices in `sent` or `overdue` status for the account.

**Response (200):**

```json
{
  "data": {
    "accountId": "a1b2c3d4-...",
    "accountName": "ACME Corp",
    "currency": "EUR",
    "creditLimit": 100000,
    "creditHold": false,
    "totalOutstanding": 43250.00,
    "availableCredit": 56750.00,
    "utilizationPercent": 43.25
  },
  "paging": { "offset": null, "limit": null, "total": null, "totalPages": null, "hasNext": null, "hasPrev": null }
}
```

**Field definitions:**

| Field | Type | Description |
|-------|------|-------------|
| `creditLimit` | number \| null | Maximum allowed outstanding. `null` = no limit configured |
| `creditHold` | boolean | Whether the account is currently on hold |
| `totalOutstanding` | number | Sum of `total` for invoices with status `sent` or `overdue` |
| `availableCredit` | number \| null | `creditLimit - totalOutstanding`. `null` when no limit set |
| `utilizationPercent` | number \| null | `(totalOutstanding / creditLimit) * 100`, rounded to 2 dp. `null` when no limit set or limit is 0 |

**Error:** 404 if account not found.

---

### PATCH /api/accounts/:id/credit

Update `creditLimit` and/or `creditHold` on an account. Pass only the fields you want to change.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `creditLimit` | number | No | New credit limit (positive). Set to `0` to remove limit intent (note: Prisma stores as 0, not null) |
| `creditHold` | boolean | No | `true` to place on hold, `false` to release |

**Example — place on hold:**

```json
{ "creditHold": true }
```

**Example — set credit limit and release hold:**

```json
{ "creditLimit": 150000, "creditHold": false }
```

**Response (200):** Updated full account object.

**Error:** 404 if account not found.

---

## CreditHoldGuard: How It Integrates

The guard intercepts any controller method decorated with `@UseGuards(CreditHoldGuard)` before the handler runs:

1. Reads `request.body.accountId`
2. Queries `prisma.account.findUnique({ where: { id: accountId }, select: { creditHold, accountName } })`
3. If `creditHold === true`, throws `ForbiddenException` (HTTP 403)
4. Otherwise returns `true` (request proceeds)

**Edge cases handled:**
- No `accountId` in body → guard passes (guard is a no-op; account validation is left to the service)
- Account not found → guard passes (404 is raised by the service)

**Applying the guard to a new endpoint:**

```typescript
import { UseGuards } from '@nestjs/common';
import { CreditHoldGuard } from '../credit-management/credit-hold.guard';

@Post()
@UseGuards(CreditHoldGuard)
create(@Body() dto: CreateInvoiceDto) { ... }
```

---

## Testing

**File:** `src/modules/credit-management/credit-hold.guard.spec.ts`

**Test scenarios (7 cases):**

| Test | Assertion |
|------|-----------|
| Account not on credit hold | Guard returns `true` — request passes |
| Account on credit hold | Throws `ForbiddenException` |
| ForbiddenException message | Contains billing contact instruction |
| No `accountId` in body | Guard returns `true` (no DB call) |
| Body is empty | Guard returns `true` (no DB call) |
| Account not found | Guard returns `true` (404 handled by service) |
| Correct account queried | Uses `accountId` from body for the DB lookup |

**Run tests:**

```bash
cd packages/revenue-backend
npx jest credit-hold --no-coverage
```

---

## Usage Examples

**Check credit status before issuing a large invoice:**

```bash
curl http://localhost:5177/api/accounts/a1b2c3d4-.../credit-status
```

**Place account on credit hold:**

```bash
curl -X PATCH http://localhost:5177/api/accounts/a1b2c3d4-.../credit \
  -H "Content-Type: application/json" \
  -d '{ "creditHold": true }'
```

**Set a €100,000 credit limit:**

```bash
curl -X PATCH http://localhost:5177/api/accounts/a1b2c3d4-.../credit \
  -H "Content-Type: application/json" \
  -d '{ "creditLimit": 100000, "creditHold": false }'
```

**Release a credit hold:**

```bash
curl -X PATCH http://localhost:5177/api/accounts/a1b2c3d4-.../credit \
  -H "Content-Type: application/json" \
  -d '{ "creditHold": false }'
```

---

## Performance

- `getCreditStatus` uses `prisma.invoice.aggregate` with a single SUM query — O(1) DB round trips
- `CreditHoldGuard` performs a single indexed primary-key lookup per guarded request; no joins

---

## Security

- `CreditHoldGuard` returns HTTP 403 with a clear message directing users to contact billing — does not expose internal account state beyond the hold status
- Guard gracefully skips when no `accountId` is in the body, preventing accidental lockouts on non-account-scoped endpoints

---

## Future Enhancements

- Automatic credit hold triggering when `utilizationPercent` exceeds a configurable threshold
- Webhook event emission on credit hold state change for downstream notification
- Credit hold audit trail (who placed/released hold and when)

---

## Related Features

- [Accounts](./accounts.md)
- [Invoices](./invoices.md)
- [Payments](./payments.md)

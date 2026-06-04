# Payments

**Status:** Implemented ✅
**Phase:** Phase 4 — Enterprise Operations
**Implementation Date:** April 2026
**ADR Compliance:** [ADR-003: REST API Response Structure & Query Parameters](../adrs/003-rest-api-response-structure.md)

---

## Overview

Records and manages customer payments against invoices. Supports both direct-linked payments (invoice known at payment time) and unlinked payments that can be applied to an invoice later. All invoice `paidAmount` and `status` updates are performed inside a single DB transaction to ensure ACID consistency.

## Business Context

- Enterprise B2B payments often arrive via bank transfer days after an invoice is issued — the payment reference number must be recorded and later matched to the invoice
- Partial payments are common; the system tracks `paidAmount` separately from `total` and maintains `partially_paid` status
- Voiding a payment reverses all invoice accounting — critical for correcting bank errors or returned payments
- The two-phase flow (record → apply) supports accounts payable teams who receive bulk remittances

---

## Data Model

```prisma
model Payment {
  id              String    @id @default(uuid())
  paymentNumber   String    @unique @map("payment_number")
  accountId       String    @map("account_id")
  invoiceId       String?   @map("invoice_id")
  amount          Decimal   @db.Decimal(12, 2)
  currency        String    @default("EUR")
  method          String    @default("bank_transfer")
  referenceNumber String?   @map("reference_number")
  paymentDate     DateTime  @map("payment_date") @db.Date
  notes           String?
  status          String    @default("applied")
  metadata        Json?
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  account         Account   @relation(fields: [accountId], references: [id])
  invoice         Invoice?  @relation(fields: [invoiceId], references: [id])
}
```

### Payment Status Values

| Status | Meaning |
|--------|---------|
| `applied` | Payment is linked to an invoice and counted toward `paidAmount` |
| `voided` | Payment has been reversed; invoice `paidAmount` decremented |

(The schema allows `pending`, `partially_applied`, `refunded` — only `applied` and `voided` are used by this service.)

### Payment Methods

`bank_transfer` | `credit_card` | `ach` | `check` | `wire` | `other`

---

## Invoice Status Transitions on Payment

When a payment is applied to an invoice, the invoice status is automatically updated:

```
newPaidAmount = invoice.paidAmount + payment.amount

if newPaidAmount >= invoice.total  → status = "paid",           paidDate = now()
if newPaidAmount > 0               → status = "partially_paid"
else                               → status unchanged
```

When a payment is voided:

```
newPaidAmount = max(0, invoice.paidAmount - payment.amount)

if newPaidAmount <= 0 and was "paid" → status = "sent"
if newPaidAmount > 0                 → status = "partially_paid"
paidDate = null
```

---

## API Endpoints

### POST /api/payments

Record a payment. Optionally link it directly to an invoice at creation time.

All invoice `paidAmount` / `status` updates execute in the same DB transaction as the payment insert.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `paymentNumber` | string | Yes | Unique payment reference (e.g. `PAY-2026-001`) |
| `accountId` | UUID | Yes | Account this payment belongs to |
| `invoiceId` | UUID | No | Invoice to immediately apply against |
| `amount` | number | Yes | Positive decimal amount |
| `currency` | string | No | ISO 4217, defaults to `EUR` |
| `method` | enum | Yes | One of: `bank_transfer`, `credit_card`, `ach`, `check`, `wire`, `other` |
| `referenceNumber` | string | No | Bank transaction ID or check number |
| `paymentDate` | ISO date | Yes | Date payment was received |
| `notes` | string | No | Internal notes |

**Example request:**

```json
{
  "paymentNumber": "PAY-2026-001",
  "accountId": "a1b2c3d4-...",
  "invoiceId": "inv-uuid",
  "amount": 5000,
  "currency": "EUR",
  "method": "bank_transfer",
  "referenceNumber": "TXN-ABC-123",
  "paymentDate": "2026-05-31"
}
```

**Response (201):**

```json
{
  "data": {
    "id": "pay-uuid",
    "paymentNumber": "PAY-2026-001",
    "amount": "5000.00",
    "currency": "EUR",
    "method": "bank_transfer",
    "status": "applied",
    "paymentDate": "2026-05-31T00:00:00.000Z",
    "account": { "id": "a1b2c3d4-...", "accountName": "ACME Corp" },
    "invoice": {
      "id": "inv-uuid",
      "invoiceNumber": "INV-2026-001",
      "total": "5000.00",
      "paidAmount": "5000.00"
    }
  },
  "paging": { "offset": null, "limit": null, "total": null, "totalPages": null, "hasNext": null, "hasPrev": null }
}
```

**Error responses:**

| Status | Condition |
|--------|-----------|
| 404 | `accountId` not found |
| 404 | `invoiceId` not found |
| 400 | `invoiceId` does not belong to the specified `accountId` |
| 409 | `paymentNumber` already exists |

---

### GET /api/payments

Paginated list with ADR-003 operator-based filtering.

**Query parameters:**

| Parameter | Example | Description |
|-----------|---------|-------------|
| `accountId[eq]` | `uuid` | Filter by account |
| `invoiceId[eq]` | `uuid` | Filter by invoice |
| `status[eq]` | `applied` | Filter by status |
| `method[eq]` | `bank_transfer` | Filter by payment method |
| `paymentDate[gte]` | `2026-01-01` | Paid on or after |
| `paymentDate[lte]` | `2026-12-31` | Paid on or before |
| `amount[gte]` | `1000` | Amount at least |
| `offset` | `0` | Pagination offset (default: 0) |
| `limit` | `20` | Page size (default: 20, max: 100) |

**Response (200):**

```json
{
  "data": [
    {
      "id": "pay-uuid",
      "paymentNumber": "PAY-2026-001",
      "amount": "5000.00",
      "method": "bank_transfer",
      "status": "applied",
      "account": { "id": "a1b2c3d4-...", "accountName": "ACME Corp" },
      "invoice": { "id": "inv-uuid", "invoiceNumber": "INV-2026-001" }
    }
  ],
  "paging": {
    "offset": 0,
    "limit": 20,
    "total": 87,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  }
}
```

---

### GET /api/payments/:id

Retrieve a single payment by UUID. Includes account and invoice summaries (with `total`, `paidAmount`, and `status`).

**Error:** 404 if not found.

---

### POST /api/payments/:id/apply

Apply a previously unlinked payment to an invoice. Validates that payment and invoice belong to the same account.

Updates invoice `paidAmount` and `status` in a DB transaction.

**Request body:**

```json
{ "invoiceId": "inv-uuid" }
```

**Response (200):** Updated payment object with linked invoice summary.

**Error responses:**

| Status | Condition |
|--------|-----------|
| 404 | Payment not found |
| 404 | Invoice not found |
| 400 | Payment already linked to an invoice |
| 400 | Payment has been voided |
| 400 | Invoice belongs to a different account than the payment |

---

### DELETE /api/payments/:id

Void a payment. Reverses the invoice `paidAmount` decrement (clamped to 0) and resets invoice status. Returns the updated payment with `status: "voided"`.

**Response (200):** Payment with `status: "voided"`.

**Error responses:**

| Status | Condition |
|--------|-----------|
| 404 | Payment not found |
| 400 | Payment is already voided |

---

## Implementation Details

**Module path:** `src/modules/payments/`

**Files:**
- `payments.controller.ts` — REST endpoints
- `payments.service.ts` — business logic
- `payments.module.ts` — NestJS module
- `dto/create-payment.dto.ts` — creation DTO with `@IsIn` validation on `method`
- `dto/apply-payment.dto.ts` — single `invoiceId` UUID

**Key business rules:**
1. All invoice accounting (paidAmount, status, paidDate) happens inside `prisma.$transaction`
2. `currency` defaults to `EUR` when not provided
3. Payments are always created with `status: "applied"` (even unlinked — service doesn't use `pending`)
4. `void` operation clamps `newPaidAmount` to minimum 0 to prevent negative values
5. Account ownership is validated before applying a payment to an invoice
6. Duplicate `paymentNumber` raises 409 (Prisma P2002)

---

## Testing

**File:** `src/modules/payments/payments.service.spec.ts`

**Test scenarios (26 cases):**

| Suite | Tests |
|-------|-------|
| `create` | Auto-marks invoice `paid` when fully paid; creates without invoice link; sets `partially_paid` on partial payment; 404 for unknown account; 404 for unknown invoice; 400 when invoice belongs to different account; 409 on duplicate `paymentNumber` |
| `findAll` | Returns paginated list; passes where clause from query filters |
| `findOne` | Returns payment by id; 404 for unknown id |
| `applyToInvoice` | Applies unlinked payment; 400 if already applied; 400 if voided; 404 unknown payment; 404 unknown invoice; 400 when account mismatch |
| `void` | Voids payment and reverses invoice `paidAmount`; voids without linked invoice; 400 if already voided; 404 unknown payment |

**Run tests:**

```bash
cd packages/revenue-backend
npx jest payments --no-coverage
```

---

## Usage Examples

**Record a payment linked to an invoice:**

```bash
curl -X POST http://localhost:5177/api/payments \
  -H "Content-Type: application/json" \
  -d '{
    "paymentNumber": "PAY-2026-001",
    "accountId": "a1b2c3d4-...",
    "invoiceId": "inv-uuid",
    "amount": 5000,
    "method": "bank_transfer",
    "paymentDate": "2026-05-31"
  }'
```

**Record an unlinked payment:**

```bash
curl -X POST http://localhost:5177/api/payments \
  -H "Content-Type: application/json" \
  -d '{
    "paymentNumber": "PAY-2026-002",
    "accountId": "a1b2c3d4-...",
    "amount": 12500,
    "method": "wire",
    "referenceNumber": "WIRE-XYZ-9999",
    "paymentDate": "2026-06-01"
  }'
```

**Apply an unlinked payment to an invoice:**

```bash
curl -X POST http://localhost:5177/api/payments/pay-uuid/apply \
  -H "Content-Type: application/json" \
  -d '{ "invoiceId": "inv-uuid" }'
```

**Void a payment:**

```bash
curl -X DELETE http://localhost:5177/api/payments/pay-uuid
```

**List all payments for an account in June 2026:**

```bash
curl "http://localhost:5177/api/payments?accountId[eq]=a1b2c3d4-...&paymentDate[gte]=2026-06-01&paymentDate[lte]=2026-06-30"
```

---

## Performance

- Indexed on `accountId`, `invoiceId`, `paymentDate`, `status` via standard Prisma foreign-key indices
- `findAll` uses parallel `findMany` + `count` via `Promise.all`
- Orders by `paymentDate DESC` by default

---

## Security

- Financial mutations (payment create, void, apply) all execute inside `prisma.$transaction` — ACID compliant
- Account ownership is cross-checked before applying a payment to an invoice
- `paymentNumber` uniqueness enforced at DB level

---

## Related Features

- [Invoices](./invoices.md)
- [Accounts](./accounts.md)
- [Credit Management](./credit-management.md)
- [Purchase Orders](./purchase-orders.md)

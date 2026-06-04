# Purchase Orders

**Status:** Implemented ✅
**Phase:** Phase 4 — Enterprise Operations
**Implementation Date:** April 2026
**ADR Compliance:** [ADR-003: REST API Response Structure & Query Parameters](../adrs/003-rest-api-response-structure.md)

---

## Overview

Provides a full lifecycle workflow for enterprise purchase orders (POs). A PO represents a buyer's commitment to purchase goods or services from a vendor at a specified amount. POs are linked to an Account and optionally to a Contract, and flow through an approval workflow before they can be considered active.

## Business Context

- Enterprise procurement teams issue POs before invoices are generated; vendors need a PO reference to bill against
- POs act as a budget control mechanism — a PO must be `approved` before it authorises payment
- Linking a PO to a Contract ties procurement to the negotiated commercial agreement
- The `fulfilled` status signals that the PO has been fully invoiced against

---

## Data Model

```prisma
model PurchaseOrder {
  id              String    @id @default(uuid())
  poNumber        String    @unique @map("po_number")
  accountId       String    @map("account_id")
  contractId      String?   @map("contract_id")
  description     String?
  amount          Decimal   @db.Decimal(12, 2)
  currency        String    @default("EUR")
  issueDate       DateTime  @map("issue_date") @db.Date
  expiryDate      DateTime? @map("expiry_date") @db.Date
  status          String    @default("pending_approval")
  approvedById    String?   @map("approved_by_id")
  approvedAt      DateTime? @map("approved_at")
  rejectedById    String?   @map("rejected_by_id")
  rejectedAt      DateTime? @map("rejected_at")
  rejectionReason String?   @map("rejection_reason")
  notes           String?
  metadata        Json?
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  account         Account   @relation(fields: [accountId], references: [id])
  contract        Contract? @relation(fields: [contractId], references: [id])

  @@index([accountId])
  @@index([contractId])
  @@index([status])
  @@map("purchase_orders")
}
```

### PO Status Lifecycle

```
pending_approval → approved   (via POST /:id/approve)
pending_approval → rejected   (via POST /:id/reject)
pending_approval → cancelled  (via DELETE /:id)
approved         → fulfilled  (external process — not exposed via this API)
approved         → cancelled  (via DELETE /:id)
rejected         → cancelled  (via DELETE /:id)
```

Terminal states: `fulfilled`, `cancelled` — cannot be cancelled again.

---

## API Endpoints

### POST /api/purchase-orders

Create a new purchase order. Status is always set to `pending_approval` on creation.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `poNumber` | string | Yes | Unique PO identifier (e.g. `PO-ACME-2026-001`) |
| `accountId` | UUID | Yes | Account this PO belongs to |
| `contractId` | UUID | No | Optional link to a contract |
| `description` | string | No | Description of the purchase |
| `amount` | number | Yes | Positive decimal amount |
| `currency` | string | No | ISO 4217 code, defaults to `EUR` |
| `issueDate` | ISO date | Yes | Date the PO was issued |
| `expiryDate` | ISO date | No | Optional expiry date |
| `notes` | string | No | Internal notes |
| `metadata` | object | No | Arbitrary key-value pairs |

**Example request:**

```json
{
  "poNumber": "PO-ACME-2026-001",
  "accountId": "a1b2c3d4-...",
  "contractId": "e5f6g7h8-...",
  "description": "Annual software license renewal",
  "amount": 50000,
  "currency": "EUR",
  "issueDate": "2026-01-15",
  "expiryDate": "2026-12-31"
}
```

**Response (201):**

```json
{
  "data": {
    "id": "po-uuid",
    "poNumber": "PO-ACME-2026-001",
    "status": "pending_approval",
    "amount": "50000.00",
    "currency": "EUR",
    "issueDate": "2026-01-15T00:00:00.000Z",
    "expiryDate": "2026-12-31T00:00:00.000Z",
    "account": { "id": "a1b2c3d4-...", "accountName": "ACME Corp" },
    "contract": { "id": "e5f6g7h8-...", "contractNumber": "CTR-2026-001" },
    "createdAt": "2026-01-15T10:00:00.000Z",
    "updatedAt": "2026-01-15T10:00:00.000Z"
  },
  "paging": { "offset": null, "limit": null, "total": null, "totalPages": null, "hasNext": null, "hasPrev": null }
}
```

**Error responses:**

| Status | Code | Condition |
|--------|------|-----------|
| 404 | NOT_FOUND | `accountId` or `contractId` not found |
| 409 | CONFLICT | `poNumber` already exists |

---

### GET /api/purchase-orders

Paginated list with ADR-003 operator-based filtering.

**Query parameters:**

| Parameter | Example | Description |
|-----------|---------|-------------|
| `status[eq]` | `pending_approval` | Filter by exact status |
| `status[in]` | `pending_approval,approved` | Filter by multiple statuses |
| `accountId[eq]` | `uuid` | Filter by account |
| `contractId[eq]` | `uuid` | Filter by contract |
| `amount[gte]` | `10000` | Amount at least |
| `amount[lte]` | `100000` | Amount at most |
| `issueDate[gte]` | `2026-01-01` | Issued on or after |
| `issueDate[lte]` | `2026-12-31` | Issued on or before |
| `offset` | `0` | Pagination offset (default: 0) |
| `limit` | `20` | Page size (default: 20, max: 100) |

**Response (200):**

```json
{
  "data": [
    {
      "id": "po-uuid",
      "poNumber": "PO-ACME-2026-001",
      "status": "pending_approval",
      "amount": "50000.00",
      "currency": "EUR",
      "account": { "id": "a1b2c3d4-...", "accountName": "ACME Corp" }
    }
  ],
  "paging": {
    "offset": 0,
    "limit": 20,
    "total": 45,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
  }
}
```

---

### GET /api/purchase-orders/:id

Retrieve a single PO by UUID. Includes account and contract summaries.

**Response (200):** Single PO object with full fields, paging all null.

**Error:** 404 if not found.

---

### PATCH /api/purchase-orders/:id

Update mutable fields on a PO. Only allowed when status is `pending_approval`.

Updatable fields: `description`, `amount`, `currency`, `expiryDate`, `notes`, `metadata`.

Fields `accountId` and `poNumber` are immutable after creation.

**Error responses:**

| Status | Condition |
|--------|-----------|
| 404 | PO not found |
| 400 | PO is not in `pending_approval` status |

---

### POST /api/purchase-orders/:id/approve

Transition PO from `pending_approval` → `approved`. Records `approvedAt` timestamp.

**Response (200):** Updated PO with `status: "approved"`.

**Error responses:**

| Status | Condition |
|--------|-----------|
| 404 | PO not found |
| 400 | PO is not in `pending_approval` status |

---

### POST /api/purchase-orders/:id/reject

Transition PO from `pending_approval` → `rejected`. Records `rejectedAt` and `rejectionReason`.

**Request body:**

```json
{ "rejectionReason": "Budget not approved for this quarter" }
```

Validation: `rejectionReason` is required with minimum 5 characters.

**Error responses:**

| Status | Condition |
|--------|-----------|
| 404 | PO not found |
| 400 | PO is not in `pending_approval` status |

---

### DELETE /api/purchase-orders/:id

Cancel a PO. Allowed from any status except `fulfilled` and `cancelled`.

**Response (200):** Updated PO with `status: "cancelled"`.

**Error responses:**

| Status | Condition |
|--------|-----------|
| 404 | PO not found |
| 400 | PO is already `fulfilled` or `cancelled` |

---

## Implementation Details

**Module path:** `src/modules/purchase-orders/`

**Files:**
- `purchase-orders.controller.ts` — REST endpoints
- `purchase-orders.service.ts` — business logic
- `purchase-orders.module.ts` — NestJS module wiring
- `dto/create-purchase-order.dto.ts` — creation DTO
- `dto/update-purchase-order.dto.ts` — `PartialType(OmitType(Create, ['accountId', 'poNumber']))` — immutable fields excluded
- `dto/reject-purchase-order.dto.ts` — rejection reason DTO
- `dto/query-purchase-orders.dto.ts` — pagination/filter DTO

**Key business rules:**
1. Status is always forced to `pending_approval` on creation — client cannot set a different initial status
2. Updates are blocked unless status is `pending_approval`
3. `approve` and `reject` are blocked unless status is `pending_approval`
4. `cancel` is blocked only for terminal states (`fulfilled`, `cancelled`)
5. `currency` defaults to `EUR` when not provided
6. Duplicate `poNumber` raises 409 (Prisma P2002 unique constraint)

---

## Testing

**File:** `src/modules/purchase-orders/purchase-orders.service.spec.ts`

**Test scenarios (31 cases):**

| Suite | Tests |
|-------|-------|
| `create` | Creates with `pending_approval` status; throws 404 for unknown account; throws 404 for unknown contract; throws 409 for duplicate `poNumber`; defaults currency to EUR |
| `findAll` | Returns paginated list with defaults; applies offset/limit; passes where filters to Prisma |
| `findOne` | Returns PO by id; throws 404 for unknown id |
| `update` | Updates pending PO; throws 404; throws 400 when not pending |
| `approve` | Approves pending PO; throws 404; throws 400 when not pending |
| `reject` | Rejects pending PO with reason; throws 404; throws 400 when not pending |
| `cancel` | Cancels pending PO; cancels approved PO; throws 404; throws 400 for cancelled; throws 400 for fulfilled |

**Run tests:**

```bash
cd packages/revenue-backend
npx jest purchase-orders --no-coverage
```

---

## Usage Examples

**Create a PO:**

```bash
curl -X POST http://localhost:5177/api/purchase-orders \
  -H "Content-Type: application/json" \
  -d '{
    "poNumber": "PO-ACME-2026-001",
    "accountId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "amount": 50000,
    "currency": "EUR",
    "issueDate": "2026-01-15"
  }'
```

**Approve a PO:**

```bash
curl -X POST http://localhost:5177/api/purchase-orders/po-uuid/approve
```

**Reject with reason:**

```bash
curl -X POST http://localhost:5177/api/purchase-orders/po-uuid/reject \
  -H "Content-Type: application/json" \
  -d '{ "rejectionReason": "Budget not approved for Q1 2026" }'
```

**List pending POs for an account:**

```bash
curl "http://localhost:5177/api/purchase-orders?status[eq]=pending_approval&accountId[eq]=a1b2c3d4-..."
```

---

## Performance

- Indexed on `accountId`, `contractId`, `status` — all common filter axes
- `findAll` uses parallel `findMany` + `count` via `Promise.all`
- Orders by `createdAt DESC` by default

---

## Security

- `poNumber` uniqueness enforced at DB level via `@@unique` constraint
- `accountId` and `contractId` validated against DB before write
- `rejectionReason` has minimum length (5 chars) to prevent empty rejections
- No financial transaction wrapping needed — PO amounts are commitments, not ledger entries

---

## Related Features

- [Contracts](./contracts.md)
- [Accounts](./accounts.md)
- [Payments](./payments.md)
- [Invoices](./invoices.md)

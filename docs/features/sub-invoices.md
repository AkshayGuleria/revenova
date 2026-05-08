# Sub-Invoices Feature

**Status:** In Progress
**Phase:** Phase 4 - Enterprise Operations
**Implementation Date:** TBD
**ADR Compliance:** [ADR-003: REST API Response Structure & Query Parameters](../adrs/003-rest-api-response-structure.md)

---

## Implementation Status

> Last updated: 2026-05-08 | Overall Progress: 0 / 47 tasks complete

### Phase A: Database Schema (0/7)

| # | Task | Status | Notes |
|---|------|--------|-------|
| A1 | Create `InvoiceGroup` model in schema.prisma | Not Started | |
| A2 | Add `@@index` on `invoiceGroupId` and `accountId` for InvoiceGroup | Not Started | |
| A3 | Add `invoiceGroupId String? @map("invoice_group_id")` to `Invoice` | Not Started | |
| A4 | Add proper Prisma self-relation for `parentInvoiceId` | Not Started | Field exists at line ~208 but has no `@relation` |
| A5 | Add `@@index([parentInvoiceId])` and `@@index([invoiceGroupId])` on `Invoice` | Not Started | |
| A6 | Add `groupReference String? @map("group_reference")` to `InvoiceItem` | Not Started | |
| A7 | Generate and validate Prisma migration | Not Started | Blocking all other phases |

### Phase B: Group Management (0/5)

| # | Task | Status | Notes |
|---|------|--------|-------|
| B1 | Create `InvoiceGroupsService` with CRUD methods | Not Started | Independent of Phase C |
| B2 | Create `CreateInvoiceGroupDto` / `UpdateInvoiceGroupDto` | Not Started | |
| B3 | Create `QueryInvoiceGroupsDto` with ADR-003 operators | Not Started | |
| B4 | Create `InvoiceGroupsController` at `/api/invoice-groups` | Not Started | |
| B5 | Register `InvoiceGroupsModule` in `AppModule` | Not Started | |

### Phase C: Core Sub-Invoice Logic (0/8)

| # | Task | Status | Notes |
|---|------|--------|-------|
| C1 | Add `createSubInvoice()` — validates parent exists, assigns `parentInvoiceId` | Not Started | |
| C2 | Add `getSubInvoices(parentId)` — returns children | Not Started | |
| C3 | Add `rollupTotals(parentId)` — recalculates parent subtotal/tax/total in transaction | Not Started | |
| C4 | Status sync: parent `cancelled`/`void` cascades down to sub-invoices | Not Started | See Design Decision 2 |
| C5 | Status sync: sub-invoice `paid` does NOT auto-promote parent | Not Started | See Design Decision 2 |
| C6 | Validate sub-invoice `accountId` matches parent's `accountId` | Not Started | See Design Decision 3 |
| C7 | Sub-invoice numbering: `INV-2026-000042-01` format | Not Started | See Design Decision 1 |
| C8 | Prevent sub-invoices having sub-invoices (depth = 1 max) | Not Started | |

### Phase D: Item Grouping (0/4)

| # | Task | Status | Notes |
|---|------|--------|-------|
| D1 | Add `groupReference` to `CreateInvoiceItemDto` and `UpdateInvoiceItemDto` | Not Started | |
| D2 | Expose `groupReference[eq]` filtering on invoice item queries | Not Started | |
| D3 | Add `getItemsByGroup(invoiceId, groupReference)` | Not Started | |
| D4 | Document `groupReference` vs `InvoiceGroup` distinction | Not Started | See Design Decision 6 |

### Phase E: API Endpoints (0/8)

| # | Task | Status | Notes |
|---|------|--------|-------|
| E1 | `POST /api/invoices/:id/sub-invoices` | Not Started | |
| E2 | `GET /api/invoices/:id/sub-invoices` | Not Started | |
| E3 | `GET /api/invoices/:id/sub-invoices/:subId` | Not Started | |
| E4 | `PATCH /api/invoices/:id/sub-invoices/:subId` | Not Started | |
| E5 | `DELETE /api/invoices/:id/sub-invoices/:subId` | Not Started | |
| E6 | `POST /api/invoices/:id/split` — split by groupReference | Not Started | See Design Decision 5 |
| E7 | `POST /api/invoices/merge` — merge sub-invoices to parent | Not Started | |
| E8 | `POST /api/invoices/:id/rollup` — recalculate parent totals | Not Started | |

### Phase F: Billing Integration (0/5)

| # | Task | Status | Notes |
|---|------|--------|-------|
| F1 | Add `createSubInvoices: boolean` option to `GenerateConsolidatedInvoiceDto` | Not Started | |
| F2 | Update `ConsolidatedBillingService.generateConsolidatedInvoice()` with sub-invoice mode | Not Started | Depends on Phase C |
| F3 | Add `SubInvoiceBillingProcessor` BullMQ processor | Not Started | |
| F4 | Add `parentInvoiceId[eq]` / `parentInvoiceId[null]` to `GET /api/invoices` | Not Started | |
| F5 | Rollup job: recalculate parent totals when sub-invoice is paid | Not Started | |

### Phase G: Testing (0/6)

| # | Task | Status | Notes |
|---|------|--------|-------|
| G1 | Unit tests: `SubInvoicesService` (create, list, rollup, status sync) | Not Started | |
| G2 | Unit tests: `InvoiceGroupsService` (CRUD) | Not Started | |
| G3 | Unit tests: `groupReference` filtering on invoice items | Not Started | |
| G4 | E2E tests: full sub-invoice CRUD workflow | Not Started | `test/sub-invoices.e2e-spec.ts` |
| G5 | E2E tests: split/merge operations | Not Started | |
| G6 | E2E tests: consolidated billing with sub-invoice mode | Not Started | |

### Phase H: Documentation (0/4)

| # | Task | Status | Notes |
|---|------|--------|-------|
| H1 | Complete schema section with actual Prisma snippets | Not Started | This document |
| H2 | Complete API endpoint section with request/response examples | Not Started | This document |
| H3 | Add cURL usage examples for all endpoints | Not Started | This document |
| H4 | Update `docs/features/billing.md` to reference sub-invoice billing mode | Not Started | |

---

## Overview

Sub-invoices enable enterprise customers to group invoice line items into logical organizational units such as departments, cost centers, locations, or custom groups. This allows:

- **Departmental billing** - Individual departments receive their own sub-invoice while the parent account gets a consolidated view
- **Cost center tracking** - Each cost center can track and approve their portion of charges
- **Location-based billing** - Different office locations can be billed separately under one parent invoice
- **Roll-up reporting** - Parent invoice totals are automatically calculated from sub-invoice sums

### Business Context

Large enterprise customers often need to allocate charges across their organizational structure. The `parentInvoiceId` field already exists in the Invoice schema but has no Prisma relationship defined and no supporting service/API logic. This feature formalizes and fully implements that capability, plus adds an `InvoiceGroup` entity for organizational groupings.

Sub-invoices differ from the existing `consolidated` flag because they create a genuine navigable parent-child tree in the database rather than just marking an invoice as having rolled-up from elsewhere.

---

## Design Decisions

| # | Decision | Recommendation | Rationale |
|---|----------|----------------|-----------|
| 1 | Sub-invoice numbering format | `INV-2026-000042-01` | Parent number + 2-digit sequence; makes relationship visible in invoice number |
| 2 | Status cascade rules | Parent `cancelled`/`void` cascades down; sub-invoice `paid` does NOT auto-promote parent | Departments may pay separately; parent status change affects all children |
| 3 | Account ownership | Sub-invoice `accountId` must match parent's `accountId` | Same-account model for Phase 4; subsidiary model deferred to Phase 5 |
| 4 | Rollup totals | `POST /:id/rollup` overwrites parent financials from children sum | Uses Prisma `$transaction`; matches consolidated billing pattern |
| 5 | Split atomicity | Split moves items to sub-invoices atomically; idempotent by `groupReference` | Blocked on `sent`/`paid` parent; prevents partial state |
| 6 | `InvoiceGroup` vs `groupReference` | `InvoiceGroup` = recurring named org unit; `groupReference` on items = ad-hoc per-line tag | Flexibility for both structured and ad-hoc grouping |

---

## Database Schema

Located in: `packages/revenue-backend/prisma/schema.prisma`

### New Model: InvoiceGroup

```prisma
model InvoiceGroup {
  id          String   @id @default(uuid())
  accountId   String   @map("account_id")
  name        String
  description String?
  groupType   String   @default("department") @map("group_type")  // department | cost_center | location | custom
  metadata    Json?
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  account     Account  @relation(fields: [accountId], references: [id])
  invoices    Invoice[]

  @@index([accountId])
  @@index([groupType])
  @@map("invoice_groups")
}
```

### Updated Model: Invoice (additions only)

```prisma
model Invoice {
  // ... existing fields ...

  // Sub-Invoice Support (Phase 4)
  // NOTE: parentInvoiceId field already exists but needs @relation added
  parentInvoice   Invoice?  @relation("SubInvoices", fields: [parentInvoiceId], references: [id])
  subInvoices     Invoice[] @relation("SubInvoices")

  // Organizational grouping
  invoiceGroupId  String?       @map("invoice_group_id")
  invoiceGroup    InvoiceGroup? @relation(fields: [invoiceGroupId], references: [id])

  @@index([parentInvoiceId])   // NEW
  @@index([invoiceGroupId])    // NEW
}
```

### Updated Model: InvoiceItem (additions only)

```prisma
model InvoiceItem {
  // ... existing fields ...

  // Item-level grouping for split operations
  groupReference  String?  @map("group_reference")  // "DEPT-ENG", "CC-12345", "NYC-OFFICE"

  @@index([groupReference])  // NEW
}
```

**Key Indices:**
- `idx_invoices_parent` on `invoices(parent_invoice_id)` - Sub-invoice list queries
- `idx_invoices_group` on `invoices(invoice_group_id)` - Group-scoped invoice queries
- `idx_invoice_items_group_ref` on `invoice_items(group_reference)` - Item grouping queries
- `idx_invoice_groups_account` on `invoice_groups(account_id)` - Group management per account

---

## API Endpoints

Base Path: `/api`

### Invoice Groups (new resource)

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| POST | `/api/invoice-groups` | Create invoice group for an account | Planned |
| GET | `/api/invoice-groups` | List invoice groups (filter by `accountId[eq]`, `groupType[eq]`) | Planned |
| GET | `/api/invoice-groups/:id` | Get invoice group details | Planned |
| PATCH | `/api/invoice-groups/:id` | Update invoice group | Planned |
| DELETE | `/api/invoice-groups/:id` | Delete invoice group (reject if invoices assigned) | Planned |

### Sub-Invoices

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| POST | `/api/invoices/:id/sub-invoices` | Create sub-invoice under parent | Planned |
| GET | `/api/invoices/:id/sub-invoices` | List all sub-invoices for a parent | Planned |
| GET | `/api/invoices/:id/sub-invoices/:subId` | Get specific sub-invoice | Planned |
| PATCH | `/api/invoices/:id/sub-invoices/:subId` | Update sub-invoice | Planned |
| DELETE | `/api/invoices/:id/sub-invoices/:subId` | Delete sub-invoice | Planned |
| POST | `/api/invoices/:id/rollup` | Recalculate parent totals from sub-invoices | Planned |
| POST | `/api/invoices/:id/split` | Split invoice into sub-invoices by groupReference | Planned |
| POST | `/api/invoices/merge` | Merge sub-invoices back to parent | Planned |

### Updated Existing Endpoints

| Method | Path | Change | Status |
|--------|------|--------|--------|
| GET | `/api/invoices` | Add `parentInvoiceId[eq]`, `parentInvoiceId[null]`, `invoiceGroupId[eq]` filters | Planned |
| GET | `/api/invoices/:id` | Include `subInvoices` summary and `invoiceGroup` when applicable | Planned |

### Example: List Sub-Invoices

**Request:** `GET /api/invoices/parent-inv-uuid/sub-invoices`

**Response:** `200 OK`

```json
{
  "data": [
    {
      "id": "sub-inv-uuid-1",
      "invoiceNumber": "INV-2026-000042-01",
      "parentInvoiceId": "parent-inv-uuid",
      "invoiceGroupId": "group-uuid-engineering",
      "accountId": "account-uuid",
      "status": "draft",
      "subtotal": "25000.00",
      "tax": "0.00",
      "discount": "0.00",
      "total": "25000.00",
      "currency": "USD",
      "invoiceGroup": {
        "id": "group-uuid-engineering",
        "name": "Engineering Department",
        "groupType": "department"
      },
      "createdAt": "2026-05-08T10:00:00Z"
    }
  ],
  "paging": {
    "offset": 0,
    "limit": 20,
    "total": 3,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  }
}
```

### Example: Split Invoice

**Request:** `POST /api/invoices/parent-inv-uuid/split`

```json
{
  "groupBy": "groupReference",
  "createSubInvoicesFor": ["DEPT-ENG", "DEPT-SALES", "DEPT-INFRA"]
}
```

**Response:** `201 Created`

```json
{
  "data": {
    "parentInvoiceId": "parent-inv-uuid",
    "subInvoicesCreated": 3,
    "subInvoices": [
      { "id": "sub-1-uuid", "invoiceNumber": "INV-2026-000042-01", "total": "25000.00" },
      { "id": "sub-2-uuid", "invoiceNumber": "INV-2026-000042-02", "total": "18000.00" },
      { "id": "sub-3-uuid", "invoiceNumber": "INV-2026-000042-03", "total": "7000.00" }
    ]
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

## Implementation Details

### Project Structure

```
packages/revenue-backend/src/modules/
├── invoices/
│   ├── invoices.controller.ts       # Extended with sub-invoice endpoints
│   ├── invoices.service.ts          # Extended with sub-invoice methods
│   └── dto/
│       ├── create-sub-invoice.dto.ts    # NEW
│       ├── query-sub-invoices.dto.ts    # NEW
│       └── split-invoice.dto.ts         # NEW
├── invoice-groups/                      # NEW module
│   ├── invoice-groups.controller.ts
│   ├── invoice-groups.service.ts
│   ├── invoice-groups.module.ts
│   └── dto/
│       ├── create-invoice-group.dto.ts
│       └── query-invoice-groups.dto.ts
└── billing/
    └── services/
        └── consolidated-billing.service.ts  # Extended with sub-invoice mode
```

### Technology Stack

- **Framework:** NestJS / Express.js
- **Database:** PostgreSQL via Prisma ORM
- **Validation:** class-validator, class-transformer
- **Queue:** BullMQ for async rollup jobs

### Key Business Logic

#### Sub-Invoice Numbering

Format: `{parent-invoice-number}-{2-digit-sequence}`

Example: Parent `INV-2026-000042` produces children `INV-2026-000042-01`, `INV-2026-000042-02`, etc.

#### Rollup Calculation

The `rollupTotals()` method runs in a Prisma `$transaction`:

```typescript
async rollupTotals(parentInvoiceId: string): Promise<Invoice> {
  return this.prisma.$transaction(async (tx) => {
    const aggregates = await tx.invoice.aggregate({
      where: { parentInvoiceId },
      _sum: { subtotal: true, tax: true, discount: true, total: true }
    });
    
    return tx.invoice.update({
      where: { id: parentInvoiceId },
      data: {
        subtotal: aggregates._sum.subtotal || 0,
        tax: aggregates._sum.tax || 0,
        discount: aggregates._sum.discount || 0,
        total: aggregates._sum.total || 0
      }
    });
  });
}
```

### Implementation Dependencies

- **Phase A must complete before all other phases** (blocking migration)
- Phases B and C are independent of each other but both depend on Phase A
- Phase D (item grouping) column can be added in Phase A migration; service/DTO work is independent
- Phase F depends on Phase C and existing `consolidated-billing.service.ts`
- Phase G testing should start from Phase A (migration tests first)

---

## Testing

**Test Files:**
- `src/modules/invoices/invoice-groups.service.spec.ts` (NEW)
- `src/modules/invoices/invoices.service.spec.ts` (additions)
- `test/sub-invoices.e2e-spec.ts` (NEW)

**Coverage Target:** 90%+

**Test Scenarios:**
- Sub-invoice CRUD operations
- Rollup total calculations (single child, multiple children, empty parent)
- Status cascade (parent void/cancelled propagates to children)
- Split by groupReference (atomic, idempotent)
- Merge sub-invoices back to parent
- Invoice group CRUD
- Consolidated billing with sub-invoice mode

**Run Tests:**

```bash
npm run test -- invoice-groups.service.spec
npm run test -- invoices.service.spec
npm run test:e2e -- sub-invoices
```

---

## Usage Examples

### 1. Create Invoice Group and Sub-Invoice

```bash
# Create an invoice group for Engineering department
curl -X POST http://localhost:5177/api/invoice-groups \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "account-uuid",
    "name": "Engineering Department",
    "groupType": "department",
    "description": "All engineering-related charges"
  }'

# Create a sub-invoice under a parent
curl -X POST http://localhost:5177/api/invoices/parent-inv-uuid/sub-invoices \
  -H "Content-Type: application/json" \
  -d '{
    "invoiceGroupId": "group-uuid",
    "subtotal": 25000.00,
    "tax": 0,
    "discount": 0,
    "total": 25000.00,
    "items": [
      { "description": "Engineering licenses - 50 seats", "quantity": 50, "unitPrice": 500, "amount": 25000 }
    ]
  }'
```

### 2. Split Invoice by Department

```bash
curl -X POST http://localhost:5177/api/invoices/parent-inv-uuid/split \
  -H "Content-Type: application/json" \
  -d '{
    "groupBy": "groupReference",
    "createSubInvoicesFor": ["DEPT-ENG", "DEPT-SALES"]
  }'
```

### 3. Recalculate Parent Totals

```bash
curl -X POST http://localhost:5177/api/invoices/parent-inv-uuid/rollup
```

---

## Performance Considerations

### Database Optimization

1. **Indices:** All foreign keys (`parentInvoiceId`, `invoiceGroupId`, `groupReference`) are indexed
2. **Rollup queries:** Use `aggregate()` instead of fetching all children to avoid N+1
3. **Split operations:** Run in a single `$transaction` to prevent partial state

### Query Optimization

- Sub-invoice list: Single query with `where: { parentInvoiceId }` using index
- Rollup: Single aggregate query, not N child fetches
- Split: Batch update items, batch create sub-invoices in transaction

---

## Security Considerations

1. **Account isolation:** Sub-invoice `accountId` must match parent's `accountId`
2. **Status guards:** Cannot create sub-invoice on `void` or `cancelled` parent
3. **Depth limit:** Sub-invoices cannot have their own sub-invoices (max depth = 1)
4. **Metadata size:** Validate `InvoiceGroup.metadata` JSON size to prevent oversized payloads

---

## Future Enhancements

### Phase 5: Enterprise Operations

- Subsidiary model: Allow sub-invoice `accountId` to be a child account in the hierarchy
- Sub-invoice-level payment allocation
- Cost center approval workflows

### Phase 6+

- Sub-invoice PDF generation (individual department PDFs from one parent)
- Sub-invoice export to ERP systems (SAP, NetSuite) via webhooks
- Automated split rules based on contract metadata

---

## Related Features

- **[Invoices API](./invoices.md)** - Base invoice entity and CRUD operations
- **[Billing Engine](./billing.md)** - Contract-based billing and consolidated billing
- **[Hierarchical Accounts](./hierarchical-accounts.md)** - Parent-child account relationships

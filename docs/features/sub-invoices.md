# Sub-Invoices Feature

**Status:** Planned
**Phase:** Phase 4 — Enterprise Operations
**Planned Start:** April 2026
**ADR Compliance:** [ADR-003: REST API Response Structure & Query Parameters](../adrs/003-rest-api-response-structure.md)

---

## Overview

Sub-invoices extend the Invoice model to support hierarchical billing — a parent invoice that represents a total obligation, with child invoices (sub-invoices) broken out by department, cost center, location, or other organizational grouping. This enables enterprise customers to receive a single consolidated invoice while distributing charge details across internal teams.

## Business Context

Large B2B customers often need invoices split by internal organizational structure:

- **Departmental billing** — Engineering pays for seats, Sales pays for CRM add-ons
- **Cost center allocation** — Finance systems require charges mapped to cost center codes
- **Multi-location invoicing** — US-West and EU-East billed separately under one master invoice
- **Consolidated billing** — Parent account receives one invoice; subsidiaries receive their own sub-invoices

The current codebase has a `parentInvoiceId` field in the Invoice schema but no relationship defined and no supporting logic. Consolidated billing creates a single flattened invoice rather than a hierarchy.

---

## Design Decisions (Resolve Before Implementation)

| # | Decision | Options | Decision |
|---|----------|---------|----------|
| 1 | Sub-invoice numbering | `INV-001-A/B/C` vs `INV-001-001/002/003` | `INV-001-A/B/C` (human-readable) |
| 2 | Amount validation | Strict (children must sum to parent) or flexible | Strict — enforced at API layer |
| 3 | Payment mode | Cascade parent payment to children (`PARENT_PAYS`) or independent per sub-invoice (`CHILD_PAYS`) | Configurable `paymentMode` field on parent invoice — `BY_GROUP` consolidation defaults to `PARENT_PAYS`, `BY_ACCOUNT` defaults to `CHILD_PAYS` |
| 4 | Immutability | Can invoices/sub-invoices be deleted or detached? | No deletion or detachment — all negations via credit notes only |
| 5 | Consolidation strategies | FLAT (current), BY_ACCOUNT, BY_GROUP | All three, selectable per billing run |
| 6 | Split / merge operations | Phase 4 or Phase 5 scope? | Deferred to Phase 5 — complex operations, lower priority than core hierarchy |
| 7 | Ungrouped invoice filter | `invoiceGroupId[null]=true` on list endpoint | To be refined during implementation |
| 8 | Error response contracts | Define upfront or during implementation | Deferred — document during implementation |

---

## Proposed Schema Changes

```prisma
// New entity for organizational groupings
model InvoiceGroup {
  id          String    @id @default(uuid())
  accountId   String
  name        String    // "Engineering Dept", "US-West Cost Center"
  groupType   String    // DEPARTMENT | COST_CENTER | LOCATION | CUSTOM
  code        String?   // "DEPT-ENG", "CC-001", "LOC-USW"
  metadata    Json?
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  account     Account   @relation(fields: [accountId], references: [id])
  invoices    Invoice[]

  @@unique([accountId, groupType, code])
  @@index([accountId])
  @@map("invoice_groups")
}

// Updated Invoice model — additions only
model Invoice {
  // ... existing fields unchanged ...

  parentInvoiceId   String?
  parentInvoice     Invoice?      @relation("InvoiceHierarchy", fields: [parentInvoiceId], references: [id])
  subInvoices       Invoice[]     @relation("InvoiceHierarchy")

  invoiceGroupId    String?
  invoiceGroup      InvoiceGroup? @relation(fields: [invoiceGroupId], references: [id])

  // Payment mode — only set on parent invoices
  // PARENT_PAYS: paying the parent cascades status to all children (internal cost allocation)
  // CHILD_PAYS:  each sub-invoice is paid independently (subsidiary billing)
  // Defaults: BY_GROUP consolidation → PARENT_PAYS, BY_ACCOUNT → CHILD_PAYS
  paymentMode       String?       @map("payment_mode")   // PARENT_PAYS | CHILD_PAYS | null (non-parent)

  @@index([parentInvoiceId])   // NEW
  @@index([invoiceGroupId])    // NEW
}

// Updated InvoiceItem — addition only
model InvoiceItem {
  // ... existing fields unchanged ...
  groupReference    String?   // Links item to org unit (cost center code, dept code, etc.)
}
```

---

## API Endpoints

> Full request/response contracts to be documented during implementation.

### Phase 4 Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/invoices/:id/sub-invoices` | List sub-invoices of a parent (paginated, ADR-003) |
| `POST` | `/api/invoices/:id/sub-invoices` | Create a sub-invoice under a parent |
| `GET` | `/api/invoice-groups` | List invoice groups |
| `POST` | `/api/invoice-groups` | Create invoice group |
| `GET` | `/api/invoice-groups/:id` | Get invoice group |
| `PUT` | `/api/invoice-groups/:id` | Update invoice group |
| `DELETE` | `/api/invoice-groups/:id` | Delete invoice group (only if no invoices attached) |

### Phase 5 Endpoints (Deferred)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/invoices/:id/split` | Split invoice into sub-invoices by group |
| `POST` | `/api/invoices/:id/merge` | Merge sub-invoices back into parent |

### Query Parameter Extensions (ADR-003 compliant)

```bash
# Filter by parent invoice
GET /api/invoices?parentInvoiceId[eq]=<id>

# Top-level invoices only (no parent)
GET /api/invoices?parentInvoiceId[null]=true

# Filter by invoice group
GET /api/invoices?invoiceGroupId[eq]=<id>
```

### Invoice Detail Response — Sub-Invoice Summary

`GET /api/invoices/:id` will include a `subInvoiceCount` summary field on parent invoices. Use `GET /api/invoices/:id/sub-invoices` to retrieve the full list.

```json
{
  "data": {
    "id": "...",
    "invoiceNumber": "INV-2026-0042",
    "paymentMode": "PARENT_PAYS",
    "subInvoiceCount": 3,
    "subInvoiceTotals": {
      "total": "15000.00",
      "paid": "5000.00",
      "outstanding": "10000.00"
    }
  },
  "paging": { "offset": null, "limit": null, "total": null, "totalPages": null, "hasNext": null, "hasPrev": null }
}
```

### Immutability Rule

Invoices, sub-invoices, and invoice items **cannot be deleted or detached**. All financial negations are handled by creating a credit note. This applies to sub-invoices even after the parent is paid.

---

## Implementation Task Tracker

**Legend:** `[ ]` Not started · `[~]` In progress · `[x]` Done

### Phase A: Database Schema & Data Model (~1-2 days)

| ID | Task | Complexity | Status |
|----|------|------------|--------|
| A1 | Create `InvoiceGroup` entity (department, cost center, location, custom) | Medium | [ ] |
| A2 | Add Prisma self-referencing relationship for `parentInvoiceId` on Invoice | Low | [ ] |
| A3 | Add `invoiceGroupId` foreign key to Invoice model | Low | [ ] |
| A4 | Add `groupType` enum (DEPARTMENT, COST_CENTER, LOCATION, CUSTOM) | Low | [ ] |
| A5 | Add `groupReference` field to InvoiceItem for grouping line items | Low | [ ] |
| A6 | Add `paymentMode` field to Invoice (`PARENT_PAYS` \| `CHILD_PAYS` \| null) | Low | [ ] |
| A7 | Create database migration for all schema changes | Medium | [ ] |
| A8 | Add index on `parentInvoiceId` for efficient hierarchy queries | Low | [ ] |

### Phase B: Invoice Group Management (~1-2 days)

| ID | Task | Complexity | Status |
|----|------|------------|--------|
| B1 | Create `InvoiceGroup` service (CRUD operations) | Medium | [ ] |
| B2 | Create DTOs for invoice group create/update/query | Medium | [ ] |
| B3 | Create invoice group controller with REST endpoints | Medium | [ ] |
| B4 | Add validation for group uniqueness per account | Low | [ ] |
| B5 | Add cascade behavior (soft delete groups with invoices) | Low | [ ] |

### Phase C: Sub-Invoice Core Logic (~2-3 days)

| ID | Task | Complexity | Status |
|----|------|------------|--------|
| C1 | Update Invoice service to support parent-child relationships | Medium | [ ] |
| C2 | Add `createSubInvoice()` method with parent linking | Medium | [ ] |
| C3 | Add `getSubInvoices()` method for parent invoice | Low | [ ] |
| C4 | Implement sub-invoice number generation (`INV-001-A`, `INV-001-B`) | Medium | [ ] |
| C5 | Add rollup calculation (parent totals = sum of children) | Medium | [ ] |
| C6 | Add validation: sub-invoice totals must match parent | Medium | [ ] |
| C7 | Implement `paymentMode` logic — cascade on `PARENT_PAYS`, independent on `CHILD_PAYS` | Medium | [ ] |
| C8 | Default `paymentMode` from consolidation strategy (`BY_GROUP` → `PARENT_PAYS`, `BY_ACCOUNT` → `CHILD_PAYS`) | Low | [ ] |

### Phase D: Invoice Item Grouping (~1 day)

| ID | Task | Complexity | Status |
|----|------|------------|--------|
| D1 | Update InvoiceItem to include `groupReference` field | Low | [ ] |
| D2 | Add grouping logic in invoice creation | Medium | [ ] |
| D3 | Add endpoint to move items between groups/sub-invoices | Medium | [ ] |
| D4 | Add validation for item reassignment (amount consistency) | Medium | [ ] |

### Phase E: API Endpoints (~2-3 days)

| ID | Task | Complexity | Status |
|----|------|------------|--------|
| E1 | `GET /api/invoices/:id/sub-invoices` — List sub-invoices (paginated) | Low | [ ] |
| E2 | `POST /api/invoices/:id/sub-invoices` — Create sub-invoice | Medium | [ ] |
| E3 | Invoice group CRUD endpoints (`/api/invoice-groups`) | Medium | [ ] |
| E4 | Add `parentInvoiceId[eq]` and `parentInvoiceId[null]` filters to list endpoint | Low | [ ] |
| E5 | Add `invoiceGroupId[eq]` filter to list endpoint | Low | [ ] |
| E6 | Update invoice detail to include `subInvoiceCount` + `subInvoiceTotals` summary | Low | [ ] |
| E7 | ~~`POST /api/invoices/:id/split`~~ — **Deferred to Phase 5** | High | — |
| E8 | ~~`POST /api/invoices/:id/merge`~~ — **Deferred to Phase 5** | High | — |

### Phase F: Consolidated Billing Integration (~2-3 days)

| ID | Task | Complexity | Status |
|----|------|------------|--------|
| F1 | Update consolidated billing to create parent + sub-invoices | High | [ ] |
| F2 | Strategy: one sub-invoice per subsidiary account | Medium | [ ] |
| F3 | Strategy: one sub-invoice per cost center/department | Medium | [ ] |
| F4 | Add `consolidationStrategy` parameter (FLAT, BY_ACCOUNT, BY_GROUP) | Medium | [ ] |
| F5 | Update billing processor to handle sub-invoice generation | Medium | [ ] |

### Phase G: Testing (~2-3 days)

| ID | Task | Complexity | Status |
|----|------|------------|--------|
| G1 | Unit tests for invoice group service | Medium | [ ] |
| G2 | Unit tests for sub-invoice creation/retrieval | Medium | [ ] |
| G3 | Unit tests for rollup calculations | Medium | [ ] |
| G4 | Integration tests for split/merge operations | High | [ ] |
| G5 | Integration tests for consolidated billing with sub-invoices | High | [ ] |
| G6 | E2E tests for complete sub-invoice workflows | High | [ ] |

### Phase H: Documentation (~0.5-1 day)

| ID | Task | Complexity | Status |
|----|------|------------|--------|
| H1 | Update this doc (`sub-invoices.md`) with implementation details post-build | Medium | [ ] |
| H2 | Update `docs/features/invoices.md` with sub-invoice info | Low | [ ] |
| H3 | Update `docs/features/billing.md` with consolidation strategies | Low | [ ] |
| H4 | Add API examples and cURL commands | Low | [ ] |

---

## Effort Summary

| Phase | Tasks | Estimate | Notes |
|-------|-------|----------|-------|
| A: Schema | 8 | ~1-2 days | +1 for `paymentMode` field |
| B: Group Management | 5 | ~1-2 days | |
| C: Core Logic | 8 | ~2-3 days | `paymentMode` replaces simple cascade |
| D: Item Grouping | 4 | ~1 day | |
| E: API Endpoints | 6 | ~1-2 days | Split/merge deferred to Phase 5 |
| F: Billing Integration | 5 | ~2-3 days | |
| G: Testing | 6 | ~2-3 days | |
| H: Documentation | 4 | ~0.5-1 day | |
| **Phase 4 Total** | **46 tasks** | **~11-17 days** | |
| *(Phase 5) Split/Merge* | *2* | *~2-3 days* | *Deferred* |

---

## Recommended Implementation Order

```
1. Phase A — Schema Changes        (foundation everything else depends on)
2. Phase B — Group Management      (define org structures before using them)
3. Phase C — Core Sub-Invoice Logic (parent-child relationships)
4. Phase E — API Endpoints         (expose the functionality)
5. Phase D — Item Grouping         (fine-grained line item control)
6. Phase F — Billing Integration   (automated sub-invoice generation)
7. Phase G — Testing               (quality assurance)
8. Phase H — Documentation         (complete the feature)
```

---

## Frontend Implementation Plan

> Planned: April 2026. Backend APIs fully implemented; no frontend exists yet.

### New Files to Create

| File | Purpose |
|------|---------|
| `app/lib/api/hooks/use-invoice-groups.ts` | TanStack Query hooks for invoice group CRUD |
| `app/components/invoice-groups/invoice-group-form.tsx` | Create/edit form (account, name, groupType, code) |
| `app/components/invoices/sub-invoice-form.tsx` | Simplified form — inherits accountId, auto-generates number |
| `app/components/invoices/sub-invoices-table.tsx` | Sub-invoices list rendered on parent detail page |
| `app/routes/invoice-groups._index.tsx` | List page with search + filter by account/type |
| `app/routes/invoice-groups.new.tsx` | Create group route |
| `app/routes/invoice-groups.$id.edit.tsx` | Edit group route (doubles as detail view) |
| `app/routes/invoices.$id.sub-invoices.new.tsx` | Create sub-invoice under a specific parent |

### Files to Modify

| File | Changes |
|------|---------|
| `app/types/models.ts` | Add `InvoiceGroup`, `InvoiceGroupType`; extend `Invoice` with `invoiceGroupId`, `invoiceGroup`, `subInvoiceCount`, `subInvoiceTotals` |
| `app/lib/api/query-client.ts` | Add `invoiceGroups` query key namespace |
| `app/lib/api/hooks/use-invoices.ts` | Add `useSubInvoices`, `useCreateSubInvoice` |
| `app/routes/invoices.$id.tsx` | Add sub-invoices card (when parent) + parent breadcrumb (when child) |
| `app/routes/invoices._index.tsx` | Add group filter, sub-invoice badge, top-level-only toggle |
| `app/components/invoices/invoice-form.tsx` | Add optional Invoice Group select (filtered by selected account) |
| `app/routes.ts` | Register 4 new routes |
| `app/components/layout/sidebar.tsx` | Add Invoice Groups link under Invoices section |

### Implementation Order

```
Step 1 — Types & hooks (no UI, no risk)
Step 2 — Invoice Groups CRUD (independent feature, ship first)
Step 3 — Parent invoice detail enhancements (sub-invoices card, group badge)
Step 4 — Sub-invoice creation flow (invoices.$id.sub-invoices.new.tsx)
Step 5 — Invoice list updates (filter, badge, toggle)
```

### UX Decisions

| # | Decision | Recommendation |
|---|----------|----------------|
| A | Default list filter | Top-level only (`parentInvoiceId[null]=true`) — sub-invoices accessed via parent detail |
| B | Invoice Groups navigation | Link in Invoices page header (defer sidebar refactor) |
| C | Sub-invoice creation entry point | Only from parent detail page — backend nested endpoint enforces parent context |
| D | Invoice Group on "New Invoice" form | Add optional field — backend `CreateInvoiceDto` accepts `invoiceGroupId` |

### Frontend Task Tracker

| ID | Task | Status |
|----|------|--------|
| FE1 | Add `InvoiceGroup` type, extend `Invoice` in `models.ts` | [x] |
| FE2 | Add `invoiceGroups` query keys, create `use-invoice-groups.ts` | [x] |
| FE3 | Add `useSubInvoices` + `useCreateSubInvoice` to `use-invoices.ts` | [x] |
| FE4 | Build `invoice-group-form.tsx` component | [x] |
| FE5 | Build `invoice-groups._index.tsx` list route | [x] |
| FE6 | Build `invoice-groups.new.tsx` + `invoice-groups.$id.edit.tsx` | [x] |
| FE7 | Add Invoice Groups to sidebar/navigation | [x] |
| FE8 | Add sub-invoices card to `invoices.$id.tsx` | [x] |
| FE9 | Add parent breadcrumb to sub-invoice detail pages | [x] |
| FE10 | Build `sub-invoice-form.tsx` component | [x] |
| FE11 | Build `invoices.$id.sub-invoices.new.tsx` route | [x] |
| FE12 | Add group filter + sub-invoice badge to `invoices._index.tsx` | [x] |
| FE13 | Add Invoice Group select to `invoice-form.tsx` | [ ] |
| FE14 | Register all new routes in `routes.ts` | [x] |

---

## Related Documents

- [Invoices API Feature](./invoices.md)
- [Billing Engine Feature](./billing.md)
- [Hierarchical Accounts Feature](./hierarchical-accounts.md)
- [ADR-003: REST API Response Structure](../adrs/003-rest-api-response-structure.md)

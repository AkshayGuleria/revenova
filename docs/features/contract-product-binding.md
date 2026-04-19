# Contract-Product Binding & Contract-Mandatory Invoices

**Status:** Implemented ✅
**Phase:** Phase 4 — Enterprise Operations
**Planned Start:** April 2026
**ADR Compliance:** [ADR-003: REST API Response Structure & Query Parameters](../adrs/003-rest-api-response-structure.md)

---

## Overview

Introduces a mandatory relationship between Contracts and Products, and enforces that all invoices are derived from a valid contract. Invoice line items are auto-generated from the products attached to the contract rather than being entered manually.

## Business Context

- Enterprise contracts always represent specific products/services purchased — a contract without products is commercially meaningless
- Manual invoice item entry is error-prone and slow; deriving items from the contract eliminates transcription mistakes
- Tracing invoice lines back to specific contract products enables product-level revenue reporting (ARR by product, churn attribution, etc.)

---

## Design Decisions

| # | Decision | Resolution |
|---|----------|------------|
| 1 | Hard DB `NOT NULL` on `invoice.contract_id` now or app-layer enforcement first? | App-layer enforcement first — avoids back-fill surgery on existing data; DB constraint added later |
| 2 | Keep `seatCount`/`committedSeats`/`seatPrice` on Contract? | Keep — Phase 2 billing engine (BullMQ processor) still uses them |
| 3 | `CreateInvoiceDto`: accept manual `items` on creation? | Remove — items are auto-generated; ad-hoc additions go through `POST /invoices/:id/items` post-creation |
| 4 | Add `contractProductId` FK on `InvoiceItem`? | Yes — enables product-level revenue traceability for Phase 5 analytics |
| 5 | `contractValue` on Contract: auto-compute from products or keep manual? | Keep manual — represents negotiated deal value that the product catalog alone can't express |

---

## Data Model Changes

### New: `ContractProduct` join table

```prisma
model ContractProduct {
  id              String   @id @default(uuid())
  contractId      String   @map("contract_id")
  productId       String   @map("product_id")

  quantity        Int      @default(1)
  unitPrice       Decimal? @map("unit_price") @db.Decimal(10, 2)  // overrides product.basePrice if set
  discount        Decimal? @db.Decimal(5, 4)                      // fractional, e.g. 0.1 = 10%
  billingInterval String?  @map("billing_interval")               // overrides product.billingInterval if set

  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  contract        Contract @relation(fields: [contractId], references: [id], onDelete: Cascade)
  product         Product  @relation(fields: [productId], references: [id])

  @@unique([contractId, productId])
  @@index([contractId])
  @@index([productId])
  @@map("contract_products")
}
```

Back-references to add:
- `Contract` model → `products ContractProduct[]`
- `Product` model → `contracts ContractProduct[]`

### Changes to `Invoice`

`contractId` enforced as required at the application layer (DTO validation, service guard).

### Changes to `InvoiceItem`

Add optional `contractProductId` field for traceability:
```prisma
contractProductId  String?         @map("contract_product_id")
contractProduct    ContractProduct? @relation(fields: [contractProductId], references: [id])
```

---

## API Changes

### Contracts

New sub-endpoints:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/contracts/:id/products` | List products on a contract |
| `POST` | `/api/contracts/:id/products` | Add a product to a contract |
| `DELETE` | `/api/contracts/:id/products/:productId` | Remove a product from a contract |

`POST /api/contracts` now requires a `products` array (min 1 item):
```json
{
  "products": [
    { "productId": "uuid", "quantity": 50 },
    { "productId": "uuid", "quantity": 1, "unitPrice": 299.00, "discount": 0.10 }
  ]
}
```

### Invoices

`POST /api/invoices` changes:
- `contractId` is now **required**
- `items` array is **removed** from the request body — items are auto-generated from the contract's products
- `tax` and `discount` remain as invoice-level adjustments
- `subtotal` and `total` are computed server-side (not accepted from client)

Auto-generation logic per contract product:
```
description = product.name
quantity    = contractProduct.quantity
unitPrice   = contractProduct.unitPrice ?? product.basePrice
amount      = unitPrice × quantity × (1 − discount)
```

---

## Implementation Order

| Step | Scope | Files |
|------|-------|-------|
| 1 | Prisma schema — add `ContractProduct` model (additive, zero breakage) | `schema.prisma` |
| 2 | Backend — `ContractsService`: require products on create, `/:id/products` sub-endpoints, fix tests | `contracts.service.ts`, `create-contract.dto.ts`, `contract-product.dto.ts` (new), `contracts.service.spec.ts` |
| 3 | Backend — `InvoicesService`: require contractId, auto-generate items, remove manual items, fix tests | `invoices.service.ts`, `create-invoice.dto.ts`, `invoices.service.spec.ts` |
| 4 | Data generator — attach products when creating contracts | `scripts/generate-test-data.ts` |
| 5 | Frontend — contract form: add product picker section | `contract-form.tsx`, `models.ts` |
| 6 | Frontend — invoice form: make contractId required, remove manual item entry, show auto-populated preview | `invoice-form.tsx`, `models.ts` |
| 7 | DB migration — back-fill `invoice.contract_id` nulls, add `NOT NULL` constraint *(later)* | New migration file |

---

## Migration Strategy

Existing contracts have no products; existing invoices may have `contractId = null`.

- Step 1 migration is additive — adds the `ContractProduct` table, no column removals.
- Application layer enforces `contractId` required on new invoices; existing null rows are unaffected.
- A follow-up migration (Step 7, deferred) will back-fill existing invoice `contract_id` nulls and add the DB-level `NOT NULL` constraint once data is clean.

---

## Task Tracker

**Legend:** `[ ]` Not started · `[~]` In progress · `[x]` Done

| ID | Task | Status |
|----|------|--------|
| CP1 | Add `ContractProduct` model to Prisma schema + run migration | [x] |
| CP2 | Add `contractProductId` FK to `InvoiceItem` | [x] |
| CP3 | Create `contract-product.dto.ts` | [x] |
| CP4 | Update `CreateContractDto` — require `products[]` (min 1) | [x] |
| CP5 | Update `ContractsService.create()` — write products in transaction, validate product IDs | [x] |
| CP6 | Add `GET/POST/DELETE /api/contracts/:id/products` sub-endpoints | [x] |
| CP7 | Update `contracts.service.spec.ts` — fix fixtures, add product tests | [x] |
| CP8 | Update `CreateInvoiceDto` — require `contractId`, remove `items` | [x] |
| CP9 | Update `InvoicesService.create()` — fetch contract products, auto-generate items | [x] |
| CP10 | Update `invoices.service.spec.ts` — fix fixtures, add auto-generation tests | [x] |
| CP11 | Update `generate-test-data.ts` — include products in contract create payload | [x] |
| CP12 | Update `models.ts` — add `ContractProduct`, `CreateContractProductDto`, update `Contract` and `CreateInvoiceDto` | [x] |
| CP13 | Update `contract-form.tsx` — add product picker with `useFieldArray` | [x] |
| CP14 | Update `invoice-form.tsx` — require contractId, remove manual items, show contract-product preview | [x] |

---

## Files Affected

**Backend:**
- `prisma/schema.prisma`
- `src/modules/contracts/dto/create-contract.dto.ts`
- `src/modules/contracts/dto/contract-product.dto.ts` *(new)*
- `src/modules/contracts/contracts.service.ts`
- `src/modules/contracts/contracts.controller.ts`
- `src/modules/contracts/contracts.service.spec.ts`
- `src/modules/invoices/dto/create-invoice.dto.ts`
- `src/modules/invoices/invoices.service.ts`
- `src/modules/invoices/invoices.service.spec.ts`
- `scripts/generate-test-data.ts`

**Frontend:**
- `app/types/models.ts`
- `app/components/contracts/contract-form.tsx`
- `app/components/invoices/invoice-form.tsx`

---

## Related Documents

- [Contracts API](./contracts.md)
- [Invoices API](./invoices.md)
- [Products API](./products.md)
- [Sub-Invoices & Invoice Groups](./sub-invoices.md)
- [Billing Engine](./billing.md)

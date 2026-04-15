# Product Pricing Enhancement

**Status:** Implemented
**Phase:** Phase 3.5 — Product Catalog Enhancement
**Implementation Date:** March 2026
**ADR:** [ADR-004: Product Pricing Model Enhancement](../adrs/004-product-pricing-model-enhancement.md)
**ADR Compliance:** [ADR-003: REST API Response Structure](../adrs/003-rest-api-response-structure.md)

---

## Overview

This feature enhances the existing Product model to support real-world B2B SaaS pricing patterns. The core addition is a `chargeType` field that explicitly distinguishes recurring subscription fees from one-time charges, alongside `category`, `setupFee`, `trialPeriodDays`, and `minCommitmentMonths` fields that make the product catalog self-describing.

These changes enable the billing engine to automatically determine how to invoice each product without hardcoded rules, and enable accurate ARR/MRR reporting by filtering on charge type.

---

## Business Context

Real enterprise SaaS deals contain a mix of charge types on a single contract:

- **Recurring subscriptions** — billed every month/quarter/year (seat plans, add-on modules, support tiers)
- **One-time charges** — billed only on the first invoice (onboarding, data migration, custom integrations)
- **Setup fees** — one-time uplift on first invoice for a recurring product (e.g. Professional Plan has a $500 onboarding fee charged once)

Without this distinction, the billing engine cannot correctly generate first-period invoices, and reporting cannot separate ARR from non-recurring services revenue.

---

## Database Schema

### Migration: `add_charge_type_and_category_to_products`

All new columns have defaults — **zero downtime, non-breaking migration**.

```prisma
model Product {
  id                   String    @id @default(uuid())
  name                 String
  description          String?
  sku                  String?   @unique

  // Pricing Model (existing)
  pricingModel         String    @map("pricing_model")
  basePrice            Decimal?  @map("base_price") @db.Decimal(10, 2)
  currency             String    @default("USD")

  // ── NEW FIELDS ──────────────────────────────────────────
  chargeType           String    @default("recurring") @map("charge_type")
  // recurring | one_time | usage_based

  category             String    @default("platform") @map("category")
  // platform | seats | addon | support | professional_services | storage | api

  setupFee             Decimal?  @map("setup_fee") @db.Decimal(10, 2)
  // One-time charge added to the FIRST invoice for this product

  trialPeriodDays      Int?      @map("trial_period_days")
  // Number of days before billing begins

  minCommitmentMonths  Int?      @map("min_commitment_months")
  // Minimum months the customer must commit (contract validation)
  // ────────────────────────────────────────────────────────

  // Seat-Based Configuration (existing)
  minSeats             Int       @default(1) @map("min_seats")
  maxSeats             Int?      @map("max_seats")
  seatIncrement        Int       @default(1) @map("seat_increment")

  // Volume Discount Tiers (existing)
  volumeTiers          Json?     @map("volume_tiers")

  // Billing Configuration (existing)
  billingInterval      String?   @map("billing_interval")

  // Product Status (existing)
  active               Boolean   @default(true)
  isAddon              Boolean   @default(false) @map("is_addon")

  // Metadata
  metadata             Json?
  createdAt            DateTime  @default(now()) @map("created_at")
  updatedAt            DateTime  @updatedAt @map("updated_at")

  // Indices
  @@index([pricingModel])
  @@index([chargeType])     // NEW
  @@index([category])       // NEW
  @@index([active])
  @@map("products")
}
```

### New Enums

```typescript
// ChargeType
export enum ChargeType {
  RECURRING   = 'recurring',     // Auto-billed each interval
  ONE_TIME    = 'one_time',      // Billed on first invoice only
  USAGE_BASED = 'usage_based',   // Phase 6 — field added, logic deferred
}

// ProductCategory
export enum ProductCategory {
  PLATFORM              = 'platform',
  SEATS                 = 'seats',
  ADDON                 = 'addon',
  SUPPORT               = 'support',
  PROFESSIONAL_SERVICES = 'professional_services',
  STORAGE               = 'storage',   // Phase 6
  API                   = 'api',       // Phase 6
}
```

---

## API Endpoints

All existing endpoints remain unchanged. The new fields are added to request/response bodies.

### Updated: `POST /api/products`

```typescript
// New fields in CreateProductDto
{
  // existing fields...
  "chargeType": "recurring",            // recurring | one_time | usage_based
  "category": "platform",              // platform | seats | addon | support | professional_services
  "setupFee": 500.00,                   // optional, added to first invoice
  "trialPeriodDays": 14,               // optional, days before billing starts
  "minCommitmentMonths": 12            // optional, minimum contract length
}
```

### Validation Rules

| Rule | Description |
|---|---|
| `billingInterval` required when `chargeType = recurring` | Recurring products must have a billing cadence |
| `billingInterval` ignored when `chargeType = one_time` | One-time products have no recurring interval |
| `setupFee >= 0` | Cannot be negative |
| `trialPeriodDays >= 0` | Cannot be negative |
| `minCommitmentMonths >= 1` | Minimum 1 month if specified |
| `chargeType = usage_based` accepted but billing skipped | No invoice generated until Phase 6 |

### Example Responses

#### Recurring seat-based product

```json
{
  "data": {
    "id": "uuid",
    "name": "Professional Plan",
    "sku": "PLAN-PRO",
    "pricingModel": "seat_based",
    "chargeType": "recurring",
    "category": "platform",
    "basePrice": "79.99",
    "currency": "USD",
    "billingInterval": "monthly",
    "setupFee": "500.00",
    "trialPeriodDays": null,
    "minCommitmentMonths": null,
    "minSeats": 5,
    "maxSeats": null,
    "isAddon": false,
    "active": true,
    "createdAt": "2026-02-18T00:00:00.000Z",
    "updatedAt": "2026-02-18T00:00:00.000Z"
  },
  "paging": { "offset": null, "limit": null, "total": null, "totalPages": null, "hasNext": null, "hasPrev": null }
}
```

#### One-time professional services product

```json
{
  "data": {
    "id": "uuid",
    "name": "Onboarding Package",
    "sku": "SVC-ONBOARDING",
    "pricingModel": "flat_fee",
    "chargeType": "one_time",
    "category": "professional_services",
    "basePrice": "5000.00",
    "currency": "USD",
    "billingInterval": null,
    "setupFee": null,
    "trialPeriodDays": null,
    "minCommitmentMonths": null,
    "minSeats": 1,
    "isAddon": false,
    "active": true
  },
  "paging": { ... }
}
```

### Filtering by Charge Type (ARR/MRR reporting)

```bash
# Get all recurring products (for ARR calculation)
GET /api/products?chargeType[eq]=recurring

# Get all add-on modules
GET /api/products?category[eq]=addon&chargeType[eq]=recurring

# Get one-time service products
GET /api/products?chargeType[eq]=one_time&category[eq]=professional_services
```

---

## Billing Engine Implications

The invoice generator (`billing.service.ts`) must be updated to honour new product fields:

```typescript
// Pseudo-code for updated billing logic
function shouldBillProduct(product, contract, periodStart) {
  // Skip usage-based products (Phase 6)
  if (product.chargeType === 'usage_based') return false;

  // Respect trial period
  const trialEnd = addDays(contract.startDate, product.trialPeriodDays ?? 0);
  if (periodStart < trialEnd) return false;

  // One-time: only bill on first period
  if (product.chargeType === 'one_time') {
    return isSamePeriod(periodStart, contract.startDate);
  }

  // Recurring: always bill
  return true;
}

function getSetupFee(product, contract, periodStart) {
  // Add setupFee to first invoice only
  if (product.setupFee && isSamePeriod(periodStart, contract.startDate)) {
    return product.setupFee;
  }
  return 0;
}
```

---

## Updated Product Catalog (Seed Data)

### Core Plans — `recurring` · `platform` · `seat_based`

| Name | SKU | Price | Interval | Setup Fee | Trial | Min Commit |
|---|---|---|---|---|---|---|
| Starter Plan | PLAN-STARTER | $29.99/seat | monthly | — | 14 days | — |
| Professional Plan | PLAN-PRO | $79.99/seat | monthly | $500 | — | — |
| Enterprise Plan | PLAN-ENT | $149.99/seat | annual | $2,000 | — | 12 months |

### Platform Add-ons — `recurring` · `addon` · `flat_fee`

| Name | SKU | Price | Interval |
|---|---|---|---|
| Advanced Analytics Module | ADDON-ANALYTICS | $499/mo | monthly |
| AI Assistant Module | ADDON-AI | $999/mo | monthly |
| Premium API Access | ADDON-API | $299/mo | monthly |
| Custom SSO/SAML | ADDON-SSO | $199/mo | monthly |

### Support Tiers — `recurring` · `support` · `flat_fee`

| Name | SKU | Price | Interval |
|---|---|---|---|
| Premium Support | SUPPORT-PREMIUM | $999/mo | monthly |
| Dedicated CSM | SUPPORT-CSM | $2,500/mo | monthly |

### One-Time Services — `one_time` · `professional_services` · `flat_fee`

| Name | SKU | Price |
|---|---|---|
| Onboarding Package | SVC-ONBOARDING | $5,000 |
| Data Migration | SVC-MIGRATION | $3,000 |
| Custom Integration | SVC-INTEGRATION | $15,000 |
| Training Workshop | SVC-TRAINING | $2,500 |

---

## Implementation Details

### Project Structure — New & Modified Files

```
packages/revenue-backend/
├── prisma/
│   ├── schema.prisma                           MODIFY — add new fields
│   └── migrations/
│       └── YYYYMMDD_add_charge_type_to_products/  NEW — migration file
├── src/modules/products/
│   ├── dto/
│   │   └── create-product.dto.ts              MODIFY — add new enums & fields
│   ├── products.service.ts                     MODIFY — filtering by chargeType/category
│   └── products.service.spec.ts               MODIFY — add tests for new fields
├── src/modules/billing/
│   └── billing.service.ts                     MODIFY — honour chargeType, setupFee, trialPeriodDays
│   └── billing.service.spec.ts               MODIFY — add tests for new billing logic

packages/revenue-frontend/
├── app/
│   ├── types/models.ts                        MODIFY — add ChargeType, ProductCategory enums
│   ├── components/products/
│   │   └── product-form.tsx                   MODIFY — conditional fields by chargeType
│   └── routes/
│       ├── products.new.tsx                   NO CHANGE (form handles it)
│       └── products.$id.edit.tsx              NO CHANGE
└── tests/e2e/
    └── product-pricing.spec.ts                NEW — E2E tests for new fields
```

---

## Testing

### Backend Unit Tests (`riina`)

**File:** `packages/revenue-backend/src/modules/products/products.service.spec.ts`

Test scenarios:
- Create recurring product with all new fields
- Create one-time product (billingInterval should be ignored)
- Validate billingInterval required for recurring products
- Filter products by `chargeType[eq]=recurring`
- Filter products by `category[eq]=addon`
- Setup fee stored correctly and returned in response

**File:** `packages/revenue-backend/src/modules/billing/billing.service.spec.ts`

Test scenarios:
- One-time product billed only on first invoice period
- Recurring product billed on every period
- Usage-based product skipped (no invoice line item)
- Setup fee added to first invoice, not subsequent ones
- Trial period respected (no invoice before trial ends)

### E2E Tests (`piia`)

**File:** `packages/revenue-frontend/tests/e2e/product-pricing.spec.ts`

Test scenarios:
- Create recurring seat-based product with setup fee
- Create one-time service product (interval fields hidden)
- Category dropdown shows correct options
- chargeType toggle shows/hides relevant fields
- Product list filterable by chargeType
- Existing products continue to display correctly (backward compat)

---

## Performance Considerations

- Two new indices on `chargeType` and `category` — minimal write overhead, significant benefit for:
  - ARR/MRR calculation queries (`WHERE charge_type = 'recurring'`)
  - Category-based reporting queries
- All new columns have DB-level defaults — migration is instant (`ALTER TABLE ... ADD COLUMN ... DEFAULT`)
- No joins added — all new fields are on the `products` table

---

## Security Considerations

- `chargeType` and `category` are enum-validated at the DTO layer (NestJS `@IsEnum`)
- `setupFee` is validated `>= 0` — cannot create negative fees
- `forbidNonWhitelisted: true` already rejects unknown fields

---

## Future Enhancements

### Phase 4 — ContractLineItems (ADR-005)

Link multiple products to a single contract with per-line overrides:

```
Contract → ContractLineItem[]
  └── productId, quantity, unitPrice (override), discount, effectiveDate
```

This enables:
- Mixed recurring + one-time products on one deal
- Per-line negotiated pricing (different from product catalog price)
- Mid-contract amendments (add/remove products)

### Phase 5 — Usage-Based Billing

Activate `usage_based` chargeType with metering infrastructure:
- Usage events ingested via API
- Aggregated monthly and converted to invoice line items
- Supports overage charges above committed usage

### Phase 6 — Product Bundles

Group products into named bundles (e.g. "Growth Stack = Pro Plan + Analytics + API Access") with bundle-level discounts.

---

## Related Documents

- [ADR-004: Product Pricing Model Enhancement](../adrs/004-product-pricing-model-enhancement.md)
- [ADR-003: REST API Response Structure](../adrs/003-rest-api-response-structure.md)
- [Products API Feature](./products.md)
- [Billing Engine Feature](./billing.md)

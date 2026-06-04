# Tax Rates

**Status:** Implemented ✅
**Phase:** Phase 4 — Enterprise Operations
**Implementation Date:** April 2026
**ADR Compliance:** [ADR-003: REST API Response Structure & Query Parameters](../adrs/003-rest-api-response-structure.md)

---

## Overview

Manages jurisdiction-specific tax rates with effective date ranges. Supports VAT, GST, SALES_TAX, and WHT (withholding tax) types. Exposes a `calculate` endpoint that looks up the active rate for a jurisdiction and computes tax and gross amounts. Deactivation is soft — records are marked `active: false` with an `effectiveTo` timestamp rather than deleted.

## Business Context

- B2B invoices require jurisdiction-appropriate tax rates (EU VAT, US state sales tax, Australian GST, etc.)
- Tax rates change over time; storing effective date ranges lets the system apply the rate that was legally in force on a given invoice date
- The `calculate` endpoint is designed for use by the billing engine and invoice service to compute tax at line-item or invoice level without coupling them to the tax rate storage details

---

## Data Model

```prisma
model TaxRate {
  id            String    @id @default(uuid())
  jurisdiction  String
  taxType       String    @map("tax_type")
  rate          Decimal   @db.Decimal(8, 4)
  name          String
  description   String?
  effectiveFrom DateTime  @map("effective_from") @db.Date
  effectiveTo   DateTime? @map("effective_to") @db.Date
  active        Boolean   @default(true)
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  @@index([jurisdiction])
  @@index([taxType])
  @@index([active])
  @@index([effectiveFrom])
  @@map("tax_rates")
}
```

**Key details:**
- `rate` stored as `DECIMAL(8, 4)` — supports up to 4 decimal places (e.g. `0.1925` = 19.25%)
- `rate` is a fraction between 0 and 1 (0.19 = 19%, 0.0 = tax-exempt)
- `effectiveTo = null` means the rate is open-ended (still in force)
- Deactivation sets `active = false` and `effectiveTo = now()`

### Tax Types

| Type | Description |
|------|-------------|
| `VAT` | Value Added Tax (Europe) |
| `GST` | Goods and Services Tax (Australia, Canada) |
| `SALES_TAX` | US state/local sales tax |
| `WHT` | Withholding tax |

### Jurisdiction Code Convention

Free-form string; recommended patterns: `EU-DE`, `EU-FR`, `US-CA`, `US-NY`, `UK`, `AU`. The jurisdiction code on an account or invoice should match exactly for lookups to work.

---

## API Endpoints

### POST /api/tax-rates

Create a new tax rate for a jurisdiction. New rates are always created with `active: true`.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `jurisdiction` | string | Yes | Jurisdiction code (e.g. `EU-DE`, `US-CA`) |
| `taxType` | enum | Yes | `VAT`, `GST`, `SALES_TAX`, or `WHT` |
| `rate` | number | Yes | Decimal 0–1, max 4 decimal places (e.g. `0.19`) |
| `name` | string | Yes | Human-readable name (e.g. `German VAT Standard Rate`) |
| `description` | string | No | Optional long-form description |
| `effectiveFrom` | ISO date | Yes | First day this rate is effective |
| `effectiveTo` | ISO date | No | Last day this rate is effective (omit for open-ended) |

**Example request:**

```json
{
  "jurisdiction": "EU-DE",
  "taxType": "VAT",
  "rate": 0.19,
  "name": "German VAT Standard Rate",
  "description": "Standard VAT rate for goods and services in Germany",
  "effectiveFrom": "2026-01-01"
}
```

**Response (201):**

```json
{
  "data": {
    "id": "tax-uuid",
    "jurisdiction": "EU-DE",
    "taxType": "VAT",
    "rate": "0.1900",
    "name": "German VAT Standard Rate",
    "description": "Standard VAT rate for goods and services in Germany",
    "effectiveFrom": "2026-01-01T00:00:00.000Z",
    "effectiveTo": null,
    "active": true,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  "paging": { "offset": null, "limit": null, "total": null, "totalPages": null, "hasNext": null, "hasPrev": null }
}
```

---

### GET /api/tax-rates/calculate

Calculate tax for a given amount and jurisdiction. Looks up the active rate effective on or before the given date.

**Query parameters:**

| Parameter | Type | Required | Example | Description |
|-----------|------|----------|---------|-------------|
| `amount` | number | Yes | `10000` | Pre-tax amount (positive) |
| `jurisdiction` | string | Yes | `EU-DE` | Jurisdiction code |
| `taxType` | enum | No | `VAT` | Filter to a specific tax type |
| `date` | ISO date | No | `2026-05-30` | Look up rate effective on this date (defaults to today) |

**Lookup logic:**

Finds the most recent `active` rate for the jurisdiction where `effectiveFrom <= date` and (`effectiveTo IS NULL` OR `effectiveTo >= date`).

**Example request:**

```
GET /api/tax-rates/calculate?amount=10000&jurisdiction=EU-DE&taxType=VAT
```

**Response (200):**

```json
{
  "data": {
    "jurisdiction": "EU-DE",
    "taxType": "VAT",
    "rateName": "German VAT Standard Rate",
    "rate": 0.19,
    "amount": 10000,
    "taxAmount": 1900.00,
    "totalWithTax": 11900.00
  },
  "paging": { "offset": null, "limit": null, "total": null, "totalPages": null, "hasNext": null, "hasPrev": null }
}
```

Both `taxAmount` and `totalWithTax` are rounded to 2 decimal places.

**Error responses:**

| Status | Condition |
|--------|-----------|
| 404 | No active rate found for the jurisdiction (and optional taxType) on or before the given date |

---

### GET /api/tax-rates

Paginated list of tax rates with ADR-003 operator-based filtering.

Results are ordered by `jurisdiction ASC`, then `effectiveFrom DESC`.

**Query parameters:**

| Parameter | Example | Description |
|-----------|---------|-------------|
| `jurisdiction[eq]` | `EU-DE` | Filter by exact jurisdiction |
| `jurisdiction[like]` | `EU` | Partial match |
| `taxType[eq]` | `VAT` | Filter by tax type |
| `active[eq]` | `true` | Filter active/inactive rates |
| `effectiveFrom[gte]` | `2026-01-01` | Effective from on or after |
| `effectiveTo[null]` | `true` | Open-ended rates only |
| `offset` | `0` | Pagination offset (default: 0) |
| `limit` | `20` | Page size (default: 20, max: 100) |

**Response (200):**

```json
{
  "data": [
    {
      "id": "tax-uuid",
      "jurisdiction": "EU-DE",
      "taxType": "VAT",
      "rate": "0.1900",
      "name": "German VAT Standard Rate",
      "active": true,
      "effectiveFrom": "2026-01-01T00:00:00.000Z",
      "effectiveTo": null
    }
  ],
  "paging": {
    "offset": 0,
    "limit": 20,
    "total": 12,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  }
}
```

---

### GET /api/tax-rates/:id

Retrieve a single tax rate by UUID.

**Error:** 404 if not found.

---

### PATCH /api/tax-rates/:id

Update mutable fields on a tax rate. `jurisdiction` and `taxType` are immutable after creation.

Updatable fields: `rate`, `name`, `description`, `effectiveFrom`, `effectiveTo`.

**Example — update rate value:**

```json
{ "rate": 0.21, "name": "German VAT Rate (Post-2026 Increase)" }
```

**Error:** 404 if not found.

---

### DELETE /api/tax-rates/:id

Soft-deactivate a tax rate. Sets `active = false` and `effectiveTo = now()`. The record is retained for historical lookups.

Returns HTTP 200 with the updated rate object (not 204).

**Error:** 404 if not found.

---

## Implementation Details

**Module path:** `src/modules/tax-rates/`

**Files:**
- `tax-rates.controller.ts` — REST endpoints (`GET /calculate` registered before `GET /:id`)
- `tax-rates.service.ts` — business logic
- `tax-rates.module.ts` — NestJS module
- `dto/create-tax-rate.dto.ts` — `@IsIn(TAX_TYPES)` validation; `@Min(0) @Max(1)` on rate
- `dto/update-tax-rate.dto.ts` — `PartialType(OmitType(Create, ['jurisdiction', 'taxType']))` — immutable fields excluded
- `dto/calculate-tax.dto.ts` — `amount`, `jurisdiction`, optional `taxType` and `date`

**Key business rules:**
1. `active: true` is always set on creation — not client-configurable at create time
2. Deactivation is soft: `active = false` + `effectiveTo = new Date()` — records remain queryable
3. `calculateTax` uses `findFirst` with combined date range and `active: true` filter — respects both `effectiveFrom` and `effectiveTo` constraints
4. `taxType` filter on calculate is optional — if omitted, the first matching active rate for the jurisdiction is used
5. `taxAmount` = `amount × rate`, rounded to 2 dp; `totalWithTax` = `amount + taxAmount`
6. `jurisdiction` and `taxType` are stored as entered (no normalisation) — callers must use consistent codes

---

## Testing

**File:** `src/modules/tax-rates/tax-rates.service.spec.ts`

**Test scenarios (17 cases):**

| Suite | Tests |
|-------|-------|
| `create` | Creates with `active: true`; sets `effectiveTo` when provided |
| `findAll` | Returns paginated list; respects pagination params |
| `findOne` | Returns rate by id; throws 404 for unknown id |
| `calculateTax` | Calculates 19% VAT correctly; throws 404 when no active rate; calculates 0 tax for 0% rate; applies `taxType` filter when provided; defaults to today when date omitted |
| `deactivate` | Sets `active = false` on soft delete; throws 404 for unknown id |

**Run tests:**

```bash
cd packages/revenue-backend
npx jest tax-rates --no-coverage
```

---

## Usage Examples

**Create German VAT rate:**

```bash
curl -X POST http://localhost:5177/api/tax-rates \
  -H "Content-Type: application/json" \
  -d '{
    "jurisdiction": "EU-DE",
    "taxType": "VAT",
    "rate": 0.19,
    "name": "German VAT Standard Rate",
    "effectiveFrom": "2026-01-01"
  }'
```

**Calculate VAT on a €10,000 invoice:**

```bash
curl "http://localhost:5177/api/tax-rates/calculate?amount=10000&jurisdiction=EU-DE&taxType=VAT"
```

**List all active rates for EU jurisdictions:**

```bash
curl "http://localhost:5177/api/tax-rates?jurisdiction[like]=EU&active[eq]=true"
```

**Deactivate a superseded rate:**

```bash
curl -X DELETE http://localhost:5177/api/tax-rates/tax-uuid
```

**Update a rate's value (e.g. rate increase):**

```bash
curl -X PATCH http://localhost:5177/api/tax-rates/tax-uuid \
  -H "Content-Type: application/json" \
  -d '{ "rate": 0.21, "effectiveFrom": "2027-01-01" }'
```

---

## Performance

- Indexed on `jurisdiction`, `taxType`, `active`, and `effectiveFrom` — all four columns used in the `calculateTax` lookup
- `calculateTax` runs a single `findFirst` — no aggregation
- `findAll` uses parallel `findMany` + `count` via `Promise.all`

---

## Security

- `rate` validated server-side with `@Min(0) @Max(1)` — prevents invalid percentage values
- `taxType` validated with `@IsIn(TAX_TYPES)` — rejects unknown tax types
- Soft delete preserves audit history; no hard deletes permitted via this API

---

## Related Features

- [Exchange Rates](./exchange-rates.md)
- [Invoices](./invoices.md)
- [Billing Engine](./billing.md)

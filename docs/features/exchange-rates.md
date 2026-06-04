# Exchange Rates

**Status:** Implemented ✅
**Phase:** Phase 4 — Enterprise Operations
**Implementation Date:** April 2026
**ADR Compliance:** [ADR-003: REST API Response Structure & Query Parameters](../adrs/003-rest-api-response-structure.md)

---

## Overview

Maintains a historical table of currency exchange rates and exposes a conversion endpoint. Rates are keyed by currency pair (`fromCurrency`, `toCurrency`) and effective date, allowing historical lookups. The upsert semantic ensures re-running a rate feed never creates duplicates.

## Business Context

- Multi-currency invoicing requires converting amounts to a reporting currency (typically EUR) at a defined exchange rate
- Historical rate storage lets the system look up the exact rate that was in effect on an invoice date, preserving audit accuracy
- The `source` field tracks whether a rate was entered manually or ingested from an external feed (ECB, Open Exchange Rates)

---

## Data Model

```prisma
model ExchangeRate {
  id            String   @id @default(uuid())
  fromCurrency  String   @map("from_currency")
  toCurrency    String   @map("to_currency")
  rate          Decimal  @db.Decimal(14, 6)
  effectiveDate DateTime @map("effective_date") @db.Date
  source        String   @default("manual")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  @@unique([fromCurrency, toCurrency, effectiveDate])
  @@index([fromCurrency, toCurrency])
  @@index([effectiveDate])
  @@map("exchange_rates")
}
```

**Key constraints:**
- `@@unique([fromCurrency, toCurrency, effectiveDate])` — one rate per pair per day; enables upsert
- `rate` stored as `DECIMAL(14, 6)` — supports high-precision rates (up to 6 decimal places)
- Currency codes are always normalised to uppercase on write

### Source Values

| Source | Description |
|--------|-------------|
| `manual` | Entered directly via this API (default) |
| `ecb` | European Central Bank feed |
| `openexchangerates` | Open Exchange Rates feed |

---

## API Endpoints

### POST /api/exchange-rates

Create or update an exchange rate (upsert). If a rate already exists for the same `fromCurrency` + `toCurrency` + `effectiveDate`, its `rate` and `source` are updated. Otherwise a new record is created.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `fromCurrency` | string | Yes | ISO 4217, 3 uppercase letters |
| `toCurrency` | string | Yes | ISO 4217, 3 uppercase letters |
| `rate` | number | Yes | Positive, max 6 decimal places |
| `effectiveDate` | ISO date | Yes | Date this rate is valid from (`YYYY-MM-DD`) |
| `source` | string | No | `manual`, `ecb`, or `openexchangerates` (defaults to `manual`) |

**Validation:**
- `fromCurrency` and `toCurrency` must each be exactly 3 uppercase letters
- `fromCurrency !== toCurrency` (400 if same)
- `rate` must be positive

**Example request:**

```json
{
  "fromCurrency": "USD",
  "toCurrency": "EUR",
  "rate": 0.921543,
  "effectiveDate": "2026-05-31",
  "source": "ecb"
}
```

**Response (201):**

```json
{
  "data": {
    "id": "rate-uuid",
    "fromCurrency": "USD",
    "toCurrency": "EUR",
    "rate": "0.921543",
    "effectiveDate": "2026-05-31T00:00:00.000Z",
    "source": "ecb",
    "createdAt": "2026-06-01T08:00:00.000Z",
    "updatedAt": "2026-06-01T08:00:00.000Z"
  },
  "paging": { "offset": null, "limit": null, "total": null, "totalPages": null, "hasNext": null, "hasPrev": null }
}
```

**Error responses:**

| Status | Condition |
|--------|-----------|
| 400 | `fromCurrency === toCurrency` |
| 400 | Validation error (invalid currency code format, non-positive rate) |

---

### GET /api/exchange-rates/convert

Convert an amount between two currencies using the most-recent rate on or before the given date.

If `from === to`, returns immediately without a DB query (rate = 1, `convertedAmount = amount`).

**Query parameters:**

| Parameter | Type | Required | Example | Description |
|-----------|------|----------|---------|-------------|
| `amount` | number | Yes | `1000` | Amount to convert (positive) |
| `from` | string | Yes | `USD` | Source currency (ISO 4217, 3 uppercase) |
| `to` | string | Yes | `EUR` | Target currency (ISO 4217, 3 uppercase) |
| `date` | ISO date | No | `2026-05-31` | Use rate effective on or before this date (defaults to today) |

**Example request:**

```
GET /api/exchange-rates/convert?amount=1000&from=USD&to=EUR&date=2026-05-31
```

**Response (200):**

```json
{
  "data": {
    "fromCurrency": "USD",
    "toCurrency": "EUR",
    "amount": 1000,
    "convertedAmount": 921.54,
    "rate": 0.921543,
    "effectiveDate": "2026-05-31"
  },
  "paging": { "offset": null, "limit": null, "total": null, "totalPages": null, "hasNext": null, "hasPrev": null }
}
```

`convertedAmount` is rounded to 2 decimal places.

**Error responses:**

| Status | Condition |
|--------|-----------|
| 404 | No rate found for the pair on or before the requested date |

---

### GET /api/exchange-rates

Paginated list of exchange rates. Supports operator-based filtering.

**Query parameters:**

| Parameter | Example | Description |
|-----------|---------|-------------|
| `fromCurrency[eq]` | `USD` | Filter by source currency |
| `toCurrency[eq]` | `EUR` | Filter by target currency |
| `source[eq]` | `ecb` | Filter by rate source |
| `effectiveDate[gte]` | `2026-01-01` | Effective on or after |
| `effectiveDate[lte]` | `2026-12-31` | Effective on or before |
| `offset` | `0` | Pagination offset (default: 0) |
| `limit` | `20` | Page size (default: 20, max: 100) |

Results are ordered by `effectiveDate DESC`, then `fromCurrency ASC`.

**Response (200):**

```json
{
  "data": [
    {
      "id": "rate-uuid",
      "fromCurrency": "USD",
      "toCurrency": "EUR",
      "rate": "0.921543",
      "effectiveDate": "2026-05-31T00:00:00.000Z",
      "source": "ecb"
    }
  ],
  "paging": {
    "offset": 0,
    "limit": 20,
    "total": 365,
    "totalPages": 19,
    "hasNext": true,
    "hasPrev": false
  }
}
```

---

### GET /api/exchange-rates/:id

Retrieve a single exchange rate by UUID.

**Error:** 404 if not found.

---

### PATCH /api/exchange-rates/:id

Update the `rate` value and/or `source` of an existing record. Currency pair (`fromCurrency`, `toCurrency`) and `effectiveDate` are immutable after creation.

**Request body:**

```json
{ "rate": 0.935, "source": "ecb" }
```

Both fields are optional; pass only what needs updating.

**Error:** 404 if not found.

---

### DELETE /api/exchange-rates/:id

Delete an exchange rate record. Returns HTTP 204.

**Error:** 404 if not found.

---

## Implementation Details

**Module path:** `src/modules/exchange-rates/`

**Files:**
- `exchange-rates.controller.ts` — REST endpoints (`GET /convert` registered before `GET /:id` to prevent route shadowing)
- `exchange-rates.service.ts` — business logic
- `exchange-rates.module.ts` — NestJS module
- `dto/create-exchange-rate.dto.ts` — `@IsUppercase` + `@Length(3,3)` validation on currency codes
- `dto/update-exchange-rate.dto.ts` — only `rate` and `source` updatable
- `dto/convert-currency.dto.ts` — `amount`, `from`, `to`, optional `date`
- `dto/query-exchange-rates.dto.ts` — ADR-003 filter DTO

**Key business rules:**
1. Currency codes are normalised to uppercase via `.toUpperCase()` before all DB operations
2. `fromCurrency === toCurrency` is rejected with 400 — prevents trivial identity records
3. Upsert uses the `@@unique` constraint on `[fromCurrency, toCurrency, effectiveDate]` as the lookup key
4. Conversion uses `findFirst` with `effectiveDate: { lte: asOfDate }` ordered by `effectiveDate DESC` — picks the most recent rate on or before the target date
5. `convertedAmount` is rounded to 2 decimal places using `parseFloat((amount * rate).toFixed(2))`
6. Same-currency conversion (`from === to`) short-circuits — no DB query, returns `rate: 1`

---

## Testing

**File:** `src/modules/exchange-rates/exchange-rates.service.spec.ts`

**Test scenarios (19 cases):**

| Suite | Tests |
|-------|-------|
| `upsert` | Creates new rate; normalises codes to uppercase; defaults source to `manual`; throws 400 when `from === to` |
| `findAll` | Returns paginated list with paging metadata; applies pagination params |
| `findOne` | Returns rate by id; throws 404 for unknown id |
| `update` | Updates rate value; throws 404 |
| `remove` | Deletes record and returns confirmation; throws 404 |
| `convert` | Converts USD→EUR using stored rate; returns original amount with rate=1 for same-currency; normalises codes to uppercase; uses provided date for lookup; throws 404 when no rate exists; rounds to 2 decimal places |

**Run tests:**

```bash
cd packages/revenue-backend
npx jest exchange-rates --no-coverage
```

---

## Usage Examples

**Upsert today's USD/EUR rate:**

```bash
curl -X POST http://localhost:5177/api/exchange-rates \
  -H "Content-Type: application/json" \
  -d '{
    "fromCurrency": "USD",
    "toCurrency": "EUR",
    "rate": 0.921543,
    "effectiveDate": "2026-06-04",
    "source": "ecb"
  }'
```

**Convert $10,000 USD to EUR as of May 31:**

```bash
curl "http://localhost:5177/api/exchange-rates/convert?amount=10000&from=USD&to=EUR&date=2026-05-31"
```

**List all USD/EUR rates from 2026:**

```bash
curl "http://localhost:5177/api/exchange-rates?fromCurrency[eq]=USD&toCurrency[eq]=EUR&effectiveDate[gte]=2026-01-01"
```

---

## Performance

- `@@index([fromCurrency, toCurrency])` and `@@index([effectiveDate])` cover the two main query patterns
- `convert` uses a single indexed `findFirst` with `lte` date filter — no full-table scan
- `findAll` uses parallel `findMany` + `count` via `Promise.all`

---

## Security

- `rate` is stored as `DECIMAL(14, 6)` — precision preserved without floating-point error
- Currency code format validated server-side (`@IsUppercase`, `@Length(3,3)`) to prevent injection or malformed keys

---

## Related Features

- [Invoices](./invoices.md)
- [Tax Rates](./tax-rates.md)
- [Billing Engine](./billing.md)

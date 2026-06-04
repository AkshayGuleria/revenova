# Webhooks

**Status:** Implemented ✅
**Phase:** Phase 5 — Analytics & Optimization
**Implementation Date:** May 2026
**ADR Compliance:** [ADR-003: REST API Response Structure & Query Parameters](../adrs/003-rest-api-response-structure.md)

---

## Overview

The Webhooks module allows accounts to register HTTP endpoints that receive real-time event notifications when significant platform events occur. Webhook endpoints subscribe to one or more named events; the platform delivers a signed HTTP POST to each active matching endpoint when those events are triggered by other services.

## Business Context

- Enterprise customers integrate the platform with their own ERP, CRM, or finance systems and need push notifications rather than polling
- The signing mechanism (HMAC-SHA256) allows recipients to verify the payload was genuinely sent by the platform
- The secret is generated server-side and returned only at registration time — it is never retrievable via the API thereafter
- Delivery records provide an observable history so customers can diagnose integration failures without contacting support

---

## Supported Events

11 event types are supported:

| Event | Triggered when |
|-------|---------------|
| `invoice.created` | A new invoice is created |
| `invoice.paid` | An invoice status moves to `paid` |
| `invoice.overdue` | An invoice passes its due date unpaid |
| `payment.received` | A payment is recorded |
| `payment.voided` | A payment is voided |
| `contract.created` | A new contract is created |
| `contract.renewed` | A contract is renewed (end date extended) |
| `contract.expiring` | A contract enters the expiring-soon window |
| `purchase_order.approved` | A purchase order is approved |
| `purchase_order.rejected` | A purchase order is rejected |
| `account.credit_hold` | An account is placed on credit hold |

---

## Data Model

### `WebhookEndpoint`

```prisma
model WebhookEndpoint {
  id          String   @id @default(uuid())
  accountId   String   @map("account_id")
  url         String
  secret      String                          -- HMAC signing secret (stored, never returned after creation)
  events      String[]
  active      Boolean  @default(true)
  description String?

  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  account     Account           @relation(fields: [accountId], references: [id])
  deliveries  WebhookDelivery[]

  @@map("webhook_endpoints")
}
```

### `WebhookDelivery`

```prisma
model WebhookDelivery {
  id             String    @id @default(uuid())
  webhookId      String    @map("webhook_id")
  event          String
  payload        Json
  status         String    @default("pending")  -- pending | delivered | failed
  responseStatus Int?      @map("response_status")
  responseBody   String?   @map("response_body")
  attemptCount   Int       @default(0) @map("attempt_count")
  lastAttemptAt  DateTime? @map("last_attempt_at")
  deliveredAt    DateTime? @map("delivered_at")
  createdAt      DateTime  @default(now()) @map("created_at")

  endpoint        WebhookEndpoint @relation(fields: [webhookId], references: [id])

  @@map("webhook_deliveries")
}
```

---

## API Endpoints

### `POST /api/webhooks`

Register a new webhook endpoint for an account. The signing `secret` is returned **once** in this response and never again.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `accountId` | UUID string | Yes | Account this webhook belongs to |
| `url` | URL string | Yes | HTTPS endpoint to deliver events to |
| `events` | string[] | Yes | One or more event names (min 1); must all be from the supported list |
| `description` | string | No | Human-readable label for this endpoint |

**Example request:**
```json
{
  "accountId": "123e4567-e89b-12d3-a456-426614174000",
  "url": "https://erp.acme.com/webhooks/revenue",
  "events": ["invoice.created", "invoice.paid", "payment.received"],
  "description": "Production billing webhook"
}
```

**Example response (201):**
```json
{
  "data": {
    "id": "wh-uuid",
    "accountId": "123e4567-...",
    "url": "https://erp.acme.com/webhooks/revenue",
    "events": ["invoice.created", "invoice.paid", "payment.received"],
    "active": true,
    "description": "Production billing webhook",
    "secret": "a3f9c2e1d4b7...",
    "createdAt": "2026-05-01T10:00:00.000Z",
    "updatedAt": "2026-05-01T10:00:00.000Z"
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

> **Important:** Store the `secret` value immediately. It is a 64-character hex string (32 random bytes) and will never be returned by the API again.

**Error responses:**
- `400` — invalid event name(s) in the `events` array; error message lists the invalid names and all valid options
- `400` — `url` is not a valid URL (`@IsUrl()` validation)
- `404` — account not found

---

### `GET /api/webhooks`

List webhook endpoints. `secret` is **never** included in list or single-get responses.

**Query parameters (ADR-003 operators):**

| Parameter | Example | Description |
|-----------|---------|-------------|
| `accountId[eq]` | `?accountId[eq]=uuid` | Filter by account |
| `active[eq]` | `?active[eq]=true` | Filter by active status |
| `offset[eq]` | `?offset[eq]=0` | Pagination offset |
| `limit[eq]` | `?limit[eq]=20` | Page size |

**Example response (200):**
```json
{
  "data": [
    {
      "id": "wh-uuid",
      "accountId": "123e4567-...",
      "url": "https://erp.acme.com/webhooks/revenue",
      "events": ["invoice.created", "invoice.paid"],
      "active": true,
      "description": "Production billing webhook",
      "createdAt": "2026-05-01T10:00:00.000Z",
      "updatedAt": "2026-05-01T10:00:00.000Z"
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

### `GET /api/webhooks/:id`

Retrieve a single webhook endpoint by UUID. `secret` is omitted.

**Error responses:**
- `404` — webhook not found

---

### `DELETE /api/webhooks/:id`

Soft-deactivate a webhook endpoint (sets `active = false`). The endpoint record and its delivery history are preserved.

**Example response (200):**
```json
{
  "data": {
    "id": "wh-uuid",
    "active": false,
    ...
  },
  "paging": { "offset": null, ... }
}
```

**Error responses:**
- `404` — webhook not found

> Note: Despite the HTTP method being `DELETE`, this is a soft deactivation — it does **not** return 204 and does **not** delete the record.

---

### `GET /api/webhooks/:id/deliveries`

Get the last 50 delivery attempts for a webhook endpoint, ordered by `createdAt DESC`.

**Example response (200):**
```json
{
  "data": [
    {
      "id": "del-uuid",
      "webhookId": "wh-uuid",
      "event": "invoice.created",
      "payload": { "invoiceId": "inv-uuid" },
      "status": "delivered",
      "responseStatus": 200,
      "responseBody": "OK",
      "attemptCount": 1,
      "lastAttemptAt": "2026-05-15T09:30:00.000Z",
      "deliveredAt": "2026-05-15T09:30:00.000Z",
      "createdAt": "2026-05-15T09:30:00.000Z"
    }
  ],
  "paging": {
    "offset": 0,
    "limit": 50,
    "total": 1,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  }
}
```

**Error responses:**
- `404` — webhook not found

---

## Dispatch Mechanism

The `WebhooksService.dispatch()` method is called by other services (e.g. `InvoicesService`, `PaymentsService`) after mutations. It is not exposed as an HTTP endpoint.

```typescript
// Called by InvoicesService after status change to 'paid':
await this.webhooksService.dispatch(invoice.accountId, 'invoice.paid', {
  invoiceId: invoice.id,
  invoiceNumber: invoice.invoiceNumber,
});
```

### Dispatch flow

1. Query all `active = true` webhook endpoints for the account where the `events` array contains the event name
2. For each matching endpoint, create a `WebhookDelivery` record with `status: 'pending'`
3. Call `attemptDelivery()` fire-and-forget (errors are caught and recorded, not propagated to the caller)

### Delivery payload format

```json
{
  "event": "invoice.paid",
  "data": { "invoiceId": "inv-uuid", "invoiceNumber": "INV-2026-000123" },
  "timestamp": "2026-05-15T09:30:00.000Z"
}
```

### Signature verification

The delivery is signed with HMAC-SHA256 over the raw JSON body:

```
X-Webhook-Signature: sha256=<hex-digest>
X-Webhook-Event: invoice.paid
```

Recipients should verify the signature:
```javascript
const expectedSig = crypto
  .createHmac('sha256', webhookSecret)
  .update(rawBody)
  .digest('hex');
const isValid = `sha256=${expectedSig}` === req.headers['x-webhook-signature'];
```

### Delivery outcome

- HTTP timeout: **10 seconds** (`AbortSignal.timeout(10000)`)
- `status: 'delivered'` — if response `ok` (2xx)
- `status: 'failed'` — if non-2xx or network error/timeout
- `responseStatus`, `responseBody`, `attemptCount`, `lastAttemptAt`, `deliveredAt` are updated after each attempt

> Current implementation makes a single attempt. Retry logic (exponential backoff, up to 3 attempts) is planned for a future phase.

---

## Implementation Details

### Project Structure

```
src/modules/webhooks/
├── webhooks.controller.ts
├── webhooks.service.ts
├── webhooks.module.ts
└── dto/
    ├── create-webhook.dto.ts   # CreateWebhookDto + VALID_EVENTS const
    └── index.ts
```

### Key Implementation Notes

1. **Secret generation** — `crypto.randomBytes(32).toString('hex')` produces a 64-character hex string per registration; the secret is stored in the DB and included in the `create` response only.
2. **Secret exclusion from reads** — `findAll` and `findOne` use Prisma `select` to explicitly omit the `secret` field; it is never returned after creation.
3. **Event validation** — `VALID_EVENTS` is a `const` tuple exported from `create-webhook.dto.ts`. Invalid event names in the `events` array cause an immediate `BadRequestException` listing the problematic names.
4. **Soft delete** — `deactivate` sets `active = false` and returns the updated record. Delivery history is retained for audit purposes.
5. **Fire-and-forget delivery** — `dispatch()` does not await `attemptDelivery()`. The calling service's request latency is not affected by webhook delivery time.
6. **`updateMany` for delivery status** — uses `updateMany` with `{ webhookId, event, status: 'pending' }` to locate and update the pending delivery record after HTTP response is received.

---

## Testing

**Service spec:** `src/modules/webhooks/webhooks.service.spec.ts`

Test scenarios covered:

| Scenario | Assertion |
|----------|-----------|
| `create` — happy path | 64-char secret generated and returned; Prisma `create` called with `active: true` |
| `create` — unknown account | `NotFoundException` |
| `create` — invalid event names | `BadRequestException` |
| `create` — all valid events accepted | no error |
| `findAll` — paginated list | `secret` field absent from response items |
| `findAll` — operator filter applied | `where` clause passed to Prisma |
| `findOne` — found | `secret` absent; `paging.total` null |
| `findOne` — not found | `NotFoundException` |
| `deactivate` — active → inactive | `active: false` in response; Prisma `update` called with `{ active: false }` |
| `deactivate` — not found | `NotFoundException` |
| `getDeliveries` — known webhook | delivery records returned with `paging.total` |
| `getDeliveries` — not found | `NotFoundException` |
| `dispatch` — matching webhooks | one `WebhookDelivery` record created per matching endpoint |
| `dispatch` — no matching webhooks | no delivery records created |

**Run tests:**
```bash
cd packages/revenue-backend
npx jest webhooks --no-coverage
```

---

## Usage Examples

**Register a webhook for invoice events:**
```bash
curl -X POST http://localhost:5177/api/webhooks \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "123e4567-...",
    "url": "https://erp.acme.com/hooks",
    "events": ["invoice.created", "invoice.paid"],
    "description": "Production ERP integration"
  }'
```

**List active webhooks for an account:**
```bash
curl "http://localhost:5177/api/webhooks?accountId[eq]=123e4567-...&active[eq]=true"
```

**Check delivery history:**
```bash
curl "http://localhost:5177/api/webhooks/wh-uuid/deliveries"
```

**Deactivate a webhook:**
```bash
curl -X DELETE http://localhost:5177/api/webhooks/wh-uuid
```

---

## Performance

- Active webhook lookup in `dispatch()` uses `{ accountId, active: true, events: { has: event } }` — index on `accountId` makes this efficient for accounts with many endpoints
- Delivery is fire-and-forget; it does not add latency to the triggering request
- `getDeliveries` caps at 50 records — no pagination parameter is needed for the typical monitoring use case

---

## Security

- Signing secret is generated with `crypto.randomBytes(32)` — cryptographically random, 256-bit entropy
- Secret is stored in the DB and never returned after the creation response
- All read/list endpoints use Prisma `select` to explicitly exclude the `secret` column
- HMAC-SHA256 signature allows recipients to verify authenticity of each delivery
- 10-second delivery timeout prevents the platform from being affected by slow or unresponsive recipient servers
- `url` field validated as a proper URL by `@IsUrl()` — prevents registering non-URL strings

---

## Related Features

- [Audit Log](./audit-log.md)
- [Invoices](./invoices.md)
- [Payments](./payments.md)
- [Contracts](./contracts.md)
- [Renewals](./renewals.md)

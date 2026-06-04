# Audit Log

**Status:** Implemented ✅
**Phase:** Phase 5 — Analytics & Optimization
**Implementation Date:** May 2026
**ADR Compliance:** [ADR-003: REST API Response Structure & Query Parameters](../adrs/003-rest-api-response-structure.md)

---

## Overview

The Audit Log module provides an immutable, append-only trail of all significant mutations across the platform. It records who did what to which entity and when, including a structured `changes` diff (before/after values) and optional `metadata`. The module exposes both a programmatic `log()` method (for internal use by other services) and a REST API for querying log entries.

## Business Context

- **SOC2 / GDPR compliance** — financial mutations require a durable audit trail; this is a mandatory constraint from `CLAUDE.md`
- All financial mutations (invoices, payments, contracts) call `AuditLogService.log()` after state changes
- Finance and compliance teams can query the log to reconstruct the history of any entity without consulting application developers
- The log is write-once from an application perspective — there is no `PATCH` or `DELETE` endpoint

---

## Data Model

### `AuditLog`

```prisma
model AuditLog {
  id         String   @id @default(uuid())
  entityType String   @map("entity_type")
  entityId   String   @map("entity_id")
  action     String
  actorId    String?  @map("actor_id")
  actorType  String   @default("system") @map("actor_type")
  changes    Json?
  metadata   Json?
  createdAt  DateTime @default(now()) @map("created_at")

  @@index([entityType, entityId])
  @@index([actorId])
  @@map("audit_logs")
}
```

**Key fields:**

| Field | Description |
|-------|-------------|
| `entityType` | Resource type, e.g. `invoice`, `payment`, `contract` |
| `entityId` | UUID of the affected resource |
| `action` | Verb describing the mutation, e.g. `created`, `status_changed`, `paid` |
| `actorId` | UUID of the user or system actor; `null` for automated system actions |
| `actorType` | `user` or `system` (defaults to `system`) |
| `changes` | JSON diff — `{ fieldName: { from: oldValue, to: newValue } }` |
| `metadata` | Freeform JSON context (e.g. invoice number, payment reference) |

---

## Internal `log()` API

Other services use `AuditLogService.log()` directly (dependency-injected). This method is **not** exposed as an HTTP endpoint.

```typescript
interface AuditLogEntry {
  entityType: string;
  entityId: string;
  action: string;
  actorId?: string;
  actorType?: string;
  changes?: Record<string, { from: any; to: any }>;
  metadata?: Record<string, any>;
}

// Usage example (from InvoicesService):
await this.auditLogService.log({
  entityType: 'invoice',
  entityId: invoice.id,
  action: 'status_changed',
  actorType: 'system',
  changes: { status: { from: 'draft', to: 'sent' } },
  metadata: { invoiceNumber: 'INV-2026-000123' },
});
```

Defaults applied when fields are omitted:
- `actorId` → `null`
- `actorType` → `'system'`
- `changes` → `null`
- `metadata` → `null`

---

## API Endpoints

### `GET /api/audit-log`

List audit log entries with filtering and pagination. Results ordered by `createdAt DESC`.

**Query parameters (ADR-003 operators):**

| Parameter | Example | Description |
|-----------|---------|-------------|
| `entityType[eq]` | `?entityType[eq]=invoice` | Filter by entity type |
| `action[eq]` | `?action[eq]=status_changed` | Filter by action verb |
| `actorId[eq]` | `?actorId[eq]=user-uuid` | Filter by actor |
| `offset[eq]` | `?offset[eq]=0` | Pagination offset (default: 0) |
| `limit[eq]` | `?limit[eq]=20` | Page size (default: 20, max: 100) |

**Example request:**
```
GET /api/audit-log?entityType[eq]=invoice&action[eq]=paid&limit[eq]=50
```

**Example response (200):**
```json
{
  "data": [
    {
      "id": "log-uuid",
      "entityType": "invoice",
      "entityId": "inv-uuid",
      "action": "paid",
      "actorId": null,
      "actorType": "system",
      "changes": { "status": { "from": "sent", "to": "paid" } },
      "metadata": { "invoiceNumber": "INV-2026-000123" },
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

---

### `GET /api/audit-log/:entityType/:entityId`

Retrieve the full audit trail for a specific entity. Returns all log entries (no pagination limit applied), ordered by `createdAt DESC`.

**Path parameters:**

| Parameter | Example |
|-----------|---------|
| `entityType` | `invoice` |
| `entityId` | `inv-uuid` |

**Example request:**
```
GET /api/audit-log/invoice/inv-uuid-001
```

**Example response (200):**
```json
{
  "data": [
    {
      "id": "log-2",
      "entityType": "invoice",
      "entityId": "inv-uuid-001",
      "action": "paid",
      "actorType": "system",
      "changes": { "status": { "from": "sent", "to": "paid" } },
      "createdAt": "2026-05-15T09:30:00.000Z"
    },
    {
      "id": "log-1",
      "entityType": "invoice",
      "entityId": "inv-uuid-001",
      "action": "created",
      "actorType": "system",
      "changes": null,
      "createdAt": "2026-05-10T08:00:00.000Z"
    }
  ],
  "paging": {
    "offset": 0,
    "limit": 2,
    "total": 2,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  }
}
```

---

### `GET /api/audit-log/:id`

Retrieve a single audit log entry by its UUID.

**Path parameter:** `id` — UUID of the audit log entry.

**Example response (200):**
```json
{
  "data": {
    "id": "log-uuid-001",
    "entityType": "payment",
    "entityId": "pay-uuid-001",
    "action": "created",
    "actorId": null,
    "actorType": "system",
    "changes": null,
    "metadata": null,
    "createdAt": "2026-05-15T09:30:00.000Z"
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

**Error responses:**
- `404` — audit log entry not found

---

## Implementation Details

### Project Structure

```
src/modules/audit-log/
├── audit-log.controller.ts
├── audit-log.service.ts
└── audit-log.module.ts
```

No DTO files — the controller accepts `Record<string, any>` query params (routed through `parseQuery`) and the service exposes a typed `AuditLogEntry` interface defined inline.

### Key Implementation Notes

1. **Write path is internal-only** — `log()` is not an HTTP handler; it is called by other services post-mutation. There is no `POST /api/audit-log` endpoint.
2. **Immutability** — there is no `PATCH`, `PUT`, or `DELETE` endpoint. The DB model has no soft-delete field.
3. **`findByEntity` bypasses pagination** — it fetches all entries for an entity in a single query (no `skip`/`take`). The paging response reflects `total = results.length`. Suitable for entity histories, which are typically small.
4. **Query parsing** — `findAll` delegates filtering to `parseQuery(query)` from `src/common/utils/query-parser.ts`, supporting the full ADR-003 operator set.
5. **Ordering** — all read endpoints sort by `createdAt DESC`, showing the most recent event first.
6. **`actorType` default** — when callers omit `actorType`, the service defaults to `'system'`, correctly attributing automated billing engine actions.

---

## Testing

**Service spec:** `src/modules/audit-log/audit-log.service.spec.ts`

Test scenarios covered:

| Scenario | Assertion |
|----------|-----------|
| `log()` — all fields provided | `prisma.auditLog.create` called with exact payload |
| `log()` — `actorType` omitted | defaults to `'system'`, `actorId` / `changes` / `metadata` default to `null` |
| `findAll` — paginated list | correct `paging.total`, `offset`, `limit`; results returned |
| `findAll` — `entityType` filter | Prisma `where` contains `{ entityType: 'invoice' }` |
| `findByEntity` — full trail | ordered by `createdAt DESC`; `paging.total = count` |
| `findOne` — found | single resource returned; all paging null |
| `findOne` — not found | `NotFoundException` with descriptive message |

**Run tests:**
```bash
cd packages/revenue-backend
npx jest audit-log --no-coverage
```

---

## Usage Examples

**List all audit entries for invoice mutations:**
```bash
curl "http://localhost:5177/api/audit-log?entityType[eq]=invoice"
```

**Get full history of a specific invoice:**
```bash
curl "http://localhost:5177/api/audit-log/invoice/inv-uuid-001"
```

**Filter by action:**
```bash
curl "http://localhost:5177/api/audit-log?entityType[eq]=payment&action[eq]=created"
```

**Get a single audit entry:**
```bash
curl "http://localhost:5177/api/audit-log/log-uuid-001"
```

---

## Performance

- `(entityType, entityId)` is a composite index — the `findByEntity` query is served from index without a full table scan
- `actorId` is indexed for actor-based filtering
- For large deployments, consider partitioning the `audit_logs` table by month to keep query performance stable as the table grows

---

## Security

- The audit log is append-only at the application layer — no mutation endpoints exist
- `changes` and `metadata` are freeform JSON; callers are responsible for not writing PII or secrets into these fields
- Queries accept raw operator params through `parseQuery`; all filtering is via Prisma's typed builder, not raw SQL

---

## Related Features

- [Contracts](./contracts.md)
- [Invoices](./invoices.md)
- [Payments](./payments.md)
- [Webhooks](./webhooks.md)
- [Renewals](./renewals.md)

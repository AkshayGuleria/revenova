# Invoice Groups

**Status:** Implemented ✅
**Phase:** Phase 4 — Enterprise Operations
**Implementation Date:** April 2026
**ADR Compliance:** [ADR-003: REST API Response Structure & Query Parameters](../adrs/003-rest-api-response-structure.md)

---

## Overview

Invoice Groups provide a flexible organisational taxonomy for splitting and categorising invoices within an account. A group represents a logical billing unit — a department, cost centre, geographic location, or a custom dimension — that invoices can be tagged against for reporting and chargeback purposes.

## Business Context

- Enterprise customers typically need to distribute costs across internal cost centres, departments, or regions
- Invoice groups act as the binding label: an invoice is associated with a group so that finance teams can filter, aggregate, and reconcile spend per organisational dimension
- Groups are scoped to a single account; the same code can exist across different accounts without conflict
- The system prevents deletion of a group that still has invoices attached, preserving referential integrity

---

## Data Model

### `InvoiceGroup`

```prisma
model InvoiceGroup {
  id        String           @id @default(uuid())
  accountId String           @map("account_id")
  name      String
  groupType InvoiceGroupType @map("group_type")
  code      String?
  metadata  Json?

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  account   Account   @relation(fields: [accountId], references: [id])
  invoices  Invoice[]

  @@unique([accountId, groupType, code])
  @@index([accountId])
  @@map("invoice_groups")
}

enum InvoiceGroupType {
  DEPARTMENT
  COST_CENTER
  LOCATION
  CUSTOM
}
```

**Unique constraint:** `(accountId, groupType, code)` — prevents duplicate group codes of the same type within an account.

---

## API Endpoints

### `POST /api/invoice-groups`

Create a new invoice group.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `accountId` | UUID string | Yes | Account the group belongs to |
| `name` | string | Yes | Human-readable name (e.g. "Engineering Department") |
| `groupType` | enum | Yes | `DEPARTMENT` \| `COST_CENTER` \| `LOCATION` \| `CUSTOM` |
| `code` | string | No | Short identifier, unique per account + groupType (e.g. `DEPT-ENG`) |
| `metadata` | object | No | Arbitrary JSON payload (e.g. `{ costCenterId: "4400" }`) |

**Example request:**
```json
{
  "accountId": "123e4567-e89b-12d3-a456-426614174000",
  "name": "Engineering Department",
  "groupType": "DEPARTMENT",
  "code": "DEPT-ENG",
  "metadata": { "costCenterId": "4400", "approver": "john.doe@acme.com" }
}
```

**Example response (201):**
```json
{
  "data": {
    "id": "a1b2c3d4-...",
    "accountId": "123e4567-...",
    "name": "Engineering Department",
    "groupType": "DEPARTMENT",
    "code": "DEPT-ENG",
    "metadata": { "costCenterId": "4400", "approver": "john.doe@acme.com" },
    "createdAt": "2026-04-15T10:00:00.000Z",
    "updatedAt": "2026-04-15T10:00:00.000Z",
    "account": { "id": "123e4567-...", "accountName": "Acme Corp" },
    "_count": { "invoices": 0 }
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
- `400` — validation failure
- `404` — account not found
- `409` — group with same `groupType + code` already exists for this account

---

### `GET /api/invoice-groups`

List invoice groups with optional filtering and pagination.

**Query parameters (ADR-003 operators):**

| Parameter | Example | Description |
|-----------|---------|-------------|
| `accountId[eq]` | `?accountId[eq]=uuid` | Filter by account |
| `groupType[eq]` | `?groupType[eq]=DEPARTMENT` | Filter by type |
| `code[like]` | `?code[like]=DEPT` | Case-insensitive substring match on code |
| `name[like]` | `?name[like]=Engineering` | Case-insensitive substring match on name |
| `offset` | `?offset=0` | Pagination offset (default: 0) |
| `limit` | `?limit=20` | Page size (default: 20, max: 100) |

**Example response (200):**
```json
{
  "data": [
    {
      "id": "a1b2c3d4-...",
      "name": "Engineering Department",
      "groupType": "DEPARTMENT",
      "code": "DEPT-ENG",
      "account": { "id": "123e4567-...", "accountName": "Acme Corp" },
      "_count": { "invoices": 12 }
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

### `GET /api/invoice-groups/:id`

Retrieve a single invoice group by UUID.

**Response:** Single resource with `paging` all null. Includes `account` (id + name) and `_count.invoices`.

**Error responses:**
- `404` — invoice group not found

---

### `PATCH /api/invoice-groups/:id`

Update a group's name, code, groupType, or metadata. Account ownership (`accountId`) cannot be changed.

**Request body:** All fields optional (partial update).

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Updated display name |
| `groupType` | enum | Updated classification |
| `code` | string | Updated short code |
| `metadata` | object | Updated metadata JSON |

**Error responses:**
- `404` — group not found
- `409` — new `groupType + code` combination already exists for this account

---

### `DELETE /api/invoice-groups/:id`

Delete an invoice group (hard delete). **Fails** if any invoices are still attached to the group.

**Response:** `204 No Content`

**Error responses:**
- `400` — group has one or more attached invoices; message includes the count
- `404` — group not found

---

## Implementation Details

### Project Structure

```
src/modules/invoice-groups/
├── invoice-groups.controller.ts
├── invoice-groups.service.ts
├── invoice-groups.module.ts
└── dto/
    ├── create-invoice-group.dto.ts   # InvoiceGroupType enum + CreateInvoiceGroupDto
    ├── update-invoice-group.dto.ts   # PartialType(OmitType(Create, ['accountId']))
    ├── query-invoice-groups.dto.ts   # extends BasePaginationDto
    └── index.ts
```

### Key Business Rules

1. **Account validation on create** — the service verifies the `accountId` exists before inserting; throws `NotFoundException` if not found.
2. **Duplicate guard** — Prisma unique constraint `(accountId, groupType, code)` enforced at DB level; service catches Prisma error code `P2002` and converts it to `ConflictException`.
3. **Delete protection** — before deleting, the service counts attached invoices via `_count.invoices`; if `> 0` it throws `BadRequestException` rather than attempting the delete.
4. **Immutable ownership** — `UpdateInvoiceGroupDto` uses `OmitType` to exclude `accountId`; account reassignment is not supported.
5. **Response shape** — all responses use `buildSingleResponse` / `buildPaginatedListResponse` from `src/common/utils/response-builder.ts`.

---

## Testing

**Service spec:** `src/modules/invoice-groups/invoice-groups.service.spec.ts`
**Controller spec:** `src/modules/invoice-groups/invoice-groups.controller.spec.ts`

Test scenarios covered:

| Scenario | Assertion |
|----------|-----------|
| Create — happy path | Record created, response shape validated, paging all null |
| Create — account not found | `NotFoundException` thrown |
| Create — duplicate type+code | `ConflictException` thrown (P2002 mapped) |
| Create — non-P2002 Prisma error | Error re-thrown unwrapped |
| Create — non-Prisma error | Error re-thrown as-is |
| findAll | Paginated list returned with correct `paging.total` |
| findOne — found | Record returned |
| findOne — not found | `NotFoundException` thrown |
| update — happy path | Record updated, DTO applied |
| update — not found | `NotFoundException` thrown |
| update — duplicate code | `ConflictException` thrown |
| update — non-P2002 Prisma error | Error re-thrown unwrapped |
| remove — no invoices | Record deleted |
| remove — has invoices | `BadRequestException` thrown, delete not called |
| remove — not found | `NotFoundException` thrown |

**Run tests:**
```bash
cd packages/revenue-backend
npx jest invoice-groups --no-coverage
```

---

## Usage Examples

**Create a cost centre group:**
```bash
curl -X POST http://localhost:5177/api/invoice-groups \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "123e4567-e89b-12d3-a456-426614174000",
    "name": "APAC Sales",
    "groupType": "COST_CENTER",
    "code": "CC-APAC"
  }'
```

**List all department groups for an account:**
```bash
curl "http://localhost:5177/api/invoice-groups?accountId[eq]=123e4567-...&groupType[eq]=DEPARTMENT"
```

**Search by name substring:**
```bash
curl "http://localhost:5177/api/invoice-groups?name[like]=Engineering"
```

**Delete a group (only when no invoices attached):**
```bash
curl -X DELETE http://localhost:5177/api/invoice-groups/a1b2c3d4-...
```

---

## Performance

- `accountId` is indexed on the `invoice_groups` table, making per-account list queries efficient
- The unique constraint index on `(accountId, groupType, code)` doubles as a query optimisation for filtered lookups by type+code
- `_count.invoices` is resolved via Prisma's nested count — a single SQL `GROUP BY` join, not a second round-trip

---

## Security

- `accountId` is write-once (enforced via DTO shape), preventing ownership reassignment
- Metadata is stored as untyped JSON; callers are responsible for schema consistency within their own metadata conventions
- Input validated by `class-validator` decorators on all DTOs

---

## Related Features

- [Contracts](./contracts.md)
- [Invoices](./invoices.md)
- [Sub-Invoices](./sub-invoices.md)
- [Contract-Product Binding](./contract-product-binding.md)

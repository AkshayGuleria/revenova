# Audit Log + Webhook UI Pages — Design Spec

**Date:** 2026-06-01  
**Status:** Approved  
**Branch target:** master

---

## Overview

Add read-only audit log and webhook management pages to the Revenova frontend. Both features have complete backend APIs (Phase 5). This spec covers only the frontend UI.

**Audit log** is internal/operator-facing — a global compliance trail for all financial mutations.  
**Webhooks** are per-account — operators register and monitor webhook endpoints for each account.

---

## Routes & Navigation

### New routes added to `routes.ts`

```
/audit-log                 → audit-log._index.tsx
/webhooks                  → webhooks._index.tsx
/webhooks/:id              → webhooks.$id.tsx
/accounts/:id  (existing)  → add "Webhooks" tab
```

### Sidebar navigation (`app-shell.tsx`)

Add a "System" group beneath existing nav groups with two entries:
- **Audit Log** — Shield icon (`lucide-react`)
- **Webhooks** — Zap icon (`lucide-react`)

---

## Audit Log Page (`/audit-log`)

### Purpose
Read-only compliance trail. Operators filter by entity type, action, actor type, and date range. Rows expand inline to show the full changes diff and metadata.

### Filter bar
Five controls in a horizontal strip above the table:
- **Entity Type** — select: `invoice`, `contract`, `payment`, `account`, `purchase_order`
- **Action** — select: `created`, `updated`, `deleted`, `status_changed`, `paid`, `voided`, `approved`, `rejected`
- **Actor Type** — select: `user`, `system`
- **Date from** — date input, maps to `createdAt[gte]`
- **Date to** — date input, maps to `createdAt[lte]`
- **Reset** button — clears all filters

### Table columns
| Column | Content |
|---|---|
| Expand toggle | ▶ / ▼ chevron; click to expand/collapse inline |
| Timestamp | `createdAt` formatted as `YYYY-MM-DD HH:mm:ss` |
| Entity | Colour-coded badge for `entityType` + entity ID as secondary text |
| Action | Colour-coded badge for `action` value |
| Actor | `actorType` + `actorId` (secondary) when present |
| Changes | Brief summary: `"field: old → new"` for single-field changes, `"N fields changed"` for multi-field |

**Entity type badge colours:**
- `invoice` → blue
- `contract` → amber
- `payment` → gray
- `account` → green
- `purchase_order` → purple

**Action badge colours:**
- `created` → blue
- `status_changed` / `updated` → purple
- `paid` → green
- `deleted` / `voided` / `rejected` → red
- `approved` → green

### Inline expansion panel
When a row is expanded, a full-width panel replaces the next row showing two side-by-side cards:

**Left — Changes diff:**
Each changed field rendered as:
```
fieldName:  old-value (red)  →  new-value (green)
```
Monospace font. If `changes` is null, show "No field-level diff recorded".

**Right — Metadata:**
Key-value pairs from the `metadata` JSON object (monospace). If null, show "No metadata".

### Pagination
Standard offset pagination (`limit=20`). Shows "Showing X–Y of Z entries" and prev/next controls.

### No create/edit/delete
Audit log is immutable — no mutations exposed in the UI.

---

## Webhooks List Page (`/webhooks`)

### Purpose
Global list of all webhook endpoints across accounts. Operators register new webhooks and deactivate existing ones.

### Filter bar
- **Account** — select dropdown, populated from `GET /api/accounts?limit[eq]=100`
- **Status** — select: All / Active / Inactive

### Table columns
| Column | Content |
|---|---|
| URL | Webhook URL as link that navigates to `/webhooks/:id` |
| Account | `account.accountName` |
| Events | First subscribed event as badge + `+N` overflow badge if more than one |
| Status | `Active` (green) / `Inactive` (red) badge |
| Created | `createdAt` formatted as `YYYY-MM-DD` |
| Actions | "History" link → `/webhooks/:id`; "Deactivate" button (only shown when `active=true`) |

### Register Webhook (modal dialog)
Triggered by "+ Register Webhook" button in the page header. Uses shadcn `Dialog`.

**Form fields:**
- **Account** — required, select dropdown (`GET /api/accounts?limit[eq]=100`)
- **URL** — required, text input, placeholder `https://your-domain.com/webhooks`
- **Events** — required, multi-select checkboxes for all 11 valid events:
  `invoice.created`, `invoice.paid`, `invoice.overdue`, `payment.received`, `payment.voided`, `contract.created`, `contract.renewed`, `contract.expiring`, `purchase_order.approved`, `purchase_order.rejected`, `account.credit_hold`
- **Description** — optional, textarea

**On success:** close modal, show toast "Webhook registered", invalidate `useWebhooks` query. The signing secret returned by the API is shown once in a dismissible alert within the modal before closing: `"Save this secret — it will never be shown again: whs_xxxxx"`.

**On error:** show inline error message, keep modal open.

### Deactivate
Clicking "Deactivate" opens a shadcn `AlertDialog` confirming the action. On confirm calls `DELETE /api/webhooks/:id`. Success: toast "Webhook deactivated", row status badge updates to Inactive, Deactivate button disappears.

---

## Webhook Detail Page (`/webhooks/:id`)

### Header
URL as page title, account name and created date as subtitle, status badge, Deactivate button (same flow as list page).

### Config cards (two-column grid)
- **Subscribed Events** — all event badges displayed
- **Description** — description text or "No description" if absent

### Delivery History table
Fetched from `GET /api/webhooks/:id/deliveries` (last 50 entries).

| Column | Content |
|---|---|
| Event | Event name string |
| Status | `delivered` (green) / `failed` (red) / `pending` (gray) badge |
| HTTP | `responseStatus` integer, green if 2xx, red otherwise |
| Attempts | `attemptCount` |
| Delivered At | `deliveredAt` formatted, `—` if not yet delivered |

Empty state: "No delivery attempts yet."

---

## Account Page Webhooks Tab

Add a "Webhooks" tab to the existing `accounts.$id.tsx` detail page. The page already has four tabs (Details, Hierarchy, Contracts, Invoices) — Webhooks becomes the fifth tab.

Contents: same as the webhooks list page but:
- Pre-filtered to `accountId` from route params (no account filter dropdown shown)
- Account column hidden from table
- "+ Register Webhook" button pre-populates the account field in the modal and disables it

---

## API Hooks

### `app/lib/api/hooks/use-audit-log.ts`

```typescript
useAuditLogs(filters: AuditLogFilters)
  // GET /api/audit-log with entityType, action, actorType, createdAt[gte], createdAt[lte], offset, limit

useEntityAuditTrail(entityType: string, entityId: string)
  // GET /api/audit-log/:entityType/:entityId
```

### `app/lib/api/hooks/use-webhooks.ts`

```typescript
useWebhooks(filters: WebhookFilters)
  // GET /api/webhooks with accountId, active filters

useWebhook(id: string)
  // GET /api/webhooks/:id

useWebhookDeliveries(id: string)
  // GET /api/webhooks/:id/deliveries

useCreateWebhook()
  // POST /api/webhooks mutation — returns signing secret in response

useDeactivateWebhook()
  // DELETE /api/webhooks/:id mutation
```

---

## File Inventory

| File | Type | Notes |
|---|---|---|
| `app/routes/audit-log._index.tsx` | New route | Audit log list + inline expand |
| `app/routes/webhooks._index.tsx` | New route | Webhook list + register modal |
| `app/routes/webhooks.$id.tsx` | New route | Webhook detail + delivery history |
| `app/routes/accounts.$id.tsx` | Modified | Add Webhooks tab |
| `app/lib/api/hooks/use-audit-log.ts` | New hook | Audit log queries |
| `app/lib/api/hooks/use-webhooks.ts` | New hook | Webhook queries + mutations |
| `app/components/layout/app-shell.tsx` | Modified | Add System nav group |
| `packages/revenue-frontend/app/routes.ts` | Modified | Register 3 new routes |

---

## Testing

E2E spec files (written after implementation, following existing patterns):
- `tests/e2e/audit-log.spec.ts` — filter bar, table render, inline expand, pagination
- `tests/e2e/webhooks.spec.ts` — list, register modal (success + error + secret display), deactivate flow, detail page, delivery history

Unit/integration: no new backend work required — all data comes from existing Phase 5 endpoints.

---

## Out of Scope

- Webhook retry-on-failure UI (backend handles retries automatically)
- Editing a webhook endpoint (deactivate + re-register is the flow)
- Audit log export (CSV/PDF) — deferred
- Audit trail tabs on individual invoice/contract detail pages — deferred

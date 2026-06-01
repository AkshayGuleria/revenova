# Audit Log + Webhook UI Pages — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build read-only audit log page and full webhook management pages (list, detail, account tab) backed by the existing Phase 5 REST APIs.

**Architecture:** Three new route files + one modified account route, two new TanStack Query hook files, types added to models.ts, queryKeys added to query-client.ts, two new sidebar nav entries. No new backend work required.

**Tech Stack:** React Router v7, TanStack Query v5, shadcn/ui, Tailwind CSS, Lucide icons, Zod (form validation), react-hook-form.

**Spec:** `docs/superpowers/specs/2026-06-01-audit-log-webhooks-ui-design.md`

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Modify | `app/types/models.ts` | Add AuditLog, WebhookEndpoint, WebhookDelivery interfaces |
| Modify | `app/lib/api/query-client.ts` | Add `auditLog` and `webhooks` queryKeys namespaces |
| Create | `app/lib/api/hooks/use-audit-log.ts` | useAuditLogs, useEntityAuditTrail queries |
| Create | `app/lib/api/hooks/use-webhooks.ts` | useWebhooks, useWebhook, useWebhookDeliveries, useCreateWebhook, useDeactivateWebhook |
| Modify | `app/components/layout/sidebar.tsx` | Add Audit Log + Webhooks entries under System group |
| Modify | `app/routes.ts` | Register /audit-log, /webhooks, /webhooks/:id |
| Create | `app/routes/audit-log._index.tsx` | Audit log list with filter bar + inline row expand |
| Create | `app/routes/webhooks._index.tsx` | Webhook list + register modal |
| Create | `app/routes/webhooks.$id.tsx` | Webhook detail + delivery history |
| Modify | `app/routes/accounts.$id.tsx` | Add fifth "Webhooks" tab |
| Create | `tests/e2e/audit-log.spec.ts` | E2E: filter, table, expand |
| Create | `tests/e2e/webhooks.spec.ts` | E2E: list, register modal, deactivate, detail |

All paths relative to `packages/revenue-frontend/`.

---

## Task 1: Types + QueryKeys

**Files:**
- Modify: `app/types/models.ts`
- Modify: `app/lib/api/query-client.ts`

- [ ] **Step 1: Add AuditLog, WebhookEndpoint, WebhookDelivery types to models.ts**

Append at the end of `app/types/models.ts`:

```typescript
// ── Audit Log ────────────────────────────────────────────────────────────────

export interface AuditLog {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  actorId: string | null;
  actorType: string;
  changes: Record<string, { from: unknown; to: unknown }> | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

// ── Webhooks ─────────────────────────────────────────────────────────────────

export interface WebhookEndpoint {
  id: string;
  accountId: string;
  account?: { accountName: string };
  url: string;
  events: string[];
  active: boolean;
  description: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: string;
  payload: Record<string, unknown>;
  status: string;
  responseStatus: number | null;
  responseBody: string | null;
  attemptCount: number;
  lastAttemptAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
}

export interface CreateWebhookDto {
  accountId: string;
  url: string;
  events: string[];
  description?: string;
}
```

- [ ] **Step 2: Add queryKeys namespaces to query-client.ts**

In `app/lib/api/query-client.ts`, replace the closing block:

```typescript
  // App Config
  config: {
    all: ["app-config"] as const,
  },
} as const;
```

with:

```typescript
  // App Config
  config: {
    all: ["app-config"] as const,
  },

  // Audit Log
  auditLog: {
    all: ["audit-log"] as const,
    lists: () => [...queryKeys.auditLog.all, "list"] as const,
    list: (params?: Record<string, any>) =>
      [...queryKeys.auditLog.lists(), params] as const,
    entityTrail: (entityType: string, entityId: string) =>
      [...queryKeys.auditLog.all, "entity", entityType, entityId] as const,
  },

  // Webhooks
  webhooks: {
    all: ["webhooks"] as const,
    lists: () => [...queryKeys.webhooks.all, "list"] as const,
    list: (params?: Record<string, any>) =>
      [...queryKeys.webhooks.lists(), params] as const,
    details: () => [...queryKeys.webhooks.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.webhooks.details(), id] as const,
    deliveries: (id: string) =>
      [...queryKeys.webhooks.detail(id), "deliveries"] as const,
  },
} as const;
```

- [ ] **Step 3: Typecheck**

```bash
cd packages/revenue-frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/revenue-frontend/app/types/models.ts \
        packages/revenue-frontend/app/lib/api/query-client.ts
git commit -m "feat(frontend): add AuditLog and Webhook types + queryKeys"
```

---

## Task 2: API Hooks

**Files:**
- Create: `app/lib/api/hooks/use-audit-log.ts`
- Create: `app/lib/api/hooks/use-webhooks.ts`

- [ ] **Step 1: Create use-audit-log.ts**

Create `app/lib/api/hooks/use-audit-log.ts`:

```typescript
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../client";
import { queryKeys } from "../query-client";
import type { AuditLog } from "~/types/models";
import type { QueryParams } from "~/types/api";

export function useAuditLogs(params?: QueryParams) {
  return useQuery({
    queryKey: queryKeys.auditLog.list(params),
    queryFn: async () => {
      const response = await apiClient.get<AuditLog[]>("/api/audit-log", params);
      return response;
    },
  });
}

export function useEntityAuditTrail(entityType: string, entityId: string) {
  return useQuery({
    queryKey: queryKeys.auditLog.entityTrail(entityType, entityId),
    queryFn: async () => {
      const response = await apiClient.get<AuditLog[]>(
        `/api/audit-log/${entityType}/${entityId}`
      );
      return response;
    },
    enabled: !!entityType && !!entityId,
  });
}
```

- [ ] **Step 2: Create use-webhooks.ts**

Create `app/lib/api/hooks/use-webhooks.ts`:

```typescript
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../client";
import { queryKeys } from "../query-client";
import type { WebhookEndpoint, WebhookDelivery, CreateWebhookDto } from "~/types/models";
import type { QueryParams } from "~/types/api";

export function useWebhooks(params?: QueryParams) {
  return useQuery({
    queryKey: queryKeys.webhooks.list(params),
    queryFn: async () => {
      const response = await apiClient.get<WebhookEndpoint[]>("/api/webhooks", params);
      return response;
    },
  });
}

export function useWebhook(id: string) {
  return useQuery({
    queryKey: queryKeys.webhooks.detail(id),
    queryFn: async () => {
      const response = await apiClient.get<WebhookEndpoint>(`/api/webhooks/${id}`);
      return response;
    },
    enabled: !!id,
  });
}

export function useWebhookDeliveries(id: string) {
  return useQuery({
    queryKey: queryKeys.webhooks.deliveries(id),
    queryFn: async () => {
      const response = await apiClient.get<WebhookDelivery[]>(
        `/api/webhooks/${id}/deliveries`
      );
      return response;
    },
    enabled: !!id,
  });
}

export function useCreateWebhook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateWebhookDto) => {
      const response = await apiClient.post<WebhookEndpoint & { secret: string }>(
        "/api/webhooks",
        data
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.webhooks.lists() });
    },
  });
}

export function useDeactivateWebhook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.delete<void>(`/api/webhooks/${id}`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.webhooks.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.webhooks.details() });
    },
  });
}
```

- [ ] **Step 3: Typecheck**

```bash
cd packages/revenue-frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/revenue-frontend/app/lib/api/hooks/use-audit-log.ts \
        packages/revenue-frontend/app/lib/api/hooks/use-webhooks.ts
git commit -m "feat(frontend): add useAuditLogs and useWebhooks API hooks"
```

---

## Task 3: Routes + Sidebar Navigation

**Files:**
- Modify: `app/routes.ts`
- Modify: `app/components/layout/sidebar.tsx`

- [ ] **Step 1: Register new routes in routes.ts**

In `app/routes.ts`, add after the billing routes block (before the Renewals comment):

```typescript
  // Audit Log (Phase 5)
  route("audit-log", "routes/audit-log._index.tsx"),

  // Webhooks (Phase 5)
  route("webhooks", "routes/webhooks._index.tsx"),
  route("webhooks/:id", "routes/webhooks.$id.tsx"),
```

- [ ] **Step 2: Add Shield + Zap to sidebar imports and navigation array**

In `app/components/layout/sidebar.tsx`, add `Shield` and `Zap` to the lucide-react import:

```typescript
import {
  LayoutDashboard,
  Building2,
  FileText,
  Package,
  Receipt,
  CreditCard,
  Layers,
  ChevronLeft,
  ChevronRight,
  ShoppingCart,
  Banknote,
  BarChart3,
  RefreshCw,
  Shield,
  Zap,
} from "lucide-react";
```

Then append two entries to the `navigation` array:

```typescript
  { name: "Audit Log", href: "/audit-log", icon: Shield },
  { name: "Webhooks", href: "/webhooks", icon: Zap },
```

- [ ] **Step 3: Verify dev server renders sidebar**

```bash
curl -s http://localhost:5173/app/components/layout/sidebar.tsx | grep -c "Audit Log\|Webhooks"
```

Expected: `2`

- [ ] **Step 4: Commit**

```bash
git add packages/revenue-frontend/app/routes.ts \
        packages/revenue-frontend/app/components/layout/sidebar.tsx
git commit -m "feat(frontend): register audit-log and webhook routes, add sidebar nav"
```

---

## Task 4: Audit Log Page

**Files:**
- Create: `app/routes/audit-log._index.tsx`

- [ ] **Step 1: Write E2E test first (failing)**

Create `tests/e2e/audit-log.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

const NULL_PAGING = { offset: null, limit: null, total: null, totalPages: null, hasNext: null, hasPrev: null };
const LIST_PAGING = (total: number) => ({ offset: 0, limit: 20, total, totalPages: Math.ceil(total / 20), hasNext: total > 20, hasPrev: false });

const MOCK_AUDIT_LOGS = [
  {
    id: 'al-001',
    entityType: 'invoice',
    entityId: 'inv-001',
    action: 'status_changed',
    actorId: null,
    actorType: 'system',
    changes: { status: { from: 'draft', to: 'paid' } },
    metadata: { ip: '192.168.1.1' },
    createdAt: '2026-06-01T09:42:11.000Z',
  },
  {
    id: 'al-002',
    entityType: 'contract',
    entityId: 'con-001',
    action: 'updated',
    actorId: 'usr-001',
    actorType: 'user',
    changes: { autoRenew: { from: false, to: true } },
    metadata: null,
    createdAt: '2026-06-01T09:38:04.000Z',
  },
];

async function mockAuditLogApi(page: any) {
  await page.route('**/api/audit-log**', (route: any) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: MOCK_AUDIT_LOGS, paging: LIST_PAGING(2) }),
    })
  );
}

test.describe('Audit Log Page', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuditLogApi(page);
    await page.goto(`${BASE_URL}/audit-log`);
    await page.waitForLoadState('networkidle');
  });

  test('renders page heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Audit Log' })).toBeVisible();
  });

  test('renders entity type and action filter dropdowns', async ({ page }) => {
    await expect(page.getByRole('combobox').first()).toBeVisible();
  });

  test('renders audit log rows', async ({ page }) => {
    await expect(page.getByText('invoice', { exact: true })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('contract', { exact: true })).toBeVisible({ timeout: 5000 });
  });

  test('clicking expand toggle shows changes diff', async ({ page }) => {
    const firstToggle = page.locator('button[aria-label="expand"]').first();
    await firstToggle.click();
    await expect(page.getByText('status')).toBeVisible({ timeout: 3000 });
  });

  test('shows pagination info', async ({ page }) => {
    await expect(page.getByText(/Showing/)).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Audit Log — Filters', () => {
  test('entity type filter sends request with entityType[eq] param', async ({ page }) => {
    let capturedUrl = '';
    await page.route('**/api/audit-log**', (route: any) => {
      capturedUrl = route.request().url();
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], paging: LIST_PAGING(0) }),
      });
    });

    await page.goto(`${BASE_URL}/audit-log`);
    await page.waitForLoadState('networkidle');

    const entityTypeSelect = page.getByRole('combobox').first();
    await entityTypeSelect.click();
    await page.getByRole('option', { name: 'invoice' }).click();
    await page.waitForLoadState('networkidle');

    expect(capturedUrl).toContain('entityType');
  });

  test('reset filters button clears selections', async ({ page }) => {
    let callCount = 0;
    await page.route('**/api/audit-log**', (route: any) => {
      callCount++;
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], paging: LIST_PAGING(0) }),
      });
    });

    await page.goto(`${BASE_URL}/audit-log`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /reset/i }).click();
    await expect(page.getByRole('button', { name: /reset/i })).toBeVisible();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/revenue-frontend && npx playwright test tests/e2e/audit-log.spec.ts --project=chromium --reporter=line 2>&1 | tail -10
```

Expected: tests fail with route not found / 404.

- [ ] **Step 3: Create audit-log._index.tsx**

Create `app/routes/audit-log._index.tsx`:

```typescript
import { useState } from "react";
import { format } from "date-fns";
import { ChevronRight, ChevronDown } from "lucide-react";
import { AppShell } from "~/components/layout/app-shell";
import { PageHeader } from "~/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import { useAuditLogs } from "~/lib/api/hooks/use-audit-log";
import type { AuditLog } from "~/types/models";
import { PAGINATION } from "~/lib/constants";

const ENTITY_TYPES = ["invoice", "contract", "payment", "account", "purchase_order"];
const ACTIONS = ["created", "updated", "deleted", "status_changed", "paid", "voided", "approved", "rejected"];
const ACTOR_TYPES = ["user", "system"];

const ENTITY_BADGE_COLORS: Record<string, string> = {
  invoice: "bg-blue-50 text-blue-700 border-blue-200",
  contract: "bg-amber-50 text-amber-700 border-amber-200",
  payment: "bg-gray-100 text-gray-700 border-gray-200",
  account: "bg-green-50 text-green-700 border-green-200",
  purchase_order: "bg-purple-50 text-purple-700 border-purple-200",
};

const ACTION_BADGE_COLORS: Record<string, string> = {
  created: "bg-blue-50 text-blue-700",
  updated: "bg-purple-50 text-purple-700",
  status_changed: "bg-purple-50 text-purple-700",
  paid: "bg-green-50 text-green-700",
  approved: "bg-green-50 text-green-700",
  deleted: "bg-red-50 text-red-700",
  voided: "bg-red-50 text-red-700",
  rejected: "bg-red-50 text-red-700",
};

function ChangesDiff({ changes }: { changes: Record<string, { from: unknown; to: unknown }> | null }) {
  if (!changes) return <p className="text-sm text-gray-400">No field-level diff recorded.</p>;
  return (
    <div className="font-mono text-xs space-y-1">
      {Object.entries(changes).map(([field, { from, to }]) => (
        <div key={field}>
          <span className="text-gray-500">{field}: </span>
          <span className="text-red-600">{String(from)}</span>
          <span className="text-gray-400"> → </span>
          <span className="text-green-600">{String(to)}</span>
        </div>
      ))}
    </div>
  );
}

function MetadataPanel({ metadata }: { metadata: Record<string, unknown> | null }) {
  if (!metadata) return <p className="text-sm text-gray-400">No metadata.</p>;
  return (
    <div className="font-mono text-xs space-y-1">
      {Object.entries(metadata).map(([k, v]) => (
        <div key={k}>
          <span className="text-gray-500">{k}: </span>
          <span className="text-gray-700">{String(v)}</span>
        </div>
      ))}
    </div>
  );
}

function changesSummary(changes: AuditLog["changes"]): string {
  if (!changes) return "—";
  const entries = Object.entries(changes);
  if (entries.length === 1) {
    const [field, { from, to }] = entries[0];
    return `${field}: ${String(from)} → ${String(to)}`;
  }
  return `${entries.length} fields changed`;
}

export default function AuditLogRoute() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [entityType, setEntityType] = useState<string>("");
  const [action, setAction] = useState<string>("");
  const [actorType, setActorType] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [offset, setOffset] = useState(PAGINATION.DEFAULT_OFFSET);
  const limit = PAGINATION.DEFAULT_LIMIT;

  const params: Record<string, any> = { "offset[eq]": offset, "limit[eq]": limit };
  if (entityType) params["entityType[eq]"] = entityType;
  if (action) params["action[eq]"] = action;
  if (actorType) params["actorType[eq]"] = actorType;
  if (dateFrom) params["createdAt[gte]"] = dateFrom;
  if (dateTo) params["createdAt[lte]"] = dateTo;

  const { data, isLoading } = useAuditLogs(params);
  const logs = (data?.data as AuditLog[]) ?? [];
  const paging = data?.paging;

  function resetFilters() {
    setEntityType("");
    setAction("");
    setActorType("");
    setDateFrom("");
    setDateTo("");
    setOffset(0);
  }

  return (
    <AppShell>
      <PageHeader
        title="Audit Log"
        description="Read-only compliance trail for all financial mutations"
      />

      {/* Filter bar */}
      <Card className="mt-6 shadow-sm border-0">
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-wrap gap-3 items-center">
            <Select value={entityType} onValueChange={setEntityType}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Entity Type" />
              </SelectTrigger>
              <SelectContent>
                {ENTITY_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={action} onValueChange={setAction}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                {ACTIONS.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={actorType} onValueChange={setActorType}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Actor Type" />
              </SelectTrigger>
              <SelectContent>
                {ACTOR_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-36 text-sm"
              placeholder="Date from"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-36 text-sm"
              placeholder="Date to"
            />

            <Button variant="ghost" size="sm" onClick={resetFilters} className="ml-auto text-gray-500">
              Reset filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="mt-4 shadow-sm border-0 overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-xs uppercase text-gray-500 tracking-wide">
                  <th className="w-8 px-4 py-3" />
                  <th className="text-left px-3 py-3">Timestamp</th>
                  <th className="text-left px-3 py-3">Entity</th>
                  <th className="text-left px-3 py-3">Action</th>
                  <th className="text-left px-3 py-3">Actor</th>
                  <th className="text-left px-3 py-3">Changes</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-gray-400">
                      No audit log entries found.
                    </td>
                  </tr>
                )}
                {logs.map((log) => {
                  const isExpanded = expandedId === log.id;
                  const entityColor = ENTITY_BADGE_COLORS[log.entityType] ?? "bg-gray-100 text-gray-700";
                  const actionColor = ACTION_BADGE_COLORS[log.action] ?? "bg-gray-100 text-gray-700";

                  return (
                    <>
                      <tr
                        key={log.id}
                        className="border-b hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <button
                            aria-label="expand"
                            onClick={() => setExpandedId(isExpanded ? null : log.id)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                        </td>
                        <td className="px-3 py-3 text-gray-600 font-mono text-xs whitespace-nowrap">
                          {format(new Date(log.createdAt), "yyyy-MM-dd HH:mm:ss")}
                        </td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${entityColor}`}>
                            {log.entityType}
                          </span>
                          <span className="ml-2 text-xs text-gray-400">{log.entityId.slice(0, 8)}…</span>
                        </td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${actionColor}`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-gray-700 text-xs">
                          {log.actorType}
                          {log.actorId && (
                            <span className="text-gray-400 ml-1">· {log.actorId.slice(0, 8)}…</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-500">
                          {changesSummary(log.changes)}
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr key={`${log.id}-expand`} className="border-b bg-blue-50/40">
                          <td colSpan={6} className="px-10 py-4">
                            <div className="grid grid-cols-2 gap-6">
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Changes</p>
                                <div className="bg-white border rounded-md p-3">
                                  <ChangesDiff changes={log.changes} />
                                </div>
                              </div>
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Metadata</p>
                                <div className="bg-white border rounded-md p-3">
                                  <MetadataPanel metadata={log.metadata} />
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* Pagination */}
          {paging && paging.total !== null && (
            <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-gray-500">
              <span>
                Showing {offset + 1}–{Math.min(offset + limit, paging.total)} of {paging.total} entries
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!paging.hasPrev}
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                >
                  ← Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!paging.hasNext}
                  onClick={() => setOffset(offset + limit)}
                >
                  Next →
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
```

- [ ] **Step 4: Run E2E tests**

```bash
cd packages/revenue-frontend && npx playwright test tests/e2e/audit-log.spec.ts --project=chromium --reporter=line 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 5: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/revenue-frontend/app/routes/audit-log._index.tsx \
        packages/revenue-frontend/tests/e2e/audit-log.spec.ts
git commit -m "feat(frontend): add /audit-log page with filter bar and inline expand"
```

---

## Task 5: Webhooks List Page + Register Modal

**Files:**
- Create: `app/routes/webhooks._index.tsx`

- [ ] **Step 1: Write E2E tests for webhooks list (failing)**

Create `tests/e2e/webhooks.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

const NULL_PAGING = { offset: null, limit: null, total: null, totalPages: null, hasNext: null, hasPrev: null };
const LIST_PAGING = (total: number) => ({ offset: 0, limit: 20, total, totalPages: 1, hasNext: false, hasPrev: false });

const MOCK_ACCOUNTS = [
  { id: 'acc-001', accountName: 'Acme Corp', accountType: 'enterprise', status: 'active' },
  { id: 'acc-002', accountName: 'Globex Inc', accountType: 'enterprise', status: 'active' },
];

const MOCK_WEBHOOKS = [
  {
    id: 'wh-001',
    accountId: 'acc-001',
    account: { accountName: 'Acme Corp' },
    url: 'https://acme.io/hooks/billing',
    events: ['invoice.paid', 'invoice.overdue', 'payment.received'],
    active: true,
    description: 'Production billing webhook',
    createdAt: '2026-05-10T00:00:00.000Z',
    updatedAt: '2026-05-10T00:00:00.000Z',
  },
  {
    id: 'wh-002',
    accountId: 'acc-002',
    account: { accountName: 'Globex Inc' },
    url: 'https://globex.com/webhooks',
    events: ['contract.renewed'],
    active: false,
    description: null,
    createdAt: '2026-04-22T00:00:00.000Z',
    updatedAt: '2026-04-22T00:00:00.000Z',
  },
];

const MOCK_WEBHOOK = {
  ...MOCK_WEBHOOKS[0],
};

const MOCK_DELIVERIES = [
  {
    id: 'del-001',
    webhookId: 'wh-001',
    event: 'invoice.paid',
    payload: {},
    status: 'delivered',
    responseStatus: 200,
    responseBody: 'ok',
    attemptCount: 1,
    lastAttemptAt: '2026-06-01T09:42:00.000Z',
    deliveredAt: '2026-06-01T09:42:01.000Z',
    createdAt: '2026-06-01T09:42:00.000Z',
  },
  {
    id: 'del-002',
    webhookId: 'wh-001',
    event: 'payment.received',
    payload: {},
    status: 'failed',
    responseStatus: 503,
    responseBody: 'Service Unavailable',
    attemptCount: 3,
    lastAttemptAt: '2026-06-01T09:40:00.000Z',
    deliveredAt: null,
    createdAt: '2026-06-01T09:38:00.000Z',
  },
];

async function mountWebhookMocks(page: any) {
  await page.route('**/api/accounts**', (route: any) =>
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ data: MOCK_ACCOUNTS, paging: LIST_PAGING(2) }) })
  );
  await page.route('**/api/webhooks/wh-001/deliveries**', (route: any) =>
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ data: MOCK_DELIVERIES, paging: { ...NULL_PAGING, total: 2 } }) })
  );
  await page.route('**/api/webhooks/wh-001**', (route: any) =>
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ data: MOCK_WEBHOOK, paging: NULL_PAGING }) })
  );
  await page.route('**/api/webhooks**', (route: any) =>
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ data: MOCK_WEBHOOKS, paging: LIST_PAGING(2) }) })
  );
}

// ── List page ──────────────────────────────────────────────────────────────

test.describe('Webhooks List', () => {
  test.beforeEach(async ({ page }) => {
    await mountWebhookMocks(page);
    await page.goto(`${BASE_URL}/webhooks`);
    await page.waitForLoadState('networkidle');
  });

  test('renders page heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Webhooks' })).toBeVisible();
  });

  test('renders webhook URLs', async ({ page }) => {
    await expect(page.getByText('https://acme.io/hooks/billing')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('https://globex.com/webhooks')).toBeVisible({ timeout: 5000 });
  });

  test('active webhook shows Active badge', async ({ page }) => {
    await expect(page.getByText('Active', { exact: true }).first()).toBeVisible({ timeout: 5000 });
  });

  test('inactive webhook shows Inactive badge', async ({ page }) => {
    await expect(page.getByText('Inactive', { exact: true })).toBeVisible({ timeout: 5000 });
  });

  test('Register Webhook button opens modal', async ({ page }) => {
    await page.getByRole('button', { name: /register webhook/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('register modal has URL and events fields', async ({ page }) => {
    await page.getByRole('button', { name: /register webhook/i }).click();
    await expect(page.getByLabel(/url/i)).toBeVisible();
    await expect(page.getByText('invoice.paid')).toBeVisible({ timeout: 3000 });
  });

  test('register modal validates required fields', async ({ page }) => {
    await page.getByRole('button', { name: /register webhook/i }).click();
    await page.getByRole('button', { name: /register/i }).last().click();
    await expect(page.getByText(/required/i).first()).toBeVisible({ timeout: 3000 });
  });

  test('clicking URL navigates to webhook detail', async ({ page }) => {
    await page.getByText('https://acme.io/hooks/billing').click();
    await expect(page).toHaveURL(`${BASE_URL}/webhooks/wh-001`);
  });

  test('Deactivate button opens confirmation dialog', async ({ page }) => {
    await page.getByRole('button', { name: /deactivate/i }).first().click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
  });
});

// ── Detail page ────────────────────────────────────────────────────────────

test.describe('Webhook Detail', () => {
  test.beforeEach(async ({ page }) => {
    await mountWebhookMocks(page);
    await page.goto(`${BASE_URL}/webhooks/wh-001`);
    await page.waitForLoadState('networkidle');
  });

  test('renders webhook URL as title', async ({ page }) => {
    await expect(page.getByText('https://acme.io/hooks/billing')).toBeVisible({ timeout: 5000 });
  });

  test('renders subscribed events', async ({ page }) => {
    await expect(page.getByText('invoice.paid')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('invoice.overdue')).toBeVisible({ timeout: 5000 });
  });

  test('renders delivery history table', async ({ page }) => {
    await expect(page.getByText('Delivery History')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('delivered', { exact: true })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('failed', { exact: true })).toBeVisible({ timeout: 5000 });
  });

  test('shows HTTP status codes in delivery history', async ({ page }) => {
    await expect(page.getByText('200')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('503')).toBeVisible({ timeout: 5000 });
  });
});
```

- [ ] **Step 2: Run to verify failing**

```bash
cd packages/revenue-frontend && npx playwright test tests/e2e/webhooks.spec.ts --project=chromium --reporter=line 2>&1 | tail -10
```

Expected: all fail with 404.

- [ ] **Step 3: Create webhooks._index.tsx**

Create `app/routes/webhooks._index.tsx`:

```typescript
import { useState } from "react";
import { Link } from "react-router";
import { Plus, Power } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { AppShell } from "~/components/layout/app-shell";
import { PageHeader } from "~/components/layout/page-header";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "~/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "~/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "~/components/ui/form";
import { Checkbox } from "~/components/ui/checkbox";
import { Textarea } from "~/components/ui/textarea";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { useWebhooks, useCreateWebhook, useDeactivateWebhook } from "~/lib/api/hooks/use-webhooks";
import { useAccounts } from "~/lib/api/hooks/use-accounts";
import type { WebhookEndpoint } from "~/types/models";

const VALID_EVENTS = [
  "invoice.created", "invoice.paid", "invoice.overdue",
  "payment.received", "payment.voided",
  "contract.created", "contract.renewed", "contract.expiring",
  "purchase_order.approved", "purchase_order.rejected",
  "account.credit_hold",
] as const;

const registerSchema = z.object({
  accountId: z.string().min(1, "Account is required"),
  url: z.string().url("Must be a valid URL"),
  events: z.array(z.string()).min(1, "Select at least one event"),
  description: z.string().optional(),
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function WebhooksListRoute({
  preselectedAccountId,
  hideAccountColumn,
}: {
  preselectedAccountId?: string;
  hideAccountColumn?: boolean;
} = {}) {
  const [accountFilter, setAccountFilter] = useState(preselectedAccountId ?? "");
  const [statusFilter, setStatusFilter] = useState("");
  const [showRegister, setShowRegister] = useState(false);
  const [deactivateId, setDeactivateId] = useState<string | null>(null);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);

  const params: Record<string, any> = {};
  if (accountFilter) params["accountId[eq]"] = accountFilter;
  if (statusFilter) params["active[eq]"] = statusFilter === "active" ? "true" : "false";

  const { data, isLoading } = useWebhooks(params);
  const { data: accountsData } = useAccounts({ "limit[eq]": 100 });
  const webhooks = (data?.data as WebhookEndpoint[]) ?? [];
  const accounts = (accountsData?.data as any[]) ?? [];

  const createWebhook = useCreateWebhook();
  const deactivateWebhook = useDeactivateWebhook();

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      accountId: preselectedAccountId ?? "",
      url: "",
      events: [],
      description: "",
    },
  });

  async function onSubmit(values: RegisterForm) {
    try {
      const result = await createWebhook.mutateAsync(values);
      const secret = (result as any)?.data?.secret;
      if (secret) setRevealedSecret(secret);
      else {
        setShowRegister(false);
        toast.success("Webhook registered");
        form.reset();
      }
    } catch {
      toast.error("Failed to register webhook");
    }
  }

  async function handleDeactivate() {
    if (!deactivateId) return;
    try {
      await deactivateWebhook.mutateAsync(deactivateId);
      toast.success("Webhook deactivated");
    } catch {
      toast.error("Failed to deactivate webhook");
    } finally {
      setDeactivateId(null);
    }
  }

  function closeModalAfterSecret() {
    setRevealedSecret(null);
    setShowRegister(false);
    toast.success("Webhook registered");
    form.reset();
  }

  return (
    <AppShell>
      <PageHeader
        title="Webhooks"
        description="Register and manage webhook endpoints across all accounts"
      />

      {/* Filters + action */}
      <div className="flex flex-wrap gap-3 items-center mt-6 mb-4">
        {!hideAccountColumn && (
          <Select value={accountFilter} onValueChange={setAccountFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All accounts" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a: any) => (
                <SelectItem key={a.id} value={a.id}>{a.accountName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Any status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <Button className="ml-auto" onClick={() => setShowRegister(true)}>
          <Plus className="h-4 w-4 mr-1" /> Register Webhook
        </Button>
      </div>

      {/* Table */}
      <Card className="shadow-sm border-0 overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-xs uppercase text-gray-500 tracking-wide">
                  <th className="text-left px-4 py-3">URL</th>
                  {!hideAccountColumn && <th className="text-left px-3 py-3">Account</th>}
                  <th className="text-left px-3 py-3">Events</th>
                  <th className="text-left px-3 py-3">Status</th>
                  <th className="text-left px-3 py-3">Created</th>
                  <th className="text-left px-3 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {webhooks.length === 0 && (
                  <tr>
                    <td colSpan={hideAccountColumn ? 5 : 6} className="py-12 text-center text-gray-400">
                      No webhooks found.
                    </td>
                  </tr>
                )}
                {webhooks.map((wh) => (
                  <tr key={wh.id} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        to={`/webhooks/${wh.id}`}
                        className="text-blue-600 hover:underline font-medium text-xs"
                      >
                        {wh.url}
                      </Link>
                    </td>
                    {!hideAccountColumn && (
                      <td className="px-3 py-3 text-gray-700 text-xs">
                        {wh.account?.accountName ?? wh.accountId}
                      </td>
                    )}
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        <span className="bg-blue-50 text-blue-700 border border-blue-200 rounded px-1.5 py-0.5 text-xs">
                          {wh.events[0]}
                        </span>
                        {wh.events.length > 1 && (
                          <span className="bg-blue-50 text-blue-700 border border-blue-200 rounded px-1.5 py-0.5 text-xs">
                            +{wh.events.length - 1}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      {wh.active ? (
                        <span className="bg-green-50 text-green-700 border border-green-200 rounded-full px-2 py-0.5 text-xs font-semibold">
                          Active
                        </span>
                      ) : (
                        <span className="bg-red-50 text-red-700 border border-red-200 rounded-full px-2 py-0.5 text-xs font-semibold">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-gray-500 text-xs">
                      {format(new Date(wh.createdAt), "yyyy-MM-dd")}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex gap-3 text-xs">
                        <Link to={`/webhooks/${wh.id}`} className="text-gray-500 hover:text-gray-700">
                          History
                        </Link>
                        {wh.active && (
                          <button
                            onClick={() => setDeactivateId(wh.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            Deactivate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Register modal */}
      <Dialog open={showRegister} onOpenChange={(o) => { if (!o && !revealedSecret) { setShowRegister(false); form.reset(); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Register Webhook</DialogTitle>
          </DialogHeader>

          {revealedSecret ? (
            <div className="space-y-4">
              <Alert className="border-amber-200 bg-amber-50">
                <AlertDescription className="text-amber-800 text-sm">
                  <strong>Save this secret — it will never be shown again:</strong>
                  <code className="block mt-2 p-2 bg-white rounded border text-xs break-all">
                    {revealedSecret}
                  </code>
                </AlertDescription>
              </Alert>
              <Button className="w-full" onClick={closeModalAfterSecret}>
                I've saved the secret
              </Button>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="accountId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account *</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={!!preselectedAccountId}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select account" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {accounts.map((a: any) => (
                            <SelectItem key={a.id} value={a.id}>{a.accountName}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="https://your-domain.com/webhooks" aria-label="URL" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="events"
                  render={() => (
                    <FormItem>
                      <FormLabel>Events *</FormLabel>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        {VALID_EVENTS.map((event) => (
                          <FormField
                            key={event}
                            control={form.control}
                            name="events"
                            render={({ field }) => (
                              <FormItem className="flex items-center gap-2 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(event)}
                                    onCheckedChange={(checked) => {
                                      const current = field.value ?? [];
                                      field.onChange(
                                        checked
                                          ? [...current, event]
                                          : current.filter((e) => e !== event)
                                      );
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal text-xs cursor-pointer">{event}</FormLabel>
                              </FormItem>
                            )}
                          />
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Optional description" rows={2} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => { setShowRegister(false); form.reset(); }}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createWebhook.isPending}>
                    {createWebhook.isPending ? "Registering…" : "Register"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>

      {/* Deactivate confirmation */}
      <AlertDialog open={!!deactivateId} onOpenChange={(o) => { if (!o) setDeactivateId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Webhook</AlertDialogTitle>
            <AlertDialogDescription>
              This will stop all future deliveries. The webhook and its delivery history will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeactivate}
              className="bg-red-600 hover:bg-red-700"
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
```

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/revenue-frontend/app/routes/webhooks._index.tsx \
        packages/revenue-frontend/tests/e2e/webhooks.spec.ts
git commit -m "feat(frontend): add /webhooks list page with register modal and deactivate"
```

---

## Task 6: Webhook Detail Page

**Files:**
- Create: `app/routes/webhooks.$id.tsx`

- [ ] **Step 1: Create webhooks.$id.tsx**

Create `app/routes/webhooks.$id.tsx`:

```typescript
import { useParams, Link } from "react-router";
import { format } from "date-fns";
import { ArrowLeft, Power } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { AppShell } from "~/components/layout/app-shell";
import { PageHeader } from "~/components/layout/page-header";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "~/components/ui/alert-dialog";
import { useWebhook, useWebhookDeliveries, useDeactivateWebhook } from "~/lib/api/hooks/use-webhooks";
import type { WebhookDelivery } from "~/types/models";

export default function WebhookDetailRoute() {
  const { id } = useParams<{ id: string }>();
  const [showDeactivate, setShowDeactivate] = useState(false);

  const { data: webhookData, isLoading } = useWebhook(id!);
  const { data: deliveriesData, isLoading: deliveriesLoading } = useWebhookDeliveries(id!);
  const deactivateWebhook = useDeactivateWebhook();

  const webhook = webhookData?.data as any;
  const deliveries = (deliveriesData?.data as WebhookDelivery[]) ?? [];

  async function handleDeactivate() {
    try {
      await deactivateWebhook.mutateAsync(id!);
      toast.success("Webhook deactivated");
    } catch {
      toast.error("Failed to deactivate webhook");
    } finally {
      setShowDeactivate(false);
    }
  }

  if (isLoading) {
    return (
      <AppShell>
        <div className="p-6 space-y-4">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppShell>
    );
  }

  if (!webhook) {
    return (
      <AppShell>
        <div className="text-center py-16 text-gray-400">Webhook not found.</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex items-center gap-3 mb-2">
        <Link to="/webhooks" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <PageHeader
          title={webhook.url}
          description={`${webhook.account?.accountName ?? webhook.accountId} · Created ${format(new Date(webhook.createdAt), "yyyy-MM-dd")}`}
        />
        {webhook.active && (
          <Button
            variant="outline"
            size="sm"
            className="ml-auto border-red-200 text-red-600 hover:bg-red-50"
            onClick={() => setShowDeactivate(true)}
          >
            <Power className="h-4 w-4 mr-1" /> Deactivate
          </Button>
        )}
        {!webhook.active && (
          <span className="ml-auto bg-red-50 text-red-700 border border-red-200 rounded-full px-3 py-1 text-xs font-semibold">
            Inactive
          </span>
        )}
      </div>

      {/* Config cards */}
      <div className="grid grid-cols-2 gap-4 mt-6">
        <Card className="shadow-sm border-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-gray-500">Subscribed Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {webhook.events.map((e: string) => (
                <span key={e} className="bg-blue-50 text-blue-700 border border-blue-200 rounded px-2 py-0.5 text-xs">
                  {e}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-gray-500">Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700">
              {webhook.description ?? <span className="text-gray-400">No description.</span>}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Delivery history */}
      <Card className="mt-6 shadow-sm border-0 overflow-hidden">
        <CardHeader className="border-b bg-gray-50 py-3 px-4">
          <CardTitle className="text-sm font-semibold text-gray-700">
            Delivery History <span className="text-gray-400 font-normal">(last 50)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {deliveriesLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-xs uppercase text-gray-500 tracking-wide">
                  <th className="text-left px-4 py-3">Event</th>
                  <th className="text-left px-3 py-3">Status</th>
                  <th className="text-left px-3 py-3">HTTP</th>
                  <th className="text-left px-3 py-3">Attempts</th>
                  <th className="text-left px-3 py-3">Delivered At</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-gray-400 text-sm">
                      No delivery attempts yet.
                    </td>
                  </tr>
                )}
                {deliveries.map((d) => (
                  <tr key={d.id} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-xs font-mono text-gray-700">{d.event}</td>
                    <td className="px-3 py-3">
                      {d.status === "delivered" ? (
                        <span className="bg-green-50 text-green-700 border border-green-200 rounded px-2 py-0.5 text-xs">delivered</span>
                      ) : d.status === "failed" ? (
                        <span className="bg-red-50 text-red-700 border border-red-200 rounded px-2 py-0.5 text-xs">failed</span>
                      ) : (
                        <span className="bg-gray-100 text-gray-600 rounded px-2 py-0.5 text-xs">{d.status}</span>
                      )}
                    </td>
                    <td className={`px-3 py-3 text-xs font-semibold ${d.responseStatus && d.responseStatus >= 200 && d.responseStatus < 300 ? "text-green-600" : "text-red-600"}`}>
                      {d.responseStatus ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-600">{d.attemptCount}</td>
                    <td className="px-3 py-3 text-xs text-gray-500">
                      {d.deliveredAt ? format(new Date(d.deliveredAt), "yyyy-MM-dd HH:mm") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Deactivate confirmation */}
      <AlertDialog open={showDeactivate} onOpenChange={setShowDeactivate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Webhook</AlertDialogTitle>
            <AlertDialogDescription>
              This will stop all future deliveries. The webhook and its delivery history will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeactivate}
              className="bg-red-600 hover:bg-red-700"
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
```

- [ ] **Step 2: Run E2E tests**

```bash
cd packages/revenue-frontend && npx playwright test tests/e2e/webhooks.spec.ts --project=chromium --reporter=line 2>&1 | tail -15
```

Expected: all tests in "Webhook Detail" describe block pass.

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/revenue-frontend/app/routes/webhooks.\$id.tsx
git commit -m "feat(frontend): add /webhooks/:id detail page with delivery history"
```

---

## Task 7: Account Page Webhooks Tab

**Files:**
- Modify: `app/routes/accounts.$id.tsx`

- [ ] **Step 1: Add webhooks import to accounts.$id.tsx**

In `app/routes/accounts.$id.tsx`, add to the import block:

```typescript
import { Zap } from "lucide-react";
import { useWebhooks } from "~/lib/api/hooks/use-webhooks";
import { Link } from "react-router";  // already imported, ensure Link is present
import type { WebhookEndpoint } from "~/types/models";
```

- [ ] **Step 2: Add useWebhooks call inside AccountDetailsRoute**

Inside `AccountDetailsRoute`, after the existing `useContracts` call, add:

```typescript
const { data: webhooksData } = useWebhooks({ "accountId[eq]": accountId });
const accountWebhooks = (webhooksData?.data as WebhookEndpoint[]) ?? [];
```

- [ ] **Step 3: Add Webhooks TabsTrigger**

In `accounts.$id.tsx`, find:

```typescript
<TabsTrigger value="invoices">Invoices</TabsTrigger>
```

and add after it:

```typescript
<TabsTrigger value="webhooks">
  <Zap className="h-4 w-4 mr-1" />Webhooks
</TabsTrigger>
```

- [ ] **Step 4: Add TabsContent for webhooks**

After the closing `</TabsContent>` of the invoices tab, add:

```typescript
<TabsContent value="webhooks">
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <p className="text-sm text-gray-500">
        {accountWebhooks.length} webhook{accountWebhooks.length !== 1 ? "s" : ""} registered for this account
      </p>
      <Link to={`/webhooks?accountId=${accountId}`}>
        <Button variant="outline" size="sm">
          <Zap className="h-4 w-4 mr-1" /> Manage Webhooks
        </Button>
      </Link>
    </div>
    {accountWebhooks.length === 0 ? (
      <div className="text-center py-10 text-gray-400 text-sm">
        No webhooks registered for this account.
      </div>
    ) : (
      <div className="space-y-2">
        {accountWebhooks.map((wh) => (
          <Link key={wh.id} to={`/webhooks/${wh.id}`}>
            <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 transition-colors">
              <div>
                <p className="text-sm font-medium text-blue-600">{wh.url}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {wh.events.slice(0, 3).join(", ")}
                  {wh.events.length > 3 && ` +${wh.events.length - 3} more`}
                </p>
              </div>
              {wh.active ? (
                <span className="bg-green-50 text-green-700 border border-green-200 rounded-full px-2 py-0.5 text-xs font-semibold">
                  Active
                </span>
              ) : (
                <span className="bg-red-50 text-red-700 border border-red-200 rounded-full px-2 py-0.5 text-xs font-semibold">
                  Inactive
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    )}
  </div>
</TabsContent>
```

- [ ] **Step 5: Typecheck**

```bash
cd packages/revenue-frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/revenue-frontend/app/routes/accounts.\$id.tsx
git commit -m "feat(frontend): add Webhooks tab to account detail page"
```

---

## Task 8: Full E2E Run + PR

- [ ] **Step 1: Run all E2E tests on chromium**

```bash
cd packages/revenue-frontend && npx playwright test --project=chromium --reporter=line 2>&1 | tail -5
```

Expected: all pass (no regressions).

- [ ] **Step 2: Run typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Create feature branch and push**

```bash
git checkout -b feature/audit-log-webhooks-ui
git push origin feature/audit-log-webhooks-ui
```

- [ ] **Step 4: Open PR**

```bash
gh pr create \
  --title "feat: add audit-log and webhook UI pages" \
  --body "$(cat <<'EOF'
## Summary
- Add /audit-log page: filter bar (entityType, action, actorType, date range), table with inline expand showing changes diff + metadata
- Add /webhooks list: register modal (with signing secret reveal), deactivate flow, account + status filters
- Add /webhooks/:id detail: config cards + delivery history table (event, status, HTTP code, attempts)
- Add Webhooks tab to /accounts/:id detail page

## Backend
No changes — uses existing Phase 5 endpoints (PR #30).

## Test plan
- [ ] Navigate to /audit-log — filter by entityType, expand a row, verify changes/metadata panel
- [ ] Navigate to /webhooks — register a webhook, save the secret, deactivate one
- [ ] Navigate to /webhooks/:id — verify delivery history shows status + HTTP codes
- [ ] Navigate to /accounts/:id → Webhooks tab — verify scoped list + Manage link
EOF
)"
```

---

## Self-Review Checklist

- [x] All spec sections covered: audit log page, webhooks list, webhooks detail, account tab, API hooks, routes, sidebar
- [x] No TBD/TODO placeholders
- [x] Types defined in Task 1 match usage in Tasks 2–7 (`AuditLog.changes`, `WebhookEndpoint.events`, `WebhookDelivery.responseStatus`)
- [x] queryKey namespaces (`auditLog`, `webhooks`) defined in Task 1 used correctly in Task 2 hooks
- [x] `useDeactivateWebhook` invalidates both `lists()` and `details()` — matches usage in Tasks 5 and 6
- [x] `revealedSecret` state in Task 5 handles the one-time secret display before modal closes
- [x] `preselectedAccountId` prop on `WebhooksListRoute` used in Task 7 account tab (via `/webhooks?accountId=` link rather than embedded component — simpler, avoids prop drilling through route loader)

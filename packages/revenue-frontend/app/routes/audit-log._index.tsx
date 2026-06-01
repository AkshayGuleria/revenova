import React, { useState } from "react";
import { format } from "date-fns";
import { ChevronRight, ChevronDown } from "lucide-react";
import { AppShell } from "~/components/layout/app-shell";
import { PageHeader } from "~/components/layout/page-header";
import { Card, CardContent } from "~/components/ui/card";
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
  const [offset, setOffset] = useState<number>(PAGINATION.DEFAULT_OFFSET);
  const limit = PAGINATION.DEFAULT_LIMIT;

  const params: Record<string, unknown> = { "offset[eq]": offset, "limit[eq]": limit };
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
                    <React.Fragment key={log.id}>
                      <tr className="border-b hover:bg-gray-50 transition-colors">
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
                        <tr className="border-b bg-blue-50/40">
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
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* Pagination */}
          {paging && paging.total !== null && paging.total > 0 && (
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

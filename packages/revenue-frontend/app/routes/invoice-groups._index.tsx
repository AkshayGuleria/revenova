/**
 * Invoice Groups List Route
 * Displays all invoice groups with search, filter, and CRUD actions
 */

import { useState, useCallback } from "react";
import { Link } from "react-router";
import { Plus, Trash2, Edit } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "~/components/layout/app-shell";
import { PageHeader } from "~/components/layout/page-header";
import { Button } from "~/components/ui/button";
import { DataTable, type Column } from "~/components/data-table";
import { StatusBadge } from "~/components/status-badge";
import { EmptyState } from "~/components/empty-state";
import { SearchInput } from "~/components/search-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  useInvoiceGroups,
  useDeleteInvoiceGroup,
} from "~/lib/api/hooks/use-invoice-groups";
import type { InvoiceGroup } from "~/types/models";
import { InvoiceGroupType } from "~/types/models";
import { PAGINATION } from "~/lib/constants";
import { ApiError } from "~/lib/api/client";

const GROUP_TYPE_LABELS: Record<InvoiceGroupType, string> = {
  [InvoiceGroupType.DEPARTMENT]: "Department",
  [InvoiceGroupType.COST_CENTER]: "Cost Center",
  [InvoiceGroupType.LOCATION]: "Location",
  [InvoiceGroupType.CUSTOM]: "Custom",
};

const GROUP_TYPE_COLORS: Record<
  InvoiceGroupType,
  "blue" | "green" | "yellow" | "gray"
> = {
  [InvoiceGroupType.DEPARTMENT]: "blue",
  [InvoiceGroupType.COST_CENTER]: "green",
  [InvoiceGroupType.LOCATION]: "yellow",
  [InvoiceGroupType.CUSTOM]: "gray",
};

export default function InvoiceGroupsListRoute() {
  const [offset, setOffset] = useState<number>(PAGINATION.DEFAULT_OFFSET);
  const [limit] = useState<number>(PAGINATION.DEFAULT_LIMIT);
  const [searchQuery, setSearchQuery] = useState("");
  const [groupTypeFilter, setGroupTypeFilter] = useState<string>("all");
  const [deleteTarget, setDeleteTarget] = useState<InvoiceGroup | null>(null);

  const deleteGroup = useDeleteInvoiceGroup();

  const queryParams: Record<string, any> = {
    "offset[eq]": offset,
    "limit[eq]": limit,
  };
  if (searchQuery) queryParams["name[like]"] = searchQuery;
  if (groupTypeFilter !== "all") queryParams["groupType[eq]"] = groupTypeFilter;

  const { data, isLoading } = useInvoiceGroups(queryParams);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setOffset(0);
  }, []);

  const handleGroupTypeChange = (value: string) => {
    setGroupTypeFilter(value);
    setOffset(0);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await deleteGroup.mutateAsync(deleteTarget.id);
      toast.success(`Group "${deleteTarget.name}" deleted`);
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message || "Failed to delete group");
      } else {
        toast.error("Failed to delete group");
      }
    } finally {
      setDeleteTarget(null);
    }
  };

  const groups = Array.isArray(data?.data)
    ? (data.data as InvoiceGroup[])
    : [];

  const columns: Column<InvoiceGroup>[] = [
    {
      key: "name",
      header: "Name",
      cell: (group) => <span className="font-medium">{group.name}</span>,
    },
    {
      key: "groupType",
      header: "Type",
      cell: (group) => (
        <StatusBadge
          status={GROUP_TYPE_LABELS[group.groupType] ?? group.groupType}
          color={GROUP_TYPE_COLORS[group.groupType] ?? "gray"}
        />
      ),
    },
    {
      key: "code",
      header: "Code",
      cell: (group) =>
        group.code ? (
          <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono">
            {group.code}
          </code>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
    {
      key: "account",
      header: "Account",
      cell: (group) =>
        group.account ? (
          <Link
            to={`/accounts/${group.accountId}`}
            className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
          >
            {group.account.accountName}
          </Link>
        ) : (
          <span className="text-gray-400 text-sm">{group.accountId}</span>
        ),
    },
    {
      key: "invoiceCount",
      header: "Invoices",
      cell: (group) => (
        <span className="text-sm tabular-nums">
          {group._count?.invoices ?? 0}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (group) => {
        const hasInvoices = (group._count?.invoices ?? 0) > 0;
        return (
          <div className="flex items-center gap-2">
            <Link to={`/invoice-groups/${group.id}/edit`}>
              <Button variant="ghost" size="sm">
                <Edit className="h-4 w-4" />
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              disabled={hasInvoices}
              onClick={() => !hasInvoices && setDeleteTarget(group)}
              title={
                hasInvoices ? "Group has attached invoices" : "Delete group"
              }
              className="text-red-500 hover:text-red-700 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <AppShell>
      <PageHeader
        title="Invoice Groups"
        description="Organize invoices by department, cost center, or location"
        actions={
          <div className="flex items-center gap-4">
            <SearchInput
              placeholder="Search groups..."
              onSearch={handleSearch}
              className="w-64"
            />
            <Select
              value={groupTypeFilter}
              onValueChange={handleGroupTypeChange}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.values(InvoiceGroupType).map((type) => (
                  <SelectItem key={type} value={type}>
                    {GROUP_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Link to="/invoice-groups/new">
              <Button className="hover:scale-105 active:scale-95 transition-transform duration-200">
                <Plus className="mr-2 h-4 w-4" />
                New Group
              </Button>
            </Link>
          </div>
        }
      />

      <div className="mt-6">
        <DataTable
          columns={columns}
          data={groups}
          paging={data?.paging}
          isLoading={isLoading}
          onPageChange={setOffset}
          emptyState={
            searchQuery || groupTypeFilter !== "all" ? (
              <EmptyState
                title="No groups found"
                description="No invoice groups match your current filters"
                action={{
                  label: "Clear Filters",
                  onClick: () => {
                    handleSearch("");
                    setGroupTypeFilter("all");
                  },
                }}
              />
            ) : (
              <EmptyState
                title="No invoice groups"
                description="Create groups to organize invoices by department, cost center, or location"
                action={{
                  label: "Create Group",
                  onClick: () =>
                    (window.location.href = "/invoice-groups/new"),
                }}
              />
            )
          }
        />
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Invoice Group</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteTarget?.name}"? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteGroup.isPending}
            >
              {deleteGroup.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

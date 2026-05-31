/**
 * Purchase Orders List Route
 * Displays all purchase orders with search, status filter, and approve/reject inline actions
 */

import { useState, useCallback } from "react";
import { Link } from "react-router";
import { Plus, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "~/components/layout/app-shell";
import { PageHeader } from "~/components/layout/page-header";
import { Button } from "~/components/ui/button";
import { DataTable, type Column } from "~/components/data-table";
import { StatusBadge } from "~/components/status-badge";
import { EmptyState } from "~/components/empty-state";
import { SearchInput } from "~/components/search-input";
import { DateDisplay } from "~/components/date-display";
import { CurrencyDisplay } from "~/components/currency-display";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  usePurchaseOrders,
  useApprovePurchaseOrder,
  useRejectPurchaseOrder,
  type PurchaseOrder,
  type POStatus,
} from "~/lib/api/hooks/use-purchase-orders";
import { PAGINATION } from "~/lib/constants";

const STATUS_COLOR_MAP: Record<
  POStatus,
  "green" | "gray" | "yellow" | "red" | "blue"
> = {
  pending_approval: "yellow",
  approved: "green",
  rejected: "red",
  fulfilled: "blue",
  cancelled: "gray",
};

export default function PurchaseOrdersListRoute() {
  const [offset, setOffset] = useState<number>(PAGINATION.DEFAULT_OFFSET);
  const [limit] = useState<number>(PAGINATION.DEFAULT_LIMIT);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const queryParams: Record<string, any> = {
    "offset[eq]": offset,
    "limit[eq]": limit,
  };
  if (searchQuery) queryParams["poNumber[like]"] = searchQuery;
  if (statusFilter !== "all") queryParams["status[eq]"] = statusFilter;

  const { data, isLoading } = usePurchaseOrders(queryParams);
  const approveMutation = useApprovePurchaseOrder();
  const rejectMutation = useRejectPurchaseOrder();

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setOffset(0);
  }, []);

  const handleApprove = async (id: string) => {
    try {
      await approveMutation.mutateAsync(id);
      toast.success("Purchase order approved");
    } catch {
      toast.error("Failed to approve purchase order");
    }
  };

  const handleReject = async (id: string) => {
    try {
      await rejectMutation.mutateAsync({ id });
      toast.error("Purchase order rejected");
    } catch {
      toast.error("Failed to reject purchase order");
    }
  };

  const columns: Column<PurchaseOrder>[] = [
    {
      key: "poNumber",
      header: "PO Number",
      cell: (po) => (
        <Link
          to={`/purchase-orders/${po.id}`}
          className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
        >
          {po.poNumber}
        </Link>
      ),
    },
    {
      key: "account",
      header: "Account",
      cell: (po) => (
        <Link
          to={`/accounts/${po.accountId}`}
          className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
        >
          {po.account?.accountName || po.accountId}
        </Link>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      cell: (po) => (
        <CurrencyDisplay amount={po.amount} currency={po.currency} />
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (po) => (
        <StatusBadge
          status={po.status}
          color={STATUS_COLOR_MAP[po.status] ?? "gray"}
        />
      ),
    },
    {
      key: "issueDate",
      header: "Issue Date",
      cell: (po) => <DateDisplay date={po.issueDate} />,
    },
    {
      key: "expiryDate",
      header: "Expiry Date",
      cell: (po) =>
        po.expiryDate ? (
          <DateDisplay date={po.expiryDate} />
        ) : (
          <span className="text-gray-400 text-sm">—</span>
        ),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (po) => (
        <div className="flex items-center gap-1">
          {po.status === "pending_approval" && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-green-600 hover:text-green-800 hover:bg-green-50"
                onClick={() => handleApprove(po.id)}
                disabled={approveMutation.isPending}
                title="Approve"
              >
                <CheckCircle className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-red-600 hover:text-red-800 hover:bg-red-50"
                onClick={() => handleReject(po.id)}
                disabled={rejectMutation.isPending}
                title="Reject"
              >
                <XCircle className="h-4 w-4" />
              </Button>
            </>
          )}
          <Link to={`/purchase-orders/${po.id}`}>
            <Button variant="ghost" size="sm">
              View
            </Button>
          </Link>
        </div>
      ),
    },
  ];

  const purchaseOrders = Array.isArray(data?.data)
    ? (data.data as PurchaseOrder[])
    : [];

  return (
    <AppShell>
      <PageHeader
        title="Purchase Orders"
        description="Manage purchase orders and approval workflows"
        actions={
          <div className="flex items-center gap-3 flex-wrap">
            <SearchInput
              placeholder="Search by PO number..."
              onSearch={handleSearch}
              className="w-64"
            />

            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value);
                setOffset(0);
              }}
            >
              <SelectTrigger className="w-44">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending_approval">Pending Approval</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="fulfilled">Fulfilled</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            <Link to="/purchase-orders/new">
              <Button className="hover:scale-105 active:scale-95 transition-transform duration-200">
                <Plus className="mr-2 h-4 w-4" />
                New PO
              </Button>
            </Link>
          </div>
        }
      />

      <div className="mt-6">
        <DataTable
          columns={columns}
          data={purchaseOrders}
          paging={data?.paging}
          isLoading={isLoading}
          onPageChange={setOffset}
          emptyState={
            searchQuery || statusFilter !== "all" ? (
              <EmptyState
                title="No purchase orders found"
                description={
                  searchQuery
                    ? `No purchase orders match "${searchQuery}"`
                    : "No purchase orders match your current filters"
                }
                action={{
                  label: "Clear Filters",
                  onClick: () => {
                    handleSearch("");
                    setStatusFilter("all");
                  },
                }}
              />
            ) : (
              <EmptyState
                title="No purchase orders yet"
                description="Get started by creating your first purchase order"
                action={{
                  label: "Create Purchase Order",
                  onClick: () => (window.location.href = "/purchase-orders/new"),
                }}
              />
            )
          }
        />
      </div>
    </AppShell>
  );
}

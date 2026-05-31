/**
 * Payments List Route
 * Displays all payments with search, status filter, and void action
 */

import { useState, useCallback } from "react";
import { Link } from "react-router";
import { Plus, Ban } from "lucide-react";
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
  usePayments,
  useVoidPayment,
  type Payment,
  type PaymentStatus,
} from "~/lib/api/hooks/use-payments";
import { PAGINATION } from "~/lib/constants";

const STATUS_COLOR_MAP: Record<
  PaymentStatus,
  "green" | "gray" | "yellow" | "red" | "blue"
> = {
  pending: "yellow",
  applied: "green",
  voided: "red",
  failed: "gray",
};

const METHOD_LABELS: Record<string, string> = {
  bank_transfer: "Bank Transfer",
  ach: "ACH",
  wire: "Wire",
  check: "Check",
  credit_card: "Credit Card",
  other: "Other",
};

export default function PaymentsListRoute() {
  const [offset, setOffset] = useState<number>(PAGINATION.DEFAULT_OFFSET);
  const [limit] = useState<number>(PAGINATION.DEFAULT_LIMIT);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const queryParams: Record<string, any> = {
    "offset[eq]": offset,
    "limit[eq]": limit,
  };
  if (searchQuery) queryParams["paymentNumber[like]"] = searchQuery;
  if (statusFilter !== "all") queryParams["status[eq]"] = statusFilter;

  const { data, isLoading } = usePayments(queryParams);
  const voidMutation = useVoidPayment();

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setOffset(0);
  }, []);

  const handleVoid = async (id: string, paymentNumber: string) => {
    if (!confirm(`Are you sure you want to void payment ${paymentNumber}?`)) return;
    try {
      await voidMutation.mutateAsync({ id });
      toast.success("Payment voided");
    } catch {
      toast.error("Failed to void payment");
    }
  };

  const columns: Column<Payment>[] = [
    {
      key: "paymentNumber",
      header: "Payment Number",
      cell: (payment) => (
        <span className="font-medium text-gray-900">{payment.paymentNumber}</span>
      ),
    },
    {
      key: "account",
      header: "Account",
      cell: (payment) => (
        <Link
          to={`/accounts/${payment.accountId}`}
          className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
        >
          {payment.account?.accountName || payment.accountId}
        </Link>
      ),
    },
    {
      key: "invoice",
      header: "Invoice",
      cell: (payment) =>
        payment.invoiceId ? (
          <Link
            to={`/invoices/${payment.invoiceId}`}
            className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
          >
            {payment.invoice?.invoiceNumber || payment.invoiceId}
          </Link>
        ) : (
          <span className="text-gray-400 text-sm">—</span>
        ),
    },
    {
      key: "amount",
      header: "Amount",
      cell: (payment) => (
        <CurrencyDisplay amount={payment.amount} currency={payment.currency} />
      ),
    },
    {
      key: "method",
      header: "Method",
      cell: (payment) => (
        <span className="text-sm text-gray-700">
          {METHOD_LABELS[payment.method] || payment.method}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (payment) => (
        <StatusBadge
          status={payment.status}
          color={STATUS_COLOR_MAP[payment.status] ?? "gray"}
        />
      ),
    },
    {
      key: "paymentDate",
      header: "Payment Date",
      cell: (payment) => <DateDisplay date={payment.paymentDate} />,
    },
    {
      key: "actions",
      header: "Actions",
      cell: (payment) => (
        <div className="flex items-center gap-1">
          {payment.status === "applied" && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-red-600 hover:text-red-800 hover:bg-red-50"
              onClick={() => handleVoid(payment.id, payment.paymentNumber)}
              disabled={voidMutation.isPending}
              title="Void payment"
            >
              <Ban className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  const payments = Array.isArray(data?.data)
    ? (data.data as Payment[])
    : [];

  return (
    <AppShell>
      <PageHeader
        title="Payments"
        description="Track and manage customer payments"
        actions={
          <div className="flex items-center gap-3 flex-wrap">
            <SearchInput
              placeholder="Search by payment number..."
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
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="applied">Applied</SelectItem>
                <SelectItem value="voided">Voided</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>

            <Link to="/payments/new">
              <Button className="hover:scale-105 active:scale-95 transition-transform duration-200">
                <Plus className="mr-2 h-4 w-4" />
                Record Payment
              </Button>
            </Link>
          </div>
        }
      />

      <div className="mt-6">
        <DataTable
          columns={columns}
          data={payments}
          paging={data?.paging}
          isLoading={isLoading}
          onPageChange={setOffset}
          emptyState={
            searchQuery || statusFilter !== "all" ? (
              <EmptyState
                title="No payments found"
                description={
                  searchQuery
                    ? `No payments match "${searchQuery}"`
                    : "No payments match your current filters"
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
                title="No payments recorded"
                description="Get started by recording your first payment"
                action={{
                  label: "Record Payment",
                  onClick: () => (window.location.href = "/payments/new"),
                }}
              />
            )
          }
        />
      </div>
    </AppShell>
  );
}

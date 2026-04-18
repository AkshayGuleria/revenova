/**
 * Invoices List Route
 * Displays all invoices with search, filters, sub-invoice indicators, and pagination
 */

import { useState, useCallback } from "react";
import { Link } from "react-router";
import { Plus, ArrowUpRight } from "lucide-react";
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
import { Badge } from "~/components/ui/badge";
import { useInvoices } from "~/lib/api/hooks/use-invoices";
import { useInvoiceGroups } from "~/lib/api/hooks/use-invoice-groups";
import type { Invoice, InvoiceGroup } from "~/types/models";
import { PAGINATION } from "~/lib/constants";

const STATUS_COLOR_MAP: Record<
  string,
  "green" | "gray" | "yellow" | "red" | "blue"
> = {
  draft: "gray",
  sent: "blue",
  paid: "green",
  overdue: "red",
  cancelled: "gray",
  void: "gray",
};

export default function InvoicesListRoute() {
  const [offset, setOffset] = useState<number>(PAGINATION.DEFAULT_OFFSET);
  const [limit] = useState<number>(PAGINATION.DEFAULT_LIMIT);
  const [searchQuery, setSearchQuery] = useState("");
  const [invoiceGroupFilter, setInvoiceGroupFilter] = useState<string>("all");
  // Default ON: only show top-level invoices
  const [topLevelOnly, setTopLevelOnly] = useState(true);

  // Build query params
  const queryParams: Record<string, any> = {
    "offset[eq]": offset,
    "limit[eq]": limit,
  };
  if (searchQuery) queryParams["invoiceNumber[like]"] = searchQuery;
  if (invoiceGroupFilter !== "all")
    queryParams["invoiceGroupId[eq]"] = invoiceGroupFilter;
  if (topLevelOnly) queryParams["parentInvoiceId[null]"] = "true";

  const { data, isLoading } = useInvoices(queryParams);

  // Load invoice groups for filter dropdown
  const { data: groupsData } = useInvoiceGroups({ "limit[eq]": 100 });
  const groups = Array.isArray(groupsData?.data)
    ? (groupsData.data as InvoiceGroup[])
    : [];

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setOffset(0);
  }, []);

  const handleGroupFilterChange = (value: string) => {
    setInvoiceGroupFilter(value);
    setOffset(0);
  };

  const handleTopLevelToggle = () => {
    setTopLevelOnly((prev) => !prev);
    setOffset(0);
  };

  const columns: Column<Invoice>[] = [
    {
      key: "invoiceNumber",
      header: "Invoice Number",
      cell: (invoice) => (
        <div className="flex items-center gap-2">
          <Link
            to={`/invoices/${invoice.id}`}
            className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
          >
            {invoice.invoiceNumber}
          </Link>
          {/* Sub badge for sub-invoices */}
          {invoice.parentInvoiceId && (
            <Link
              to={`/invoices/${invoice.parentInvoiceId}`}
              title="View parent invoice"
            >
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 h-4 bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 cursor-pointer"
              >
                SUB
                <ArrowUpRight className="ml-0.5 h-2.5 w-2.5" />
              </Badge>
            </Link>
          )}
        </div>
      ),
    },
    {
      key: "account",
      header: "Account",
      cell: (invoice) => (
        <Link
          to={`/accounts/${invoice.accountId}`}
          className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
        >
          {invoice.account?.accountName || invoice.accountId}
        </Link>
      ),
    },
    {
      key: "issueDate",
      header: "Issue Date",
      cell: (invoice) => <DateDisplay date={invoice.issueDate} />,
    },
    {
      key: "dueDate",
      header: "Due Date",
      cell: (invoice) => <DateDisplay date={invoice.dueDate} />,
    },
    {
      key: "total",
      header: "Total",
      cell: (invoice) => (
        <CurrencyDisplay amount={invoice.total} currency={invoice.currency} />
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (invoice) => (
        <StatusBadge
          status={invoice.status}
          color={STATUS_COLOR_MAP[invoice.status] ?? "gray"}
        />
      ),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (invoice) => (
        <Link to={`/invoices/${invoice.id}/edit`}>
          <Button variant="ghost" size="sm">
            Edit
          </Button>
        </Link>
      ),
    },
  ];

  const invoices = Array.isArray(data?.data) ? (data.data as Invoice[]) : [];

  return (
    <AppShell>
      <PageHeader
        title="Invoices"
        description="Manage invoices and track payments"
        actions={
          <div className="flex items-center gap-3 flex-wrap">
            {/* Search Bar */}
            <SearchInput
              placeholder="Search invoices..."
              onSearch={handleSearch}
              className="w-64"
            />

            {/* Invoice Group filter */}
            <Select
              value={invoiceGroupFilter}
              onValueChange={handleGroupFilterChange}
            >
              <SelectTrigger className="w-44">
                <SelectValue placeholder="All groups" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Groups</SelectItem>
                {groups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name}
                    {group.code && (
                      <span className="ml-1.5 text-gray-400 text-xs">
                        {group.code}
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Top-level only toggle */}
            <Button
              variant={topLevelOnly ? "default" : "outline"}
              size="sm"
              onClick={handleTopLevelToggle}
              className="whitespace-nowrap"
            >
              {topLevelOnly ? "Top-level only" : "All invoices"}
            </Button>

            {/* New Invoice Button */}
            <Link to="/invoices/new">
              <Button className="hover:scale-105 active:scale-95 transition-transform duration-200">
                <Plus className="mr-2 h-4 w-4" />
                New Invoice
              </Button>
            </Link>
          </div>
        }
      />

      <div className="mt-6">
        <DataTable
          columns={columns}
          data={invoices}
          paging={data?.paging}
          isLoading={isLoading}
          onPageChange={setOffset}
          emptyState={
            searchQuery || invoiceGroupFilter !== "all" || !topLevelOnly ? (
              <EmptyState
                title="No invoices found"
                description={
                  searchQuery
                    ? `No invoices match "${searchQuery}"`
                    : "No invoices match your current filters"
                }
                action={{
                  label: "Clear Filters",
                  onClick: () => {
                    handleSearch("");
                    setInvoiceGroupFilter("all");
                    setTopLevelOnly(true);
                  },
                }}
              />
            ) : (
              <EmptyState
                title="No invoices found"
                description="Get started by creating your first invoice"
                action={{
                  label: "Create Invoice",
                  onClick: () => (window.location.href = "/invoices/new"),
                }}
              />
            )
          }
        />
      </div>
    </AppShell>
  );
}

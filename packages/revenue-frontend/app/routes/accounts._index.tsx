/**
 * Accounts List Route
 * Displays all accounts with search, filters and pagination
 */

import { useState, useCallback } from "react";
import { Link } from "react-router";
import { Plus } from "lucide-react";
import { AppShell } from "~/components/layout/app-shell";
import { PageHeader } from "~/components/layout/page-header";
import { Button } from "~/components/ui/button";
import { DataTable, type Column } from "~/components/data-table";
import { StatusBadge } from "~/components/status-badge";
import { EmptyState } from "~/components/empty-state";
import { SearchInput } from "~/components/search-input";
import { useAccounts } from "~/lib/api/hooks/use-accounts";
import type { Account } from "~/types/models";
import { PAGINATION } from "~/lib/constants";

export default function AccountsListRoute() {
  const [offset, setOffset] = useState<number>(PAGINATION.DEFAULT_OFFSET);
  const [limit] = useState<number>(PAGINATION.DEFAULT_LIMIT);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch accounts with pagination and search
  const { data, isLoading } = useAccounts({
    "offset[eq]": offset,
    "limit[eq]": limit,
    ...(searchQuery && { "accountName[like]": searchQuery }),
  });

  // Handle search with pagination reset
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setOffset(0); // Reset to first page when searching
  }, []);

  const columns: Column<Account>[] = [
    {
      key: "accountName",
      header: "Account Name",
      cell: (account) => (
        <Link
          to={`/accounts/${account.id}`}
          className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
        >
          {account.accountName}
        </Link>
      ),
    },
    {
      key: "accountType",
      header: "Type",
      cell: (account) => (
        <span className="capitalize">{account.accountType}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (account) => {
        const colorMap: Record<string, "green" | "gray" | "red"> = {
          active: "green",
          inactive: "gray",
          suspended: "red",
        };
        return (
          <StatusBadge
            status={account.status}
            color={colorMap[account.status]}
          />
        );
      },
    },
    {
      key: "primaryContactEmail",
      header: "Contact Email",
      cell: (account) => account.primaryContactEmail,
    },
    {
      key: "paymentTerms",
      header: "Payment Terms",
      cell: (account) => (
        <span className="text-sm text-muted-foreground">
          {account.paymentTerms.replace(/_/g, " ").toUpperCase()}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (account) => (
        <Link to={`/accounts/${account.id}/edit`}>
          <Button variant="ghost" size="sm">
            Edit
          </Button>
        </Link>
      ),
    },
  ];

  const accounts = Array.isArray(data?.data) ? data.data : [];

  return (
    <AppShell>
      <PageHeader
        title="Accounts"
        description="Manage your enterprise accounts and hierarchies"
        actions={
          <div className="flex items-center gap-4">
            {/* Search Bar */}
            <SearchInput
              placeholder="Search accounts..."
              onSearch={handleSearch}
              className="w-80"
            />

            {/* New Account Button */}
            <Link to="/accounts/new">
              <Button className="hover:scale-105 active:scale-95 transition-transform duration-200">
                <Plus className="mr-2 h-4 w-4" />
                New Account
              </Button>
            </Link>
          </div>
        }
      />

      <div className="mt-6">
        <DataTable
          columns={columns}
          data={accounts}
          paging={data?.paging}
          isLoading={isLoading}
          onPageChange={setOffset}
          emptyState={
            searchQuery ? (
              <EmptyState
                title="No accounts found"
                description={`No accounts match "${searchQuery}"`}
                action={{
                  label: "Clear Search",
                  onClick: () => handleSearch(""),
                }}
              />
            ) : (
              <EmptyState
                title="No accounts found"
                description="Get started by creating your first account"
                action={{
                  label: "Create Account",
                  onClick: () => (window.location.href = "/accounts/new"),
                }}
              />
            )
          }
        />
      </div>
    </AppShell>
  );
}

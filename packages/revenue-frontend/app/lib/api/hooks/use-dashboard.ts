/**
 * Dashboard API Hooks
 * TanStack Query hooks for dashboard statistics
 */

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../query-client";
import { useAccounts } from "./use-accounts";
import { useContracts } from "./use-contracts";
import { useInvoices } from "./use-invoices";
import { useAnalyticsSummary } from "./use-analytics";
import { useConfigStore } from "~/lib/stores/config-store";

interface DashboardStats {
  totalAccounts: number;
  activeContracts: number;
  pendingInvoices: {
    count: number;
    totalValue: number;
  };
  monthlyRevenue: number;
  mrr?: number;
  arr?: number;
}

/**
 * Fetch dashboard statistics
 * Aggregates data from accounts, contracts, and invoices endpoints
 */
export function useDashboardStats() {
  // Fetch all accounts (we need total count)
  const { data: accountsData, isLoading: accountsLoading } = useAccounts({
    "limit[eq]": 1, // Just get count from paging
  });

  // Fetch active contracts
  const { data: activeContractsData, isLoading: contractsLoading } = useContracts({
    "status[eq]": "active",
    "limit[eq]": 1, // Just get count from paging
  });

  // Fetch pending invoices
  const { data: pendingInvoicesData, isLoading: invoicesLoading } = useInvoices({
    "status[in]": "draft,sent",
    "limit[eq]": 100, // Fetch more to calculate total value
  });

  // Fetch paid invoices from current month for revenue calculation
  const currentMonthStart = new Date();
  currentMonthStart.setDate(1);
  currentMonthStart.setHours(0, 0, 0, 0);

  const { data: paidInvoicesData, isLoading: paidInvoicesLoading } = useInvoices({
    "status[eq]": "paid",
    "limit[eq]": 100, // Fetch recent paid invoices
  });

  // Fetch analytics summary for real MRR/ARR
  const { data: analyticsSummaryData } = useAnalyticsSummary();

  return useQuery({
    queryKey: queryKeys.dashboard.stats(),
    queryFn: async (): Promise<DashboardStats> => {
      // Calculate total accounts
      const totalAccounts = accountsData?.paging?.total || 0;

      // Calculate active contracts
      const activeContracts = activeContractsData?.paging?.total || 0;

      // Calculate pending invoices count and value
      const pendingInvoicesList = Array.isArray(pendingInvoicesData?.data)
        ? pendingInvoicesData.data
        : [];
      const pendingInvoicesCount = pendingInvoicesData?.paging?.total || pendingInvoicesList.length;
      const pendingInvoicesTotalValue = pendingInvoicesList.reduce(
        (sum, invoice) => sum + (parseFloat(invoice.total as unknown as string) || 0),
        0
      );

      // Calculate monthly revenue from paid invoices
      const paidInvoicesList = Array.isArray(paidInvoicesData?.data)
        ? paidInvoicesData.data
        : [];

      const monthlyRevenue = paidInvoicesList
        .filter((invoice) => {
          const paidDate = invoice.paidDate ? new Date(invoice.paidDate) : null;
          return paidDate && paidDate >= currentMonthStart;
        })
        .reduce((sum, invoice) => sum + (parseFloat(invoice.total as unknown as string) || 0), 0);

      // Use analytics API values if available
      const analyticsData = analyticsSummaryData?.data as any;
      const mrr = analyticsData?.mrr;
      const arr = analyticsData?.arr;

      return {
        totalAccounts,
        activeContracts,
        pendingInvoices: {
          count: pendingInvoicesCount,
          totalValue: pendingInvoicesTotalValue,
        },
        monthlyRevenue,
        mrr,
        arr,
      };
    },
    enabled: !accountsLoading && !contractsLoading && !invoicesLoading && !paidInvoicesLoading,
    staleTime: 2 * 60 * 1000, // 2 minutes (dashboard data changes less frequently)
  });
}

/**
 * Fetch recent activity
 * Returns recent invoices, contracts, and accounts for activity feed
 */
export function useRecentActivity() {
  const { defaultCurrency } = useConfigStore();

  // Fetch recent invoices
  const { data: recentInvoices } = useInvoices({
    "limit[eq]": 5,
    "offset[eq]": 0,
  });

  // Fetch recent contracts
  const { data: recentContracts } = useContracts({
    "limit[eq]": 5,
    "offset[eq]": 0,
  });

  // Fetch recent accounts
  const { data: recentAccounts } = useAccounts({
    "limit[eq]": 5,
    "offset[eq]": 0,
  });

  return useQuery({
    queryKey: queryKeys.dashboard.recentActivity(),
    queryFn: async () => {
      const invoices = Array.isArray(recentInvoices?.data) ? recentInvoices.data : [];
      const contracts = Array.isArray(recentContracts?.data) ? recentContracts.data : [];
      const accounts = Array.isArray(recentAccounts?.data) ? recentAccounts.data : [];

      // Combine and sort by creation date
      const activities = [
        ...invoices.map((invoice) => ({
          type: "invoice" as const,
          id: invoice.id,
          title: `New invoice generated`,
          description: `Invoice ${invoice.invoiceNumber} for ${invoice.account?.accountName || "Unknown"} - ${new Intl.NumberFormat("en-US", { style: "currency", currency: defaultCurrency, maximumFractionDigits: 0 }).format(invoice.total || 0)}`,
          timestamp: invoice.createdAt || invoice.issueDate,
          icon: "receipt" as const,
        })),
        ...contracts.map((contract) => ({
          type: "contract" as const,
          id: contract.id,
          title: contract.status === "renewed" ? "Contract renewed" : "New contract created",
          description: `${contract.contractNumber} for ${contract.account?.accountName || "Unknown"}`,
          timestamp: contract.updatedAt || contract.createdAt,
          icon: "file-text" as const,
        })),
        ...accounts.map((account) => ({
          type: "account" as const,
          id: account.id,
          title: "New account created",
          description: `${account.accountName} - ${account.accountType} tier`,
          timestamp: account.createdAt,
          icon: "building" as const,
        })),
      ];

      // Sort by timestamp descending
      activities.sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return timeB - timeA;
      });

      return activities.slice(0, 5); // Return top 5 most recent
    },
    enabled: !!recentInvoices && !!recentContracts && !!recentAccounts,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Fetch expiring contracts
 * Returns contracts expiring in the next 30 days
 */
export function useExpiringContracts() {
  const today = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(today.getDate() + 30);

  const { data, isLoading } = useContracts({
    "status[eq]": "active",
    "endDate[gte]": today.toISOString().split("T")[0],
    "endDate[lte]": thirtyDaysFromNow.toISOString().split("T")[0],
    "limit[eq]": 10,
  });

  return useQuery({
    queryKey: queryKeys.dashboard.expiringContracts(),
    queryFn: async () => {
      const contracts = Array.isArray(data?.data) ? data.data : [];

      return contracts.map((contract) => {
        const daysUntilExpiry = Math.ceil(
          (new Date(contract.endDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );

        let urgency: "urgent" | "soon" | "watch" = "watch";
        if (daysUntilExpiry <= 15) urgency = "urgent";
        else if (daysUntilExpiry <= 22) urgency = "soon";

        return {
          id: contract.id,
          accountName: contract.account?.accountName || "Unknown Account",
          daysUntilExpiry,
          urgency,
          endDate: contract.endDate,
        };
      });
    },
    enabled: !isLoading && !!data,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

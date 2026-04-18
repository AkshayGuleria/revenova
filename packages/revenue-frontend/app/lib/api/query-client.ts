/**
 * TanStack Query (React Query) Configuration
 */

import { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError } from "./client";

/**
 * Create and configure the QueryClient instance
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is considered fresh for 1 minute
      staleTime: 60 * 1000,

      // Cache data for 5 minutes
      gcTime: 5 * 60 * 1000,

      // Retry failed queries 3 times with exponential backoff
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

      // Refetch on window focus for real-time data
      refetchOnWindowFocus: true,

      // Don't refetch on mount if data is fresh
      refetchOnMount: true,

      // Refetch on reconnect
      refetchOnReconnect: true,

      // Global error handler for queries
      onError: (error) => {
        // Log all query errors for debugging
        if (error instanceof ApiError) {
          console.error("[React Query - Query Error]", {
            statusCode: error.statusCode,
            code: error.code,
            message: error.message,
            details: error.details,
          });

          // Show user-friendly errors for auth failures
          if (error.statusCode === 401) {
            toast.error("Your session has expired. Please log in again.");
          } else if (error.statusCode === 403) {
            toast.error("You don't have permission to access this resource.");
          }
        } else {
          console.error("[React Query - Unexpected Query Error]", error);
        }
      },
    },
    mutations: {
      // Retry mutations once on failure
      retry: 1,
      retryDelay: 1000,

      // Global error handler for mutations
      onError: (error) => {
        if (error instanceof ApiError) {
          console.error("[React Query - Mutation Error]", {
            statusCode: error.statusCode,
            code: error.code,
            message: error.message,
            details: error.details,
          });
        } else {
          console.error("[React Query - Unexpected Mutation Error]", error);
        }
      },
    },
  },
});

/**
 * Query keys factory for consistent key management
 */
export const queryKeys = {
  // Accounts
  accounts: {
    all: ["accounts"] as const,
    lists: () => [...queryKeys.accounts.all, "list"] as const,
    list: (params?: Record<string, any>) =>
      [...queryKeys.accounts.lists(), params] as const,
    details: () => [...queryKeys.accounts.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.accounts.details(), id] as const,
    hierarchy: (id: string) =>
      [...queryKeys.accounts.detail(id), "hierarchy"] as const,
    children: (id: string) =>
      [...queryKeys.accounts.detail(id), "children"] as const,
    ancestors: (id: string) =>
      [...queryKeys.accounts.detail(id), "ancestors"] as const,
    descendants: (id: string) =>
      [...queryKeys.accounts.detail(id), "descendants"] as const,
  },

  // Contracts
  contracts: {
    all: ["contracts"] as const,
    lists: () => [...queryKeys.contracts.all, "list"] as const,
    list: (params?: Record<string, any>) =>
      [...queryKeys.contracts.lists(), params] as const,
    details: () => [...queryKeys.contracts.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.contracts.details(), id] as const,
    shares: (id: string) =>
      [...queryKeys.contracts.detail(id), "shares"] as const,
    sharedWith: (accountId: string) =>
      [...queryKeys.contracts.all, "shared", accountId] as const,
  },

  // Products
  products: {
    all: ["products"] as const,
    lists: () => [...queryKeys.products.all, "list"] as const,
    list: (params?: Record<string, any>) =>
      [...queryKeys.products.lists(), params] as const,
    details: () => [...queryKeys.products.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.products.details(), id] as const,
  },

  // Invoices
  invoices: {
    all: ["invoices"] as const,
    lists: () => [...queryKeys.invoices.all, "list"] as const,
    list: (params?: Record<string, any>) =>
      [...queryKeys.invoices.lists(), params] as const,
    details: () => [...queryKeys.invoices.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.invoices.details(), id] as const,
    subInvoices: (parentId: string) =>
      [...queryKeys.invoices.detail(parentId), "sub-invoices"] as const,
  },

  // Invoice Groups
  invoiceGroups: {
    all: ["invoice-groups"] as const,
    lists: () => [...queryKeys.invoiceGroups.all, "list"] as const,
    list: (params?: Record<string, any>) =>
      [...queryKeys.invoiceGroups.lists(), params] as const,
    details: () => [...queryKeys.invoiceGroups.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.invoiceGroups.details(), id] as const,
  },

  // Billing
  billing: {
    all: ["billing"] as const,
    job: (jobId: string) => [...queryKeys.billing.all, "job", jobId] as const,
    queueStats: () => [...queryKeys.billing.all, "queue-stats"] as const,
    consolidatedQueueStats: () =>
      [...queryKeys.billing.all, "consolidated-queue-stats"] as const,
  },

  // Dashboard
  dashboard: {
    all: ["dashboard"] as const,
    stats: () => [...queryKeys.dashboard.all, "stats"] as const,
    recentActivity: () => [...queryKeys.dashboard.all, "recent-activity"] as const,
    expiringContracts: () => [...queryKeys.dashboard.all, "expiring-contracts"] as const,
  },

  // App Config
  config: {
    all: ["app-config"] as const,
  },
} as const;

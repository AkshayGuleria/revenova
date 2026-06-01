/**
 * TanStack Query (React Query) Configuration
 */

import { QueryClient, QueryCache, MutationCache } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError } from "./client";

/**
 * Create and configure the QueryClient instance
 */
export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      if (error instanceof ApiError) {
        console.error("[React Query - Query Error]", {
          statusCode: error.statusCode,
          code: error.code,
          message: error.message,
          details: error.details,
        });
        if (error.statusCode === 401) {
          toast.error("Your session has expired. Please log in again.");
        } else if (error.statusCode === 403) {
          toast.error("You don't have permission to access this resource.");
        }
      } else {
        console.error("[React Query - Unexpected Query Error]", error);
      }
    },
  }),
  mutationCache: new MutationCache({
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
  }),
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
      retryDelay: 1000,
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
    products: (id: string) =>
      [...queryKeys.contracts.detail(id), "products"] as const,
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

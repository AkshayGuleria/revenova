/**
 * Purchase Orders API Hooks
 * TanStack Query hooks for purchase order operations
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../client";
import type { QueryParams } from "~/types/api";

// ============================================================================
// TYPES
// ============================================================================

export type POStatus =
  | "pending_approval"
  | "approved"
  | "rejected"
  | "fulfilled"
  | "cancelled";

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  accountId: string;
  account?: { id: string; accountName: string };
  contractId?: string;
  contract?: { id: string; contractNumber: string };
  description?: string;
  amount: number;
  currency: string;
  status: POStatus;
  issueDate: string;
  expiryDate?: string;
  notes?: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePurchaseOrderDto {
  poNumber: string;
  accountId: string;
  contractId?: string;
  description?: string;
  amount: number;
  currency?: string;
  issueDate: string;
  expiryDate?: string;
  notes?: string;
}

export interface UpdatePurchaseOrderDto extends Partial<CreatePurchaseOrderDto> {
  status?: POStatus;
}

// ============================================================================
// QUERY KEYS
// ============================================================================

const purchaseOrderKeys = {
  all: ["purchase-orders"] as const,
  lists: () => [...purchaseOrderKeys.all, "list"] as const,
  list: (params?: Record<string, any>) =>
    [...purchaseOrderKeys.lists(), params] as const,
  details: () => [...purchaseOrderKeys.all, "detail"] as const,
  detail: (id: string) => [...purchaseOrderKeys.details(), id] as const,
};

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Fetch list of purchase orders with filtering and pagination
 */
export function usePurchaseOrders(params?: QueryParams) {
  return useQuery({
    queryKey: purchaseOrderKeys.list(params),
    queryFn: async () => {
      const response = await apiClient.get<PurchaseOrder[]>(
        "/api/purchase-orders",
        params
      );
      return response;
    },
  });
}

/**
 * Fetch single purchase order by ID
 */
export function usePurchaseOrder(id: string) {
  return useQuery({
    queryKey: purchaseOrderKeys.detail(id),
    queryFn: async () => {
      const response = await apiClient.get<PurchaseOrder>(
        `/api/purchase-orders/${id}`
      );
      return response;
    },
    enabled: !!id,
  });
}

/**
 * Create new purchase order
 */
export function useCreatePurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreatePurchaseOrderDto) => {
      const response = await apiClient.post<PurchaseOrder>(
        "/api/purchase-orders",
        data
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.lists() });
    },
  });
}

/**
 * Update existing purchase order
 */
export function useUpdatePurchaseOrder(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdatePurchaseOrderDto) => {
      const response = await apiClient.patch<PurchaseOrder>(
        `/api/purchase-orders/${id}`,
        data
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.lists() });
    },
  });
}

/**
 * Approve a purchase order
 */
export function useApprovePurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.post<PurchaseOrder>(
        `/api/purchase-orders/${id}/approve`
      );
      return response;
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.lists() });
    },
  });
}

/**
 * Reject a purchase order
 */
export function useRejectPurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const response = await apiClient.post<PurchaseOrder>(
        `/api/purchase-orders/${id}/reject`,
        { reason }
      );
      return response;
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.lists() });
    },
  });
}

/**
 * Cancel (delete) a purchase order
 */
export function useCancelPurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.delete<void>(
        `/api/purchase-orders/${id}`
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.lists() });
    },
  });
}

/**
 * Payments API Hooks
 * TanStack Query hooks for payment operations
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../client";
import type { QueryParams } from "~/types/api";

// ============================================================================
// TYPES
// ============================================================================

export type PaymentStatus = "pending" | "applied" | "voided" | "failed";
export type PaymentMethod =
  | "bank_transfer"
  | "ach"
  | "wire"
  | "check"
  | "credit_card"
  | "other";

export interface Payment {
  id: string;
  paymentNumber: string;
  accountId: string;
  account?: { id: string; accountName: string };
  invoiceId?: string;
  invoice?: { id: string; invoiceNumber: string };
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  referenceNumber?: string;
  paymentDate: string;
  notes?: string;
  appliedAt?: string;
  voidedAt?: string;
  voidReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePaymentDto {
  paymentNumber: string;
  accountId: string;
  invoiceId?: string;
  amount: number;
  currency?: string;
  method: PaymentMethod;
  referenceNumber?: string;
  paymentDate: string;
  notes?: string;
}

// ============================================================================
// QUERY KEYS
// ============================================================================

const paymentKeys = {
  all: ["payments"] as const,
  lists: () => [...paymentKeys.all, "list"] as const,
  list: (params?: Record<string, any>) =>
    [...paymentKeys.lists(), params] as const,
  details: () => [...paymentKeys.all, "detail"] as const,
  detail: (id: string) => [...paymentKeys.details(), id] as const,
};

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Fetch list of payments with filtering and pagination
 */
export function usePayments(params?: QueryParams) {
  return useQuery({
    queryKey: paymentKeys.list(params),
    queryFn: async () => {
      const response = await apiClient.get<Payment[]>("/api/payments", params);
      return response;
    },
  });
}

/**
 * Fetch single payment by ID
 */
export function usePayment(id: string) {
  return useQuery({
    queryKey: paymentKeys.detail(id),
    queryFn: async () => {
      const response = await apiClient.get<Payment>(`/api/payments/${id}`);
      return response;
    },
    enabled: !!id,
  });
}

/**
 * Create new payment
 */
export function useCreatePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreatePaymentDto) => {
      const response = await apiClient.post<Payment>("/api/payments", data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentKeys.lists() });
    },
  });
}

/**
 * Apply a payment to an invoice
 */
export function useApplyPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      invoiceId,
    }: {
      id: string;
      invoiceId: string;
    }) => {
      const response = await apiClient.post<Payment>(
        `/api/payments/${id}/apply`,
        { invoiceId }
      );
      return response;
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: paymentKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: paymentKeys.lists() });
    },
  });
}

/**
 * Void a payment
 */
export function useVoidPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const response = await apiClient.delete<void>(`/api/payments/${id}`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentKeys.lists() });
    },
  });
}

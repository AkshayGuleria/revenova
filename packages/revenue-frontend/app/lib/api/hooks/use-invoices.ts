/**
 * Invoices API Hooks
 * TanStack Query hooks for invoice operations
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../client";
import { queryKeys } from "../query-client";
import type {
  Invoice,
  CreateInvoiceDto,
  UpdateInvoiceDto,
  CreateInvoiceItemDto,
  CreateSubInvoiceDto,
} from "~/types/models";
import type { QueryParams } from "~/types/api";

/**
 * Fetch list of invoices with filtering and pagination
 */
export function useInvoices(params?: QueryParams) {
  return useQuery({
    queryKey: queryKeys.invoices.list(params),
    queryFn: async () => {
      const response = await apiClient.get<Invoice[]>("/api/invoices", params);
      return response;
    },
  });
}

/**
 * Fetch single invoice by ID with line items
 */
export function useInvoice(id: string) {
  return useQuery({
    queryKey: queryKeys.invoices.detail(id),
    queryFn: async () => {
      const response = await apiClient.get<Invoice>(`/api/invoices/${id}`);
      return response;
    },
    enabled: !!id,
  });
}

/**
 * Create new invoice
 */
export function useCreateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateInvoiceDto) => {
      const response = await apiClient.post<Invoice>("/api/invoices", data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.lists() });
    },
  });
}

/**
 * Update existing invoice
 */
export function useUpdateInvoice(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateInvoiceDto) => {
      const response = await apiClient.patch<Invoice>(
        `/api/invoices/${id}`,
        data
      );
      return response;
    },
    // Optimistic update
    onMutate: async (newData) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.invoices.detail(id) });

      // Snapshot previous value
      const previousInvoice = queryClient.getQueryData(queryKeys.invoices.detail(id));

      // Optimistically update to the new value
      queryClient.setQueryData(queryKeys.invoices.detail(id), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          data: {
            ...old.data,
            ...newData,
          },
        };
      });

      return { previousInvoice };
    },
    onError: (_err, _newData, context) => {
      // Rollback on error
      if (context?.previousInvoice) {
        queryClient.setQueryData(queryKeys.invoices.detail(id), context.previousInvoice);
      }
    },
    onSuccess: () => {
      // Invalidate specific invoice and list queries
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.lists() });
    },
  });
}

/**
 * Delete invoice
 */
export function useDeleteInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.delete<void>(`/api/invoices/${id}`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.lists() });
    },
  });
}

/**
 * Fetch sub-invoices for a parent invoice
 */
export function useSubInvoices(parentId: string, params?: QueryParams) {
  return useQuery({
    queryKey: queryKeys.invoices.subInvoices(parentId),
    queryFn: async () => {
      const response = await apiClient.get<Invoice[]>(
        `/api/invoices/${parentId}/sub-invoices`,
        params
      );
      return response;
    },
    enabled: !!parentId,
  });
}

/**
 * Create a sub-invoice under a parent invoice
 */
export function useCreateSubInvoice(parentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateSubInvoiceDto) => {
      const response = await apiClient.post<Invoice>(
        `/api/invoices/${parentId}/sub-invoices`,
        data
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.invoices.detail(parentId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.invoices.subInvoices(parentId),
      });
    },
  });
}

/**
 * Add line item to invoice
 */
export function useAddInvoiceItem(invoiceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateInvoiceItemDto) => {
      const response = await apiClient.post(
        `/api/invoices/${invoiceId}/items`,
        data
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.invoices.detail(invoiceId),
      });
    },
  });
}

/**
 * Remove line item from invoice
 */
export function useRemoveInvoiceItem(invoiceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (itemId: string) => {
      const response = await apiClient.delete(
        `/api/invoices/${invoiceId}/items/${itemId}`
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.invoices.detail(invoiceId),
      });
    },
  });
}

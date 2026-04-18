/**
 * Invoice Groups API Hooks
 * TanStack Query hooks for invoice group operations
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../client";
import { queryKeys } from "../query-client";
import type {
  InvoiceGroup,
  CreateInvoiceGroupDto,
  UpdateInvoiceGroupDto,
} from "~/types/models";
import type { QueryParams } from "~/types/api";

/**
 * Fetch list of invoice groups with filtering and pagination
 */
export function useInvoiceGroups(params?: QueryParams) {
  return useQuery({
    queryKey: queryKeys.invoiceGroups.list(params),
    queryFn: async () => {
      const response = await apiClient.get<InvoiceGroup[]>(
        "/api/invoice-groups",
        params
      );
      return response;
    },
  });
}

/**
 * Fetch single invoice group by ID
 */
export function useInvoiceGroup(id: string) {
  return useQuery({
    queryKey: queryKeys.invoiceGroups.detail(id),
    queryFn: async () => {
      const response = await apiClient.get<InvoiceGroup>(
        `/api/invoice-groups/${id}`
      );
      return response;
    },
    enabled: !!id,
  });
}

/**
 * Create new invoice group
 */
export function useCreateInvoiceGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateInvoiceGroupDto) => {
      const response = await apiClient.post<InvoiceGroup>(
        "/api/invoice-groups",
        data
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.invoiceGroups.lists(),
      });
    },
  });
}

/**
 * Update existing invoice group
 */
export function useUpdateInvoiceGroup(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateInvoiceGroupDto) => {
      const response = await apiClient.patch<InvoiceGroup>(
        `/api/invoice-groups/${id}`,
        data
      );
      return response;
    },
    onMutate: async (newData) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.invoiceGroups.detail(id),
      });

      const previousGroup = queryClient.getQueryData(
        queryKeys.invoiceGroups.detail(id)
      );

      queryClient.setQueryData(
        queryKeys.invoiceGroups.detail(id),
        (old: any) => {
          if (!old) return old;
          return { ...old, data: { ...old.data, ...newData } };
        }
      );

      return { previousGroup };
    },
    onError: (_err, _newData, context) => {
      if (context?.previousGroup) {
        queryClient.setQueryData(
          queryKeys.invoiceGroups.detail(id),
          context.previousGroup
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.invoiceGroups.detail(id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.invoiceGroups.lists(),
      });
    },
  });
}

/**
 * Delete invoice group
 */
export function useDeleteInvoiceGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.delete<void>(
        `/api/invoice-groups/${id}`
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.invoiceGroups.lists(),
      });
    },
  });
}

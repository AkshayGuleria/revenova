/**
 * Contracts API Hooks
 * TanStack Query hooks for contract operations
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../client";
import { queryKeys } from "../query-client";
import type {
  Contract,
  ContractProduct,
  CreateContractDto,
  CreateContractProductDto,
  UpdateContractDto,
  ContractShare,
  ShareContractDto,
} from "~/types/models";
import type { QueryParams } from "~/types/api";

/**
 * Fetch list of contracts with filtering and pagination
 */
export function useContracts(params?: QueryParams) {
  return useQuery({
    queryKey: queryKeys.contracts.list(params),
    queryFn: async () => {
      const response = await apiClient.get<Contract[]>("/api/contracts", params);
      return response;
    },
  });
}

/**
 * Fetch single contract by ID
 */
export function useContract(id: string) {
  return useQuery({
    queryKey: queryKeys.contracts.detail(id),
    queryFn: async () => {
      const response = await apiClient.get<Contract>(`/api/contracts/${id}`);
      return response;
    },
    enabled: !!id,
  });
}

/**
 * Fetch contract shares (accounts this contract is shared with)
 */
export function useContractShares(id: string) {
  return useQuery({
    queryKey: queryKeys.contracts.shares(id),
    queryFn: async () => {
      const response = await apiClient.get<ContractShare[]>(
        `/api/contracts/${id}/shares`
      );
      return response;
    },
    enabled: !!id,
  });
}

/**
 * Fetch contracts shared with a specific account
 */
export function useSharedContracts(accountId: string) {
  return useQuery({
    queryKey: queryKeys.contracts.sharedWith(accountId),
    queryFn: async () => {
      const response = await apiClient.get<Contract[]>(
        `/api/contracts/shared/${accountId}`
      );
      return response;
    },
    enabled: !!accountId,
  });
}

/**
 * Create new contract
 */
export function useCreateContract() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateContractDto) => {
      const response = await apiClient.post<Contract>("/api/contracts", data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.lists() });
    },
  });
}

/**
 * Update existing contract
 */
export function useUpdateContract(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateContractDto) => {
      const response = await apiClient.patch<Contract>(
        `/api/contracts/${id}`,
        data
      );
      return response;
    },
    // Optimistic update
    onMutate: async (newData) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.contracts.detail(id) });

      // Snapshot previous value
      const previousContract = queryClient.getQueryData(queryKeys.contracts.detail(id));

      // Optimistically update to the new value
      queryClient.setQueryData(queryKeys.contracts.detail(id), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          data: {
            ...old.data,
            ...newData,
          },
        };
      });

      return { previousContract };
    },
    onError: (_err, _newData, context) => {
      // Rollback on error
      if (context?.previousContract) {
        queryClient.setQueryData(queryKeys.contracts.detail(id), context.previousContract);
      }
    },
    onSuccess: () => {
      // Invalidate specific contract and list queries
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.lists() });
    },
  });
}

/**
 * Delete contract
 */
export function useDeleteContract() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.delete<void>(`/api/contracts/${id}`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.lists() });
    },
  });
}

/**
 * Fetch products attached to a contract
 */
export function useContractProducts(contractId: string) {
  return useQuery({
    queryKey: queryKeys.contracts.products(contractId),
    queryFn: async () => {
      const response = await apiClient.get<ContractProduct[]>(
        `/api/contracts/${contractId}/products`
      );
      return response;
    },
    enabled: !!contractId,
  });
}

/**
 * Add a product to a contract
 */
export function useAddContractProduct(contractId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateContractProductDto) => {
      const response = await apiClient.post<ContractProduct>(
        `/api/contracts/${contractId}/products`,
        data
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.contracts.products(contractId),
      });
    },
  });
}

/**
 * Remove a product from a contract
 */
export function useRemoveContractProduct(contractId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productId: string) => {
      const response = await apiClient.delete<void>(
        `/api/contracts/${contractId}/products/${productId}`
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.contracts.products(contractId),
      });
    },
  });
}

/**
 * Share contract with an account (Phase 3)
 */
export function useShareContract(contractId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ShareContractDto) => {
      const response = await apiClient.post<ContractShare>(
        `/api/contracts/${contractId}/shares`,
        data
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.contracts.shares(contractId),
      });
    },
  });
}

/**
 * Unshare contract from an account (Phase 3)
 */
export function useUnshareContract(contractId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (accountId: string) => {
      const response = await apiClient.delete<void>(
        `/api/contracts/${contractId}/shares/${accountId}`
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.contracts.shares(contractId),
      });
    },
  });
}

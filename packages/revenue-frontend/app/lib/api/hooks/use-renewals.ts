/**
 * Renewals API Hooks
 * TanStack Query hooks for contract renewal management
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../client";

// ============================================================================
// TYPES
// ============================================================================

export interface UpcomingRenewal {
  contractId: string;
  contractNumber: string;
  accountId: string;
  accountName: string;
  endDate: string;
  daysUntilExpiry: number;
  autoRenew: boolean;
  contractValue: number;
  currency: string;
}

export interface OverdueRenewal {
  contractId: string;
  contractNumber: string;
  accountId: string;
  accountName: string;
  endDate: string;
  daysOverdue: number;
  contractValue: number;
  currency: string;
}

export interface RenewalStatus {
  contractId: string;
  contractNumber: string;
  status: string;
  endDate: string;
  autoRenew: boolean;
  daysUntilExpiry?: number;
  daysOverdue?: number;
  lastRenewalDate?: string;
}

export interface RenewContractDto {
  newEndDate?: string;
  contractValue?: number;
  notes?: string;
}

// ============================================================================
// QUERY KEYS
// ============================================================================

const renewalKeys = {
  all: ["renewals"] as const,
  upcoming: () => [...renewalKeys.all, "upcoming"] as const,
  overdue: () => [...renewalKeys.all, "overdue"] as const,
  status: (contractId: string) =>
    [...renewalKeys.all, "status", contractId] as const,
};

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Fetch upcoming renewals (contracts expiring soon)
 */
export function useUpcomingRenewals() {
  return useQuery({
    queryKey: renewalKeys.upcoming(),
    queryFn: async () => {
      const response = await apiClient.get<UpcomingRenewal[]>(
        "/api/renewals/upcoming"
      );
      return response;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Fetch overdue renewals (contracts that have expired)
 */
export function useOverdueRenewals() {
  return useQuery({
    queryKey: renewalKeys.overdue(),
    queryFn: async () => {
      const response = await apiClient.get<OverdueRenewal[]>(
        "/api/renewals/overdue"
      );
      return response;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch renewal status for a single contract
 */
export function useRenewalStatus(contractId: string) {
  return useQuery({
    queryKey: renewalKeys.status(contractId),
    queryFn: async () => {
      const response = await apiClient.get<RenewalStatus>(
        `/api/renewals/${contractId}/status`
      );
      return response;
    },
    enabled: !!contractId,
  });
}

/**
 * Renew a contract
 */
export function useRenewContract() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      contractId,
      data,
    }: {
      contractId: string;
      data?: RenewContractDto;
    }) => {
      const response = await apiClient.post(
        `/api/renewals/${contractId}/renew`,
        data
      );
      return response;
    },
    onSuccess: (_data, { contractId }) => {
      queryClient.invalidateQueries({ queryKey: renewalKeys.upcoming() });
      queryClient.invalidateQueries({ queryKey: renewalKeys.overdue() });
      queryClient.invalidateQueries({
        queryKey: renewalKeys.status(contractId),
      });
    },
  });
}

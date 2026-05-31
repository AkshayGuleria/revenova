/**
 * Analytics API Hooks
 * TanStack Query hooks for analytics and reporting
 */

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../client";
import type { QueryParams } from "~/types/api";

// ============================================================================
// TYPES
// ============================================================================

export interface AnalyticsSummary {
  mrr: number;
  arr: number;
  activeContracts: number;
  totalAccounts: number;
  currency?: string;
}

export interface MRRData {
  mrr: number;
  currency: string;
  period?: string;
  breakdown?: Record<string, number>;
}

export interface ARRData {
  arr: number;
  currency: string;
  period?: string;
  breakdown?: Record<string, number>;
}

export interface ChurnData {
  churnedContracts: number;
  churnedARR: number;
  churnRate: number;
  period: string;
  currency: string;
}

export interface BookingsData {
  newContracts: number;
  totalBookings: number;
  period: string;
  currency: string;
}

// ============================================================================
// QUERY KEYS
// ============================================================================

const analyticsKeys = {
  all: ["analytics"] as const,
  summary: () => [...analyticsKeys.all, "summary"] as const,
  mrr: (params?: Record<string, any>) =>
    [...analyticsKeys.all, "mrr", params] as const,
  arr: (params?: Record<string, any>) =>
    [...analyticsKeys.all, "arr", params] as const,
  churn: (params?: Record<string, any>) =>
    [...analyticsKeys.all, "churn", params] as const,
  bookings: (params?: Record<string, any>) =>
    [...analyticsKeys.all, "bookings", params] as const,
};

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Fetch analytics summary (MRR, ARR, active contracts, total accounts)
 */
export function useAnalyticsSummary() {
  return useQuery({
    queryKey: analyticsKeys.summary(),
    queryFn: async () => {
      const response = await apiClient.get<AnalyticsSummary>(
        "/api/analytics/summary"
      );
      return response;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Fetch Monthly Recurring Revenue
 */
export function useAnalyticsMRR(params?: QueryParams) {
  return useQuery({
    queryKey: analyticsKeys.mrr(params),
    queryFn: async () => {
      const response = await apiClient.get<MRRData>(
        "/api/analytics/mrr",
        params
      );
      return response;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch Annual Recurring Revenue
 */
export function useAnalyticsARR(params?: QueryParams) {
  return useQuery({
    queryKey: analyticsKeys.arr(params),
    queryFn: async () => {
      const response = await apiClient.get<ARRData>(
        "/api/analytics/arr",
        params
      );
      return response;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch churn data for a date range
 */
export function useAnalyticsChurn(params?: QueryParams) {
  return useQuery({
    queryKey: analyticsKeys.churn(params),
    queryFn: async () => {
      const response = await apiClient.get<ChurnData>(
        "/api/analytics/churn",
        params
      );
      return response;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch bookings data for a date range
 */
export function useAnalyticsBookings(params?: QueryParams) {
  return useQuery({
    queryKey: analyticsKeys.bookings(params),
    queryFn: async () => {
      const response = await apiClient.get<BookingsData>(
        "/api/analytics/bookings",
        params
      );
      return response;
    },
    staleTime: 5 * 60 * 1000,
  });
}

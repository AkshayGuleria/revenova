import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../client";
import { queryKeys } from "../query-client";
import type { WebhookEndpoint, WebhookDelivery, CreateWebhookDto } from "~/types/models";
import type { QueryParams } from "~/types/api";

/** Fetch webhook endpoints with optional filtering */
export function useWebhooks(params?: QueryParams) {
  return useQuery({
    queryKey: queryKeys.webhooks.list(params),
    queryFn: async () => {
      const response = await apiClient.get<WebhookEndpoint[]>("/api/webhooks", params);
      return response;
    },
  });
}

/** Fetch a single webhook endpoint by ID */
export function useWebhook(id: string) {
  return useQuery({
    queryKey: queryKeys.webhooks.detail(id),
    queryFn: async () => {
      const response = await apiClient.get<WebhookEndpoint>(`/api/webhooks/${id}`);
      return response;
    },
    enabled: !!id,
  });
}

/** Fetch last 50 delivery attempts for a webhook endpoint */
export function useWebhookDeliveries(id: string) {
  return useQuery({
    queryKey: queryKeys.webhooks.deliveries(id),
    queryFn: async () => {
      const response = await apiClient.get<WebhookDelivery[]>(
        `/api/webhooks/${id}/deliveries`
      );
      return response;
    },
    enabled: !!id,
  });
}

/** Register a new webhook endpoint; returns signing secret in response (shown once) */
export function useCreateWebhook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateWebhookDto) => {
      const response = await apiClient.post<WebhookEndpoint & { secret: string }>(
        "/api/webhooks",
        data
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.webhooks.lists() });
    },
  });
}

/** Soft-deactivate a webhook endpoint (sets active=false, preserves delivery history) */
export function useDeactivateWebhook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.delete<void>(`/api/webhooks/${id}`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.webhooks.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.webhooks.details() });
    },
  });
}

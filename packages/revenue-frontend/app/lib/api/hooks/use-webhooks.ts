import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../client";
import { queryKeys } from "../query-client";
import type { WebhookEndpoint, WebhookDelivery, CreateWebhookDto } from "~/types/models";
import type { QueryParams } from "~/types/api";

export function useWebhooks(params?: QueryParams) {
  return useQuery({
    queryKey: queryKeys.webhooks.list(params),
    queryFn: async () => {
      const response = await apiClient.get<WebhookEndpoint[]>("/api/webhooks", params);
      return response;
    },
  });
}

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

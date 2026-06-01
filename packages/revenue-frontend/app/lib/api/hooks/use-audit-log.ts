import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../client";
import { queryKeys } from "../query-client";
import type { AuditLog } from "~/types/models";
import type { QueryParams } from "~/types/api";

export function useAuditLogs(params?: QueryParams) {
  return useQuery({
    queryKey: queryKeys.auditLog.list(params),
    queryFn: async () => {
      const response = await apiClient.get<AuditLog[]>("/api/audit-log", params);
      return response;
    },
  });
}

export function useEntityAuditTrail(entityType: string, entityId: string) {
  return useQuery({
    queryKey: queryKeys.auditLog.entityTrail(entityType, entityId),
    queryFn: async () => {
      const response = await apiClient.get<AuditLog[]>(
        `/api/audit-log/${entityType}/${entityId}`
      );
      return response;
    },
    enabled: !!entityType && !!entityId,
  });
}

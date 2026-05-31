import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  buildSingleResponse,
  buildPaginatedListResponse,
} from '../../common/utils/response-builder';
import { ApiResponse } from '../../common/interfaces';
import { parseQuery } from '../../common/utils/query-parser';

export interface AuditLogEntry {
  entityType: string;
  entityId: string;
  action: string;
  actorId?: string;
  actorType?: string;
  changes?: Record<string, { from: any; to: any }>;
  metadata?: Record<string, any>;
}

@Injectable()
export class AuditLogService {
  constructor(private prisma: PrismaService) {}

  async log(entry: AuditLogEntry): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        entityType: entry.entityType,
        entityId: entry.entityId,
        action: entry.action,
        actorId: entry.actorId ?? null,
        actorType: entry.actorType ?? 'system',
        changes: entry.changes ?? null,
        metadata: entry.metadata ?? null,
      },
    });
  }

  async findAll(query: Record<string, any>): Promise<ApiResponse<any>> {
    const { pagination, where } = parseQuery(query);
    const { offset, limit } = pagination;

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return buildPaginatedListResponse(data, offset, limit, total);
  }

  async findByEntity(
    entityType: string,
    entityId: string,
  ): Promise<ApiResponse<any>> {
    const logs = await this.prisma.auditLog.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
    });
    return buildPaginatedListResponse(logs, 0, logs.length, logs.length);
  }

  async findOne(id: string): Promise<ApiResponse<any>> {
    const log = await this.prisma.auditLog.findUnique({ where: { id } });
    if (!log) {
      throw new NotFoundException(`Audit log ${id} not found`);
    }
    return buildSingleResponse(log);
  }
}

import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  CreatePurchaseOrderDto,
  UpdatePurchaseOrderDto,
  RejectPurchaseOrderDto,
} from './dto';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import {
  buildSingleResponse,
  buildPaginatedListResponse,
} from '../../common/utils/response-builder';
import { ApiResponse } from '../../common/interfaces';
import {
  parsePaginationParams,
  parseQueryFilters,
  filtersToPrismaWhere,
} from '../../common/utils/query-parser';

@Injectable()
export class PurchaseOrdersService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreatePurchaseOrderDto): Promise<ApiResponse<any>> {
    const account = await this.prisma.account.findUnique({
      where: { id: dto.accountId },
    });
    if (!account) {
      throw new NotFoundException(`Account ${dto.accountId} not found`);
    }

    if (dto.contractId) {
      const contract = await this.prisma.contract.findUnique({
        where: { id: dto.contractId },
      });
      if (!contract) {
        throw new NotFoundException(`Contract ${dto.contractId} not found`);
      }
    }

    try {
      const po = await this.prisma.purchaseOrder.create({
        data: {
          poNumber: dto.poNumber,
          accountId: dto.accountId,
          contractId: dto.contractId,
          description: dto.description,
          amount: dto.amount,
          currency: dto.currency ?? 'EUR',
          issueDate: new Date(dto.issueDate),
          expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
          notes: dto.notes,
          metadata: dto.metadata,
          status: 'pending_approval',
        },
        include: {
          account: { select: { id: true, accountName: true } },
          contract: { select: { id: true, contractNumber: true } },
        },
      });
      return buildSingleResponse(po);
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(
          `Purchase order number ${dto.poNumber} already exists`,
        );
      }
      throw e;
    }
  }

  async findAll(query: Record<string, any>): Promise<ApiResponse<any>> {
    const { offset, limit } = parsePaginationParams(query);
    const filters = parseQueryFilters(query);
    const where = filtersToPrismaWhere(filters);

    const [data, total] = await Promise.all([
      this.prisma.purchaseOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        include: {
          account: { select: { id: true, accountName: true } },
        },
      }),
      this.prisma.purchaseOrder.count({ where }),
    ]);

    return buildPaginatedListResponse(data, offset, limit, total);
  }

  async findOne(id: string): Promise<ApiResponse<any>> {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        account: { select: { id: true, accountName: true } },
        contract: { select: { id: true, contractNumber: true } },
      },
    });
    if (!po) {
      throw new NotFoundException(`Purchase order ${id} not found`);
    }
    return buildSingleResponse(po);
  }

  async update(
    id: string,
    dto: UpdatePurchaseOrderDto,
  ): Promise<ApiResponse<any>> {
    const po = await this.prisma.purchaseOrder.findUnique({ where: { id } });
    if (!po) {
      throw new NotFoundException(`Purchase order ${id} not found`);
    }
    if (po.status !== 'pending_approval') {
      throw new BadRequestException(
        `Cannot update purchase order in status: ${po.status}`,
      );
    }

    const updated = await this.prisma.purchaseOrder.update({
      where: { id },
      data: {
        description: dto.description,
        amount: dto.amount,
        currency: dto.currency,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
        notes: dto.notes,
        metadata: dto.metadata,
      },
    });
    return buildSingleResponse(updated);
  }

  async approve(id: string, approvedById?: string): Promise<ApiResponse<any>> {
    const po = await this.prisma.purchaseOrder.findUnique({ where: { id } });
    if (!po) {
      throw new NotFoundException(`Purchase order ${id} not found`);
    }
    if (po.status !== 'pending_approval') {
      throw new BadRequestException(
        `Cannot approve purchase order in status: ${po.status}`,
      );
    }

    const updated = await this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'approved', approvedById, approvedAt: new Date() },
    });
    return buildSingleResponse(updated);
  }

  async reject(
    id: string,
    dto: RejectPurchaseOrderDto,
    rejectedById?: string,
  ): Promise<ApiResponse<any>> {
    const po = await this.prisma.purchaseOrder.findUnique({ where: { id } });
    if (!po) {
      throw new NotFoundException(`Purchase order ${id} not found`);
    }
    if (po.status !== 'pending_approval') {
      throw new BadRequestException(
        `Cannot reject purchase order in status: ${po.status}`,
      );
    }

    const updated = await this.prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: 'rejected',
        rejectedById,
        rejectedAt: new Date(),
        rejectionReason: dto.rejectionReason,
      },
    });
    return buildSingleResponse(updated);
  }

  async cancel(id: string): Promise<ApiResponse<any>> {
    const po = await this.prisma.purchaseOrder.findUnique({ where: { id } });
    if (!po) {
      throw new NotFoundException(`Purchase order ${id} not found`);
    }
    if (['fulfilled', 'cancelled'].includes(po.status)) {
      throw new BadRequestException(
        `Cannot cancel purchase order in status: ${po.status}`,
      );
    }

    const updated = await this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'cancelled' },
    });
    return buildSingleResponse(updated);
  }
}

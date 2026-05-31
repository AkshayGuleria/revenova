import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { buildSingleResponse, buildPaginatedListResponse } from '../../common/utils/response-builder';
import { ApiResponse } from '../../common/interfaces';

@Injectable()
export class RenewalsService {
  constructor(private prisma: PrismaService) {}

  async getUpcoming(days: number = 90, offset = 0, limit = 20): Promise<ApiResponse<any>> {
    const today = new Date();
    const future = new Date();
    future.setDate(future.getDate() + days);

    const [contracts, total] = await Promise.all([
      this.prisma.contract.findMany({
        where: {
          status: 'active',
          endDate: { gte: today, lte: future },
        },
        include: { account: { select: { id: true, accountName: true } } },
        orderBy: { endDate: 'asc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.contract.count({
        where: { status: 'active', endDate: { gte: today, lte: future } },
      }),
    ]);

    const data = contracts.map((c) => ({
      ...c,
      daysUntilExpiry: Math.ceil((c.endDate.getTime() - today.getTime()) / 86400000),
    }));

    return buildPaginatedListResponse(data, offset, limit, total);
  }

  async getOverdue(offset = 0, limit = 20): Promise<ApiResponse<any>> {
    const today = new Date();

    const [contracts, total] = await Promise.all([
      this.prisma.contract.findMany({
        where: { status: 'active', endDate: { lt: today } },
        include: { account: { select: { id: true, accountName: true } } },
        orderBy: { endDate: 'asc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.contract.count({ where: { status: 'active', endDate: { lt: today } } }),
    ]);

    const data = contracts.map((c) => ({
      ...c,
      daysOverdue: Math.ceil((today.getTime() - c.endDate.getTime()) / 86400000),
    }));

    return buildPaginatedListResponse(data, offset, limit, total);
  }

  async getStatus(contractId: string): Promise<ApiResponse<any>> {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: { account: { select: { id: true, accountName: true } } },
    });
    if (!contract) throw new NotFoundException(`Contract ${contractId} not found`);

    const today = new Date();
    const daysUntilExpiry = Math.ceil(
      (contract.endDate.getTime() - today.getTime()) / 86400000,
    );

    let renewalStatus: string;
    if (['expired', 'cancelled'].includes(contract.status)) {
      renewalStatus = 'expired';
    } else if (daysUntilExpiry < 0) {
      renewalStatus = 'overdue';
    } else if (daysUntilExpiry <= 90) {
      renewalStatus = 'expiring_soon';
    } else {
      renewalStatus = 'active';
    }

    return buildSingleResponse({
      contractId: contract.id,
      contractNumber: contract.contractNumber,
      accountId: contract.accountId,
      accountName: (contract as any).account?.accountName,
      endDate: contract.endDate.toISOString().split('T')[0],
      daysUntilExpiry,
      autoRenew: contract.autoRenew,
      renewalStatus,
    });
  }

  async renew(contractId: string): Promise<ApiResponse<any>> {
    const contract = await this.prisma.contract.findUnique({ where: { id: contractId } });
    if (!contract) throw new NotFoundException(`Contract ${contractId} not found`);
    if (contract.status !== 'active') {
      throw new BadRequestException(`Cannot renew contract with status: ${contract.status}`);
    }

    const newEndDate = new Date(contract.endDate);
    newEndDate.setFullYear(newEndDate.getFullYear() + 1);

    const updated = await this.prisma.contract.update({
      where: { id: contractId },
      data: { endDate: newEndDate },
      include: { account: { select: { id: true, accountName: true } } },
    });

    return buildSingleResponse(updated);
  }
}

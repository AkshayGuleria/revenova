import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  CreateInvoiceGroupDto,
  UpdateInvoiceGroupDto,
  QueryInvoiceGroupsDto,
} from './dto';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { parseQuery } from '../../common/utils/query-parser';
import {
  buildSingleResponse,
  buildPaginatedListResponse,
} from '../../common/utils/response-builder';
import { ApiResponse } from '../../common/interfaces';

@Injectable()
export class InvoiceGroupsService {
  constructor(private prisma: PrismaService) {}

  async create(
    createInvoiceGroupDto: CreateInvoiceGroupDto,
  ): Promise<ApiResponse<any>> {
    const { accountId, ...data } = createInvoiceGroupDto;

    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new NotFoundException(`Account with ID ${accountId} not found`);
    }

    try {
      const group = await this.prisma.invoiceGroup.create({
        data: { ...data, accountId },
        include: {
          account: { select: { id: true, accountName: true } },
          _count: { select: { invoices: true } },
        },
      });

      return buildSingleResponse(group);
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(
            'An invoice group with this groupType and code already exists for this account',
          );
        }
      }
      throw error;
    }
  }

  async findAll(query: QueryInvoiceGroupsDto): Promise<ApiResponse<any>> {
    const { pagination, where } = parseQuery(query);

    const [groups, total] = await Promise.all([
      this.prisma.invoiceGroup.findMany({
        where,
        skip: pagination.offset,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          account: { select: { id: true, accountName: true } },
          _count: { select: { invoices: true } },
        },
      }),
      this.prisma.invoiceGroup.count({ where }),
    ]);

    return buildPaginatedListResponse(groups, pagination.offset, pagination.limit, total);
  }

  async findOne(id: string): Promise<ApiResponse<any>> {
    const group = await this.prisma.invoiceGroup.findUnique({
      where: { id },
      include: {
        account: { select: { id: true, accountName: true } },
        _count: { select: { invoices: true } },
      },
    });

    if (!group) {
      throw new NotFoundException(`Invoice group with ID ${id} not found`);
    }

    return buildSingleResponse(group);
  }

  async update(
    id: string,
    updateInvoiceGroupDto: UpdateInvoiceGroupDto,
  ): Promise<ApiResponse<any>> {
    await this.findOne(id);

    try {
      const group = await this.prisma.invoiceGroup.update({
        where: { id },
        data: updateInvoiceGroupDto,
        include: {
          account: { select: { id: true, accountName: true } },
          _count: { select: { invoices: true } },
        },
      });

      return buildSingleResponse(group);
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(
            'An invoice group with this groupType and code already exists for this account',
          );
        }
      }
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    const group = await this.prisma.invoiceGroup.findUnique({
      where: { id },
      include: { _count: { select: { invoices: true } } },
    });

    if (!group) {
      throw new NotFoundException(`Invoice group with ID ${id} not found`);
    }

    if (group._count.invoices > 0) {
      throw new BadRequestException(
        `Cannot delete invoice group "${group.name}" — it has ${group._count.invoices} attached invoice(s). ` +
          'Remove or reassign invoices before deleting the group.',
      );
    }

    await this.prisma.invoiceGroup.delete({ where: { id } });
  }
}

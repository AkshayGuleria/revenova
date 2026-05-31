import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateTaxRateDto, UpdateTaxRateDto, CalculateTaxDto } from './dto';
import {
  buildSingleResponse,
  buildPaginatedListResponse,
} from '../../common/utils/response-builder';
import { ApiResponse } from '../../common/interfaces';
import { parseQuery } from '../../common/utils/query-parser';

@Injectable()
export class TaxRatesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateTaxRateDto): Promise<ApiResponse<any>> {
    const taxRate = await this.prisma.taxRate.create({
      data: {
        jurisdiction: dto.jurisdiction,
        taxType: dto.taxType,
        rate: dto.rate,
        name: dto.name,
        description: dto.description,
        effectiveFrom: new Date(dto.effectiveFrom),
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
        active: true,
      },
    });
    return buildSingleResponse(taxRate);
  }

  async findAll(query: Record<string, any>): Promise<ApiResponse<any>> {
    const { pagination, where } = parseQuery(query);
    const offset = pagination.offset;
    const limit = pagination.limit;

    const [data, total] = await Promise.all([
      this.prisma.taxRate.findMany({
        where,
        orderBy: [{ jurisdiction: 'asc' }, { effectiveFrom: 'desc' }],
        skip: offset,
        take: limit,
      }),
      this.prisma.taxRate.count({ where }),
    ]);

    return buildPaginatedListResponse(data, offset, limit, total);
  }

  async findOne(id: string): Promise<ApiResponse<any>> {
    const taxRate = await this.prisma.taxRate.findUnique({ where: { id } });
    if (!taxRate) throw new NotFoundException(`Tax rate ${id} not found`);
    return buildSingleResponse(taxRate);
  }

  async update(id: string, dto: UpdateTaxRateDto): Promise<ApiResponse<any>> {
    const existing = await this.prisma.taxRate.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Tax rate ${id} not found`);

    const updated = await this.prisma.taxRate.update({
      where: { id },
      data: {
        ...(dto.rate !== undefined && { rate: dto.rate }),
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.effectiveFrom !== undefined && {
          effectiveFrom: new Date(dto.effectiveFrom),
        }),
        ...(dto.effectiveTo !== undefined && {
          effectiveTo: new Date(dto.effectiveTo),
        }),
      },
    });
    return buildSingleResponse(updated);
  }

  async deactivate(id: string): Promise<ApiResponse<any>> {
    const existing = await this.prisma.taxRate.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Tax rate ${id} not found`);

    const updated = await this.prisma.taxRate.update({
      where: { id },
      data: { active: false, effectiveTo: new Date() },
    });
    return buildSingleResponse(updated);
  }

  async calculateTax(dto: CalculateTaxDto): Promise<ApiResponse<any>> {
    const { amount, jurisdiction, taxType, date } = dto;
    const asOfDate = date ? new Date(date) : new Date();

    const taxRate = await this.prisma.taxRate.findFirst({
      where: {
        jurisdiction,
        active: true,
        ...(taxType && { taxType }),
        effectiveFrom: { lte: asOfDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOfDate } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    if (!taxRate) {
      throw new NotFoundException(
        `No active tax rate found for jurisdiction: ${jurisdiction}${taxType ? `, type: ${taxType}` : ''}`,
      );
    }

    const rate = Number(taxRate.rate);
    const taxAmount = parseFloat((amount * rate).toFixed(2));
    const totalWithTax = parseFloat((amount + taxAmount).toFixed(2));

    return buildSingleResponse({
      jurisdiction,
      taxType: taxRate.taxType,
      rateName: taxRate.name,
      rate,
      amount,
      taxAmount,
      totalWithTax,
    });
  }
}

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  CreateExchangeRateDto,
  UpdateExchangeRateDto,
  ConvertCurrencyDto,
  QueryExchangeRatesDto,
} from './dto';
import {
  buildSingleResponse,
  buildPaginatedListResponse,
} from '../../common/utils/response-builder';
import { ApiResponse } from '../../common/interfaces';
import { parseQuery } from '../../common/utils/query-parser';

@Injectable()
export class ExchangeRatesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Upsert an exchange rate.
   * If a rate already exists for the same currency pair + effective date, it is updated.
   */
  async upsert(dto: CreateExchangeRateDto): Promise<ApiResponse<any>> {
    const from = dto.fromCurrency.toUpperCase();
    const to = dto.toCurrency.toUpperCase();

    if (from === to) {
      throw new BadRequestException(
        'fromCurrency and toCurrency must be different',
      );
    }

    const effectiveDate = new Date(dto.effectiveDate);

    const rate = await this.prisma.exchangeRate.upsert({
      where: {
        fromCurrency_toCurrency_effectiveDate: {
          fromCurrency: from,
          toCurrency: to,
          effectiveDate,
        },
      },
      update: {
        rate: dto.rate,
        source: dto.source ?? 'manual',
      },
      create: {
        fromCurrency: from,
        toCurrency: to,
        rate: dto.rate,
        effectiveDate,
        source: dto.source ?? 'manual',
      },
    });

    return buildSingleResponse(rate);
  }

  /**
   * List exchange rates with operator-based filtering and offset pagination.
   */
  async findAll(query: QueryExchangeRatesDto): Promise<ApiResponse<any>> {
    const { pagination, where } = parseQuery(query as Record<string, any>);

    const [data, total] = await Promise.all([
      this.prisma.exchangeRate.findMany({
        where,
        orderBy: [{ effectiveDate: 'desc' }, { fromCurrency: 'asc' }],
        skip: pagination.offset,
        take: pagination.limit,
      }),
      this.prisma.exchangeRate.count({ where }),
    ]);

    return buildPaginatedListResponse(
      data,
      pagination.offset,
      pagination.limit,
      total,
    );
  }

  /**
   * Get a single exchange rate by ID.
   */
  async findOne(id: string): Promise<ApiResponse<any>> {
    const rate = await this.prisma.exchangeRate.findUnique({ where: { id } });
    if (!rate) {
      throw new NotFoundException(`Exchange rate ${id} not found`);
    }
    return buildSingleResponse(rate);
  }

  /**
   * Update rate or source of an existing exchange rate record.
   * Currency pair and effectiveDate are immutable after creation.
   */
  async update(
    id: string,
    dto: UpdateExchangeRateDto,
  ): Promise<ApiResponse<any>> {
    const existing = await this.prisma.exchangeRate.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Exchange rate ${id} not found`);
    }

    const updated = await this.prisma.exchangeRate.update({
      where: { id },
      data: {
        ...(dto.rate !== undefined && { rate: dto.rate }),
        ...(dto.source !== undefined && { source: dto.source }),
      },
    });

    return buildSingleResponse(updated);
  }

  /**
   * Delete an exchange rate record by ID.
   */
  async remove(id: string): Promise<ApiResponse<any>> {
    const existing = await this.prisma.exchangeRate.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Exchange rate ${id} not found`);
    }

    await this.prisma.exchangeRate.delete({ where: { id } });
    return buildSingleResponse({ deleted: true, id });
  }

  /**
   * Convert an amount from one currency to another.
   *
   * Looks up the most recent rate on or before the given date.
   * If from === to, returns the original amount immediately (no DB hit).
   */
  async convert(dto: ConvertCurrencyDto): Promise<ApiResponse<any>> {
    const from = dto.from.toUpperCase();
    const to = dto.to.toUpperCase();
    const { amount, date } = dto;

    // Same-currency shortcut — no DB query needed
    if (from === to) {
      return buildSingleResponse({
        fromCurrency: from,
        toCurrency: to,
        amount,
        convertedAmount: amount,
        rate: 1,
        effectiveDate: date ?? new Date().toISOString().split('T')[0],
      });
    }

    const asOfDate = date ? new Date(date) : new Date();

    const rateRecord = await this.prisma.exchangeRate.findFirst({
      where: {
        fromCurrency: from,
        toCurrency: to,
        effectiveDate: { lte: asOfDate },
      },
      orderBy: { effectiveDate: 'desc' },
    });

    if (!rateRecord) {
      throw new NotFoundException(
        `No exchange rate found for ${from} → ${to} on or before ${asOfDate.toISOString().split('T')[0]}`,
      );
    }

    const rate = Number(rateRecord.rate);
    const convertedAmount = parseFloat((amount * rate).toFixed(2));

    return buildSingleResponse({
      fromCurrency: from,
      toCurrency: to,
      amount,
      convertedAmount,
      rate,
      effectiveDate: rateRecord.effectiveDate.toISOString().split('T')[0],
    });
  }
}

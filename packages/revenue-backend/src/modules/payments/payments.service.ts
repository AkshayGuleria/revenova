import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreatePaymentDto, ApplyPaymentDto } from './dto';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import {
  buildSingleResponse,
  buildPaginatedListResponse,
} from '../../common/utils/response-builder';
import { ApiResponse } from '../../common/interfaces';
import { parseQuery } from '../../common/utils/query-parser';

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreatePaymentDto): Promise<ApiResponse<any>> {
    const account = await this.prisma.account.findUnique({
      where: { id: dto.accountId },
    });
    if (!account)
      throw new NotFoundException(`Account ${dto.accountId} not found`);

    if (dto.invoiceId) {
      const invoice = await this.prisma.invoice.findUnique({
        where: { id: dto.invoiceId },
      });
      if (!invoice)
        throw new NotFoundException(`Invoice ${dto.invoiceId} not found`);
      if (invoice.accountId !== dto.accountId) {
        throw new BadRequestException(
          'Invoice does not belong to the specified account',
        );
      }
    }

    try {
      const payment = await this.prisma.$transaction(async (tx) => {
        const p = await tx.payment.create({
          data: {
            paymentNumber: dto.paymentNumber,
            accountId: dto.accountId,
            invoiceId: dto.invoiceId ?? null,
            amount: dto.amount,
            currency: dto.currency ?? 'EUR',
            method: dto.method,
            referenceNumber: dto.referenceNumber,
            paymentDate: new Date(dto.paymentDate),
            notes: dto.notes,
            status: 'applied',
          },
          include: {
            account: { select: { id: true, accountName: true } },
            invoice: {
              select: {
                id: true,
                invoiceNumber: true,
                total: true,
                paidAmount: true,
              },
            },
          },
        });

        // If linked to an invoice, update paidAmount and auto-mark paid
        if (dto.invoiceId) {
          const invoice = await tx.invoice.findUnique({
            where: { id: dto.invoiceId },
          });
          const newPaidAmount =
            Number(invoice!.paidAmount) + Number(dto.amount);
          const newStatus =
            newPaidAmount >= Number(invoice!.total)
              ? 'paid'
              : newPaidAmount > 0
                ? 'partially_paid'
                : invoice!.status;

          await tx.invoice.update({
            where: { id: dto.invoiceId },
            data: {
              paidAmount: newPaidAmount,
              status: newStatus,
              paidDate: newStatus === 'paid' ? new Date() : undefined,
            },
          });
        }

        return p;
      });

      return buildSingleResponse(payment);
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(
          `Payment number ${dto.paymentNumber} already exists`,
        );
      }
      throw e;
    }
  }

  async findAll(query: Record<string, any>): Promise<ApiResponse<any>> {
    const { pagination, where } = parseQuery(query);
    const { offset, limit } = pagination;

    const [data, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        orderBy: { paymentDate: 'desc' },
        skip: offset,
        take: limit,
        include: {
          account: { select: { id: true, accountName: true } },
          invoice: { select: { id: true, invoiceNumber: true } },
        },
      }),
      this.prisma.payment.count({ where }),
    ]);

    return buildPaginatedListResponse(data, offset, limit, total);
  }

  async findOne(id: string): Promise<ApiResponse<any>> {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        account: { select: { id: true, accountName: true } },
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            total: true,
            paidAmount: true,
            status: true,
          },
        },
      },
    });
    if (!payment) throw new NotFoundException(`Payment ${id} not found`);
    return buildSingleResponse(payment);
  }

  async applyToInvoice(
    id: string,
    dto: ApplyPaymentDto,
  ): Promise<ApiResponse<any>> {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundException(`Payment ${id} not found`);
    if (payment.invoiceId) {
      throw new BadRequestException(
        `Payment already applied to invoice ${payment.invoiceId}`,
      );
    }
    if (payment.status === 'voided') {
      throw new BadRequestException('Cannot apply a voided payment');
    }

    const invoice = await this.prisma.invoice.findUnique({
      where: { id: dto.invoiceId },
    });
    if (!invoice)
      throw new NotFoundException(`Invoice ${dto.invoiceId} not found`);
    if (invoice.accountId !== payment.accountId) {
      throw new BadRequestException(
        'Invoice does not belong to the same account as the payment',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const newPaidAmount = Number(invoice.paidAmount) + Number(payment.amount);
      const newStatus =
        newPaidAmount >= Number(invoice.total)
          ? 'paid'
          : newPaidAmount > 0
            ? 'partially_paid'
            : invoice.status;

      await tx.invoice.update({
        where: { id: dto.invoiceId },
        data: {
          paidAmount: newPaidAmount,
          status: newStatus,
          paidDate: newStatus === 'paid' ? new Date() : undefined,
        },
      });

      return tx.payment.update({
        where: { id },
        data: { invoiceId: dto.invoiceId, status: 'applied' },
        include: {
          invoice: {
            select: {
              id: true,
              invoiceNumber: true,
              total: true,
              paidAmount: true,
              status: true,
            },
          },
        },
      });
    });

    return buildSingleResponse(result);
  }

  async void(id: string): Promise<ApiResponse<any>> {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundException(`Payment ${id} not found`);
    if (payment.status === 'voided') {
      throw new BadRequestException('Payment is already voided');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Reverse paidAmount on linked invoice
      if (payment.invoiceId) {
        const invoice = await tx.invoice.findUnique({
          where: { id: payment.invoiceId },
        });
        if (invoice) {
          const newPaidAmount = Math.max(
            0,
            Number(invoice.paidAmount) - Number(payment.amount),
          );
          const newStatus =
            newPaidAmount <= 0
              ? invoice.status === 'paid'
                ? 'sent'
                : invoice.status
              : 'partially_paid';

          await tx.invoice.update({
            where: { id: payment.invoiceId },
            data: {
              paidAmount: newPaidAmount,
              status: newStatus,
              paidDate: null,
            },
          });
        }
      }

      return tx.payment.update({
        where: { id },
        data: { status: 'voided' },
      });
    });

    return buildSingleResponse(result);
  }
}

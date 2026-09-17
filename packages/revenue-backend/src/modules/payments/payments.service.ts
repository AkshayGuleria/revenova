import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreatePaymentDto, ApplyPaymentDto } from './dto';
import { Prisma } from '@prisma/client';
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

        // If linked to an invoice, move its balance atomically
        if (dto.invoiceId) {
          await this.settleInvoiceBalance(
            tx,
            dto.invoiceId,
            Number(dto.amount),
          );
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

  /**
   * Moves an invoice's paid balance by `delta` and derives its status.
   *
   * The balance change is an atomic increment/decrement performed by the
   * database, never a read-then-write: two payments landing at the same time
   * would otherwise both read the old balance and one would be lost. The
   * overpayment check runs on the post-update row, so it rolls back the
   * transaction rather than racing another writer.
   */
  private async settleInvoiceBalance(
    tx: Prisma.TransactionClient,
    invoiceId: string,
    delta: number,
  ): Promise<void> {
    const applied = await tx.invoice.update({
      where: { id: invoiceId },
      data:
        delta >= 0
          ? { paidAmount: { increment: delta } }
          : { paidAmount: { decrement: Math.abs(delta) } },
    });

    const total = new Prisma.Decimal(applied.total);
    let paid = new Prisma.Decimal(applied.paidAmount);

    if (delta > 0 && paid.greaterThan(total)) {
      const room = total.minus(paid).plus(delta);
      throw new BadRequestException(
        `Payment exceeds the invoice balance. Outstanding: ${room.toFixed(2)} ${applied.currency ?? ''}`.trim() +
          '.',
      );
    }

    const data: Record<string, any> = {};
    if (paid.lessThan(0)) {
      paid = new Prisma.Decimal(0);
      data.paidAmount = 0;
    }

    let status: string;
    if (paid.greaterThan(0) && paid.greaterThanOrEqualTo(total)) {
      status = 'paid';
    } else if (paid.greaterThan(0)) {
      status = 'partially_paid';
    } else {
      status = ['paid', 'partially_paid'].includes(applied.status)
        ? 'sent'
        : applied.status;
    }

    data.status = status;
    data.paidDate = status === 'paid' ? new Date() : null;

    await tx.invoice.update({ where: { id: invoiceId }, data });
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
      // The reads above only validate ownership; the balance itself moves
      // atomically here, so a concurrent payment cannot be lost.
      await this.settleInvoiceBalance(
        tx,
        dto.invoiceId,
        Number(payment.amount),
      );

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
        await this.settleInvoiceBalance(
          tx,
          payment.invoiceId,
          -Number(payment.amount),
        );
      }

      return tx.payment.update({
        where: { id },
        data: { status: 'voided' },
      });
    });

    return buildSingleResponse(result);
  }
}

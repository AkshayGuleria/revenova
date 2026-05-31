import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  CreateInvoiceDto,
  UpdateInvoiceDto,
  QueryInvoicesDto,
  CreateInvoiceItemDto,
  CreateSubInvoiceDto,
  PaymentMode,
} from './dto';
import { Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { parseQuery } from '../../common/utils/query-parser';
import {
  buildSingleResponse,
  buildPaginatedListResponse,
} from '../../common/utils/response-builder';
import { ApiResponse } from '../../common/interfaces';
import { AuditLogService } from '../audit-log/audit-log.service';

export { PaymentMode };

const SUB_INVOICE_SUFFIX = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

@Injectable()
export class InvoicesService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private auditLogService: AuditLogService,
  ) {}

  async create(createInvoiceDto: CreateInvoiceDto): Promise<ApiResponse<any>> {
    const {
      accountId,
      contractId,
      issueDate,
      dueDate,
      periodStart,
      periodEnd,
      paidDate,
      tax,
      discount,
      ...data
    } = createInvoiceDto;

    data.currency =
      data.currency ??
      this.configService.get<string>('DEFAULT_CURRENCY', 'EUR');

    // contractId is required — guard at service layer as well
    if (!contractId) {
      throw new BadRequestException(
        'contractId is required to create an invoice',
      );
    }

    // Validate account exists
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new NotFoundException(`Account with ID ${accountId} not found`);
    }

    // Fetch contract with its products
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        products: {
          include: { product: true },
        },
      },
    });

    if (!contract) {
      throw new NotFoundException(`Contract with ID ${contractId} not found`);
    }

    // Validate contract belongs to account
    if (contract.accountId !== accountId) {
      throw new BadRequestException(
        'Contract does not belong to the specified account',
      );
    }

    // Contract must have at least one product
    if (!contract.products || contract.products.length === 0) {
      throw new BadRequestException(
        `Contract ${contractId} has no products. Attach at least one product before creating an invoice.`,
      );
    }

    // Validate dates
    const issue = new Date(issueDate);
    const due = new Date(dueDate);

    if (due <= issue) {
      throw new BadRequestException('Due date must be after issue date');
    }

    // Validate period dates if provided
    if (periodStart && periodEnd) {
      const start = new Date(periodStart);
      const end = new Date(periodEnd);

      if (end <= start) {
        throw new BadRequestException(
          'Period end date must be after period start date',
        );
      }
    }

    // Auto-generate invoice items from contract products
    const items = contract.products.map((cp) => {
      const unitPrice =
        cp.unitPrice != null
          ? Number(cp.unitPrice)
          : Number(cp.product.basePrice ?? 0);
      const discountFraction = cp.discount != null ? cp.discount.toNumber() : 0;
      const amount = unitPrice * cp.quantity * (1 - discountFraction);
      return {
        description: cp.product.name,
        quantity: cp.quantity,
        unitPrice,
        amount,
        contractProductId: cp.id,
      };
    });

    // Compute subtotal as sum of item amounts
    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);

    // Apply invoice-level tax and discount to compute total
    const taxAmount = tax ?? 0;
    const discountAmount = discount ?? 0;
    const total = subtotal + taxAmount - discountAmount;

    try {
      const invoice = await this.prisma.$transaction(async (tx) => {
        return tx.invoice.create({
          data: {
            ...data,
            accountId,
            contractId,
            issueDate: issue,
            dueDate: due,
            periodStart: periodStart ? new Date(periodStart) : undefined,
            periodEnd: periodEnd ? new Date(periodEnd) : undefined,
            paidDate: paidDate ? new Date(paidDate) : undefined,
            subtotal,
            tax: taxAmount,
            discount: discountAmount,
            total,
            items: {
              create: items,
            },
          },
          include: {
            items: true,
          },
        });
      });

      // Audit trail — fire-and-forget (non-blocking)
      void this.auditLogService.log({
        entityType: 'invoice',
        entityId: invoice.id,
        action: 'created',
        actorType: 'system',
        metadata: {
          invoiceNumber: invoice.invoiceNumber,
          accountId: invoice.accountId,
        },
      });

      return buildSingleResponse(invoice);
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(
            'Invoice with this number already exists',
          );
        }
      }
      throw error;
    }
  }

  async findAll(query: QueryInvoicesDto): Promise<ApiResponse<any>> {
    // Parse query parameters using utility
    const { pagination, where: parsedWhere } = parseQuery(query);

    const where: Prisma.InvoiceWhereInput = {
      ...parsedWhere,
    };

    const [invoices, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        skip: pagination.offset,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          account: {
            select: {
              id: true,
              accountName: true,
              status: true,
            },
          },
          contract: {
            select: {
              id: true,
              contractNumber: true,
              status: true,
            },
          },
          _count: {
            select: {
              items: true,
            },
          },
        },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return buildPaginatedListResponse(
      invoices,
      pagination.offset,
      pagination.limit,
      total,
    );
  }

  async findOne(id: string): Promise<ApiResponse<any>> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        account: {
          select: {
            id: true,
            accountName: true,
            primaryContactEmail: true,
            billingContactEmail: true,
            status: true,
          },
        },
        contract: {
          select: {
            id: true,
            contractNumber: true,
            status: true,
            startDate: true,
            endDate: true,
          },
        },
        items: {
          orderBy: {
            createdAt: 'asc',
          },
        },
        invoiceGroup: {
          select: { id: true, name: true, groupType: true, code: true },
        },
        _count: {
          select: { items: true, subInvoices: true },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }

    // Build sub-invoice summary for parent invoices
    let subInvoiceTotals: {
      total: string;
      paid: string;
      outstanding: string;
    } | null = null;

    if ((invoice._count?.subInvoices ?? 0) > 0) {
      const agg = await this.prisma.invoice.aggregate({
        where: { parentInvoiceId: id },
        _sum: { total: true, paidAmount: true },
      });
      const total = Number(agg._sum.total ?? 0);
      const paid = Number(agg._sum.paidAmount ?? 0);
      subInvoiceTotals = {
        total: total.toFixed(2),
        paid: paid.toFixed(2),
        outstanding: (total - paid).toFixed(2),
      };
    }

    return buildSingleResponse({
      ...invoice,
      subInvoiceCount: invoice._count?.subInvoices ?? 0,
      subInvoiceTotals,
    });
  }

  // ---------------------------------------------------------------------------
  // Sub-Invoice Methods
  // ---------------------------------------------------------------------------

  async getSubInvoices(
    parentId: string,
    query: QueryInvoicesDto,
  ): Promise<ApiResponse<any>> {
    // Verify parent exists
    await this.getInvoiceById(parentId);

    const { pagination } = parseQuery(query);

    const [subInvoices, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where: { parentInvoiceId: parentId },
        skip: pagination.offset,
        take: pagination.limit,
        orderBy: { invoiceNumber: 'asc' },
        include: {
          account: { select: { id: true, accountName: true, status: true } },
          invoiceGroup: {
            select: { id: true, name: true, groupType: true, code: true },
          },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.invoice.count({ where: { parentInvoiceId: parentId } }),
    ]);

    return buildPaginatedListResponse(
      subInvoices,
      pagination.offset,
      pagination.limit,
      total,
    );
  }

  async createSubInvoice(
    parentId: string,
    dto: CreateSubInvoiceDto,
  ): Promise<ApiResponse<any>> {
    const parent = await this.getInvoiceById(parentId);

    // Validate invoice group if provided
    if (dto.invoiceGroupId) {
      const group = await this.prisma.invoiceGroup.findUnique({
        where: { id: dto.invoiceGroupId },
      });
      if (!group) {
        throw new NotFoundException(
          `Invoice group with ID ${dto.invoiceGroupId} not found`,
        );
      }
      if (group.accountId !== parent.accountId) {
        throw new BadRequestException(
          'Invoice group does not belong to the same account as the parent invoice',
        );
      }
    }

    // Validate amounts
    const calculatedTotal = dto.subtotal + (dto.tax ?? 0) - (dto.discount ?? 0);
    const tolerance = 0.01;
    if (Math.abs(calculatedTotal - dto.total) > tolerance) {
      throw new BadRequestException(
        `Total ${dto.total} does not match subtotal + tax - discount (${calculatedTotal.toFixed(2)})`,
      );
    }

    // Generate sub-invoice number: INV-2026-000042-A, -B, etc.
    const subInvoiceNumber = await this.generateSubInvoiceNumber(
      parent.invoiceNumber,
      parentId,
    );

    const currency =
      dto.currency ?? this.configService.get<string>('DEFAULT_CURRENCY', 'EUR');

    try {
      const subInvoice = await this.prisma.invoice.create({
        data: {
          invoiceNumber: subInvoiceNumber,
          accountId: parent.accountId,
          contractId: dto.contractId ?? parent.contractId,
          parentInvoiceId: parentId,
          invoiceGroupId: dto.invoiceGroupId,
          issueDate: new Date(dto.issueDate ?? parent.issueDate),
          dueDate: new Date(dto.dueDate ?? parent.dueDate),
          periodStart: dto.periodStart
            ? new Date(dto.periodStart)
            : (parent.periodStart ?? undefined),
          periodEnd: dto.periodEnd
            ? new Date(dto.periodEnd)
            : (parent.periodEnd ?? undefined),
          subtotal: dto.subtotal,
          tax: dto.tax ?? 0,
          discount: dto.discount ?? 0,
          total: dto.total,
          currency,
          status: dto.status ?? parent.status,
          billingType: parent.billingType,
          consolidated: false,
          notes: dto.notes,
          internalNotes: dto.internalNotes,
          metadata: dto.metadata,
          items: dto.items ? { create: dto.items } : undefined,
        },
        include: {
          items: true,
          invoiceGroup: {
            select: { id: true, name: true, groupType: true, code: true },
          },
        },
      });

      return buildSingleResponse(subInvoice);
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(
            'Sub-invoice with this number already exists',
          );
        }
      }
      throw error;
    }
  }

  /**
   * Cascade parent payment to all CHILD_PAYS-mode sub-invoices.
   * Called when a parent invoice is marked as paid.
   */
  async cascadeParentPayment(parentId: string, paidDate: Date): Promise<void> {
    const parent = await this.getInvoiceById(parentId);

    if (parent.paymentMode !== PaymentMode.PARENT_PAYS) {
      return; // CHILD_PAYS or null — no cascade
    }

    await this.prisma.invoice.updateMany({
      where: { parentInvoiceId: parentId },
      data: {
        status: 'paid',
        paidDate,
        paidAmount: undefined, // keep per-child paidAmount as-is
        updatedAt: new Date(),
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Returns the raw invoice record (not wrapped in ApiResponse).
   */
  private async getInvoiceById(id: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id } });
    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }
    return invoice;
  }

  /**
   * Generates sub-invoice number: parent-A, parent-B, … parent-Z, parent-AA, etc.
   */
  private async generateSubInvoiceNumber(
    parentNumber: string,
    parentId: string,
  ): Promise<string> {
    const existingCount = await this.prisma.invoice.count({
      where: { parentInvoiceId: parentId },
    });

    // Convert count (0-based) to alphabetic suffix: 0→A, 1→B, …, 25→Z, 26→AA
    const suffix = this.indexToSuffix(existingCount);
    return `${parentNumber}-${suffix}`;
  }

  private indexToSuffix(index: number): string {
    let result = '';
    let n = index;
    do {
      result = SUB_INVOICE_SUFFIX[n % 26] + result;
      n = Math.floor(n / 26) - 1;
    } while (n >= 0);
    return result;
  }

  async update(
    id: string,
    updateInvoiceDto: UpdateInvoiceDto,
  ): Promise<ApiResponse<any>> {
    // Check if invoice exists — also capture current state for audit diff
    const existing = await this.getInvoiceById(id);

    const {
      accountId,
      contractId,
      issueDate,
      dueDate,
      periodStart,
      periodEnd,
      paidDate,
      ...data
    } = updateInvoiceDto;

    // Validate account if being updated
    if (accountId) {
      const account = await this.prisma.account.findUnique({
        where: { id: accountId },
      });

      if (!account) {
        throw new NotFoundException(`Account with ID ${accountId} not found`);
      }
    }

    // Validate contract if being updated
    if (contractId) {
      const contract = await this.prisma.contract.findUnique({
        where: { id: contractId },
      });

      if (!contract) {
        throw new NotFoundException(`Contract with ID ${contractId} not found`);
      }

      // If both accountId and contractId are provided, validate they match
      const targetAccountId = accountId || (await this.getInvoiceAccountId(id));
      if (contract.accountId !== targetAccountId) {
        throw new BadRequestException(
          'Contract does not belong to the specified account',
        );
      }
    }

    // Validate dates if both are provided
    if (issueDate && dueDate) {
      const issue = new Date(issueDate);
      const due = new Date(dueDate);

      if (due <= issue) {
        throw new BadRequestException('Due date must be after issue date');
      }
    }

    // Validate period dates if both are provided
    if (periodStart && periodEnd) {
      const start = new Date(periodStart);
      const end = new Date(periodEnd);

      if (end <= start) {
        throw new BadRequestException(
          'Period end date must be after period start date',
        );
      }
    }

    try {
      const updateData: any = { ...data };

      if (accountId) updateData.accountId = accountId;
      if (contractId) updateData.contractId = contractId;
      if (issueDate) updateData.issueDate = new Date(issueDate);
      if (dueDate) updateData.dueDate = new Date(dueDate);
      if (periodStart) updateData.periodStart = new Date(periodStart);
      if (periodEnd) updateData.periodEnd = new Date(periodEnd);
      if (paidDate) updateData.paidDate = new Date(paidDate);

      const invoice = await this.prisma.invoice.update({
        where: { id },
        data: updateData,
      });

      // Determine the appropriate audit action
      const statusChanged =
        updateData.status !== undefined && updateData.status !== existing.status;
      const action =
        updateData.status === 'paid'
          ? 'paid'
          : statusChanged
            ? 'status_changed'
            : 'updated';

      const changes: Record<string, { from: any; to: any }> = {};
      if (statusChanged) {
        changes['status'] = { from: existing.status, to: invoice.status };
      }

      // Audit trail — fire-and-forget (non-blocking)
      void this.auditLogService.log({
        entityType: 'invoice',
        entityId: invoice.id,
        action,
        actorType: 'system',
        changes: Object.keys(changes).length > 0 ? changes : undefined,
        metadata: { invoiceNumber: invoice.invoiceNumber },
      });

      return buildSingleResponse(invoice);
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(
            'Invoice with this number already exists',
          );
        }
      }
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    // Check if invoice exists
    await this.findOne(id);

    // Hard delete (cascade will delete items)
    await this.prisma.invoice.delete({
      where: { id },
    });
  }

  async addLineItem(
    invoiceId: string,
    createInvoiceItemDto: CreateInvoiceItemDto,
  ): Promise<ApiResponse<any>> {
    // Check if invoice exists
    await this.findOne(invoiceId);

    const item = await this.prisma.invoiceItem.create({
      data: {
        ...createInvoiceItemDto,
        invoiceId,
      },
    });

    return buildSingleResponse(item);
  }

  async removeLineItem(invoiceId: string, itemId: string): Promise<void> {
    // Check if invoice exists
    await this.findOne(invoiceId);

    // Check if item exists and belongs to invoice
    const item = await this.prisma.invoiceItem.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      throw new NotFoundException(`Invoice item with ID ${itemId} not found`);
    }

    if (item.invoiceId !== invoiceId) {
      throw new BadRequestException('Invoice item does not belong to invoice');
    }

    await this.prisma.invoiceItem.delete({
      where: { id: itemId },
    });
  }

  /**
   * Helper method to get invoice's account ID (used in update validation).
   */
  private async getInvoiceAccountId(invoiceId: string): Promise<string> {
    const invoice = await this.getInvoiceById(invoiceId);
    return invoice.accountId;
  }
}

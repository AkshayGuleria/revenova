import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

export interface ConsolidatedInvoiceParams {
  parentAccountId: string;
  periodStart: Date;
  periodEnd: Date;
  includeChildren?: boolean; // Default: true
}

export interface ConsolidatedInvoiceResult {
  invoiceId: string;
  invoiceNumber: string;
  total: Decimal;
  subsidiariesIncluded: number;
}

@Injectable()
export class ConsolidatedBillingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate consolidated invoice for parent account and all subsidiaries
   */
  async generateConsolidatedInvoice(
    params: ConsolidatedInvoiceParams,
  ): Promise<ConsolidatedInvoiceResult> {
    const {
      parentAccountId,
      periodStart,
      periodEnd,
      includeChildren = true,
    } = params;

    // Fetch parent account
    const parentAccount = await this.prisma.account.findUnique({
      where: { id: parentAccountId },
    });

    if (!parentAccount || parentAccount.deletedAt) {
      throw new NotFoundException(
        `Parent account ${parentAccountId} not found`,
      );
    }

    if (parentAccount.creditHold) {
      throw new BadRequestException(
        `Account ${parentAccountId} is on credit hold. Cannot generate invoice.`,
      );
    }

    // Layer 2: soft pre-check — the DB partial unique index (Layer 1) is the
    // ultimate guard but this surfaces a clear error before any heavy work.
    const existingConsolidated = await this.prisma.invoice.findFirst({
      where: {
        accountId: parentAccountId,
        periodStart,
        periodEnd,
        consolidated: true,
        status: { notIn: ['cancelled', 'void'] },
      },
      select: { id: true, invoiceNumber: true },
    });
    if (existingConsolidated) {
      throw new ConflictException(
        `Consolidated invoice ${existingConsolidated.invoiceNumber} already exists for account ${parentAccountId} for this period`,
      );
    }

    // Get all descendant accounts if requested
    const accountIds = [parentAccountId];
    if (includeChildren) {
      const descendants = await this.getDescendantAccounts(parentAccountId);
      accountIds.push(...descendants.map((acc) => acc.id));
    }

    // Collect all contracts for these accounts in the period
    // Includes both owned contracts AND shared contracts
    const contracts = await this.prisma.contract.findMany({
      where: {
        OR: [
          // Owned contracts
          {
            accountId: { in: accountIds },
          },
          // Shared contracts
          {
            shares: {
              some: {
                accountId: { in: accountIds },
              },
            },
          },
        ],
        status: 'active',
        startDate: { lte: periodEnd },
        endDate: { gte: periodStart },
      },
      include: {
        account: {
          select: {
            id: true,
            accountName: true,
            billingContactName: true,
            billingContactEmail: true,
          },
        },
        shares: {
          select: {
            accountId: true,
          },
        },
        products: {
          include: { product: true },
        },
      },
    });

    if (contracts.length === 0) {
      throw new BadRequestException(
        `No active contracts found for consolidated billing period`,
      );
    }

    // Calculate total amounts across all contracts
    const lineItems = [];
    let subtotal = new Decimal(0);

    for (const contract of contracts) {
      const contractLineItems = await this.calculateContractLineItems(
        contract,
        periodStart,
        periodEnd,
      );

      for (const item of contractLineItems) {
        if (!item.amount.gt(0)) continue;
        lineItems.push({
          ...item,
          metadata: {
            contractId: contract.id,
            contractNumber: contract.contractNumber,
            accountId: contract.accountId,
            accountName: contract.account.accountName,
          },
        });
        subtotal = subtotal.add(item.amount);
      }
    }

    if (lineItems.length === 0) {
      throw new BadRequestException(
        `No billable items found for the specified period`,
      );
    }

    // Calculate tax and totals
    const tax = this.calculateTax(subtotal, parentAccount);
    const discount = new Decimal(0); // TODO: Apply consolidated discounts
    const total = subtotal.add(tax).sub(discount);

    // Generate invoice number
    const invoiceNumber = await this.generateInvoiceNumber();

    // Calculate due date
    const issueDate = new Date();
    const dueDate = this.calculateDueDate(
      issueDate,
      parentAccount.paymentTermsDays,
    );

    // Create consolidated invoice
    let invoice: Awaited<ReturnType<typeof this.prisma.invoice.create>>;
    try {
      invoice = await this.prisma.$transaction(async (tx) => {
        const newInvoice = await tx.invoice.create({
          data: {
            invoiceNumber,
            accountId: parentAccountId,
            issueDate,
            dueDate,
            periodStart,
            periodEnd,
            subtotal,
            tax,
            discount,
            total,
            currency: parentAccount.currency,
            status: 'draft',
            billingType: 'recurring',
            consolidated: true,
            notes: `Consolidated invoice for ${accountIds.length} account(s)`,
          },
        });

        // Create invoice items — include billing period on each line item
        await tx.invoiceItem.createMany({
          data: lineItems.map((item) => ({
            invoiceId: newInvoice.id,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            amount: item.amount,
            periodStart,
            periodEnd,
          })),
        });

        return newInvoice;
      });
    } catch (error) {
      // Layer 2 (race condition path): concurrent requests that both pass the
      // soft pre-check will hit the DB partial unique index → P2002.
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `A consolidated invoice already exists for account ${parentAccountId} for this billing period (concurrent request)`,
        );
      }
      throw error;
    }

    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      total: invoice.total,
      subsidiariesIncluded: accountIds.length - 1, // Exclude parent
    };
  }

  /**
   * Get all descendant accounts recursively (up to 5 levels)
   */
  private async getDescendantAccounts(
    parentId: string,
    currentDepth = 0,
    maxDepth = 5,
  ): Promise<any[]> {
    if (currentDepth >= maxDepth) {
      return [];
    }

    const children = await this.prisma.account.findMany({
      where: {
        parentAccountId: parentId,
        deletedAt: null,
        status: 'active',
      },
      select: {
        id: true,
        accountName: true,
        parentAccountId: true,
      },
    });

    const descendants = [...children];

    for (const child of children) {
      const childDescendants = await this.getDescendantAccounts(
        child.id,
        currentDepth + 1,
        maxDepth,
      );
      descendants.push(...childDescendants);
    }

    return descendants;
  }

  /**
   * Return line items for a single contract.
   * Prefers contract products when attached; falls back to seat/flat-fee billing.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async calculateContractLineItems(
    contract: any,
    periodStart: Date,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    periodEnd: Date,
  ): Promise<
    Array<{ description: string; quantity: Decimal; unitPrice: Decimal; amount: Decimal }>
  > {
    const startStr = periodStart.toISOString().split('T')[0];
    const endStr = periodEnd.toISOString().split('T')[0];
    const periodSuffix = ` — ${contract.account.accountName} (${startStr} to ${endStr})`;

    if (contract.products && contract.products.length > 0) {
      return contract.products.map((cp: any) => {
        const unitPrice =
          cp.unitPrice != null
            ? new Decimal(cp.unitPrice)
            : new Decimal(cp.product.basePrice);
        const discountRate =
          cp.discount != null ? new Decimal(cp.discount) : new Decimal(0);
        const amount = unitPrice
          .mul(cp.quantity)
          .mul(new Decimal(1).sub(discountRate));

        return {
          description: `${cp.product.name}${periodSuffix}`,
          quantity: new Decimal(cp.quantity),
          unitPrice,
          amount,
        };
      });
    }

    // No products attached — fall back to seat-based or flat-fee
    const frequency = contract.billingFrequency.toLowerCase();
    let quantity: Decimal;
    let unitPrice: Decimal;

    if (contract.seatCount && contract.seatPrice) {
      quantity = new Decimal(contract.seatCount);
      unitPrice = new Decimal(contract.seatPrice);
    } else {
      quantity = new Decimal(1);
      unitPrice = new Decimal(contract.contractValue);
      if (frequency === 'annual') unitPrice = unitPrice.div(12);
      else if (frequency === 'quarterly') unitPrice = unitPrice.div(3);
    }

    const seatSuffix = contract.seatCount
      ? ` (${contract.seatCount} seats)`
      : '';
    return [
      {
        description: `Contract ${contract.contractNumber}${seatSuffix}${periodSuffix}`,
        quantity,
        unitPrice,
        amount: quantity.mul(unitPrice),
      },
    ];
  }

  /**
   * Calculate tax based on account configuration
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private calculateTax(subtotal: Decimal, account: any): Decimal {
    // TODO: Implement tax calculation based on jurisdiction
    // For now, return 0
    return new Decimal(0);
  }

  /**
   * Generate unique invoice number
   */
  private async generateInvoiceNumber(): Promise<string> {
    const count = await this.prisma.invoice.count();
    const year = new Date().getFullYear();
    const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
    const sequence = (count + 1).toString().padStart(5, '0');
    return `INV-${year}${month}-${sequence}`;
  }

  /**
   * Calculate due date based on payment terms
   */
  private calculateDueDate(issueDate: Date, paymentTermsDays: number): Date {
    const dueDate = new Date(issueDate);
    dueDate.setDate(dueDate.getDate() + paymentTermsDays);
    return dueDate;
  }
}

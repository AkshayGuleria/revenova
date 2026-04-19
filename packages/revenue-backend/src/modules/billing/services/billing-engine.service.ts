import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { SeatCalculatorService } from './seat-calculator.service';
import { Decimal } from '@prisma/client/runtime/library';

export interface GenerateInvoiceParams {
  contractId: string;
  periodStart?: Date;
  periodEnd?: Date;
}

export interface InvoiceGenerationResult {
  invoiceId: string;
  invoiceNumber: string;
  total: Decimal;
}

/**
 * Minimal product shape needed by billing logic.
 * Populated from Phase 4 ContractLineItems; currently null (no product-contract link).
 */
export interface BillableProduct {
  chargeType: string; // 'recurring' | 'one_time' | 'usage_based'
  setupFee: Decimal | null;
  trialPeriodDays: number | null;
}

@Injectable()
export class BillingEngineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly seatCalculator: SeatCalculatorService,
  ) {}

  /**
   * Generate invoice from contract.
   */
  async generateInvoiceFromContract(
    params: GenerateInvoiceParams,
  ): Promise<InvoiceGenerationResult> {
    const { contractId, periodStart, periodEnd } = params;

    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        account: true,
        products: { include: { product: true } },
      },
    });

    if (!contract) {
      throw new NotFoundException(`Contract ${contractId} not found`);
    }

    if (contract.status !== 'active') {
      throw new Error(`Contract ${contractId} is not active`);
    }

    const billingPeriod = this.calculateBillingPeriod(
      contract,
      periodStart,
      periodEnd,
    );

    // Phase 4: product will be resolved from ContractLineItem.
    // Until then, pass null — all existing contracts default to recurring behaviour.
    const product: BillableProduct | null = null;

    // Skip if product rules say we should not bill this period
    if (
      !this.shouldBillProduct(product, contract.startDate, billingPeriod.start)
    ) {
      throw new Error(
        `Product billing skipped for period ${billingPeriod.start.toISOString()} ` +
          `(usage_based, trial, or one_time after first period)`,
      );
    }

    const amounts = await this.calculateInvoiceAmounts(
      contract,
      product,
      billingPeriod.start,
    );

    const invoiceNumber = await this.generateInvoiceNumber();

    const issueDate = new Date();
    const dueDate = this.calculateDueDate(
      issueDate,
      contract.account.paymentTermsDays,
    );

    // Layer 2: Soft pre-check before attempting the DB write.
    // The DB partial unique index (Layer 1) is the ultimate guard, but this
    // gives a clear ConflictException with a human-readable message before we
    // even start the transaction.
    const existingInvoice = await this.prisma.invoice.findFirst({
      where: {
        contractId,
        periodStart: billingPeriod.start,
        periodEnd: billingPeriod.end,
        status: { notIn: ['cancelled', 'void'] },
      },
      select: { id: true, invoiceNumber: true },
    });
    if (existingInvoice) {
      throw new ConflictException(
        `Invoice ${existingInvoice.invoiceNumber} already exists for contract ${contractId} for this period`,
      );
    }

    let invoice: Awaited<ReturnType<typeof this.prisma.invoice.create>>;
    try {
      invoice = await this.prisma.$transaction(async (tx) => {
        const newInvoice = await tx.invoice.create({
          data: {
            invoiceNumber,
            accountId: contract.accountId,
            contractId: contract.id,
            issueDate,
            dueDate,
            periodStart: billingPeriod.start,
            periodEnd: billingPeriod.end,
            subtotal: amounts.subtotal,
            tax: amounts.tax,
            discount: amounts.discount,
            total: amounts.total,
            currency: contract.account.currency,
            status: 'draft',
            billingType: 'recurring',
          },
        });

        await tx.invoiceItem.createMany({
          data: amounts.lineItems.map((item) => ({
            invoiceId: newInvoice.id,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            amount: item.amount,
            periodStart: billingPeriod.start,
            periodEnd: billingPeriod.end,
          })),
        });

        return newInvoice;
      });
    } catch (error) {
      // Layer 2 (race condition path): if two requests slipped past the soft
      // check simultaneously the DB partial unique index fires P2002 — surface
      // it as a ConflictException rather than a 500.
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `An invoice already exists for contract ${contractId} for this billing period (concurrent request)`,
        );
      }
      throw error;
    }

    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      total: invoice.total,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Product charge-type logic (ADR-004 / Phase 3.5)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Determine whether a product should generate a line item for the given period.
   *
   * Rules (ADR-004):
   *  - null / undefined product  → treat as recurring (backward compat)
   *  - usage_based               → always skip (Phase 6)
   *  - trial period active       → skip
   *  - one_time                  → only bill on the first period
   *  - recurring                 → always bill
   */
  shouldBillProduct(
    product: BillableProduct | null,
    contractStartDate: Date,
    periodStart: Date,
  ): boolean {
    if (!product) return true; // no product linked → recurring by default

    if (product.chargeType === 'usage_based') return false;

    // Respect trial period
    const trialDays = product.trialPeriodDays ?? 0;
    if (trialDays > 0) {
      const trialEnd = new Date(contractStartDate);
      trialEnd.setDate(trialEnd.getDate() + trialDays);
      if (periodStart < trialEnd) return false;
    }

    if (product.chargeType === 'one_time') {
      return this.isFirstBillingPeriod(contractStartDate, periodStart);
    }

    return true; // recurring
  }

  /**
   * Return the setup fee if this is the first billing period, 0 otherwise.
   */
  getSetupFee(
    product: BillableProduct | null,
    contractStartDate: Date,
    periodStart: Date,
  ): Decimal {
    if (!product || !product.setupFee) return new Decimal(0);
    if (this.isFirstBillingPeriod(contractStartDate, periodStart)) {
      return product.setupFee;
    }
    return new Decimal(0);
  }

  /**
   * True when periodStart falls within the same calendar month as the contract start.
   * Used to determine "first invoice" for one_time billing and setup fees.
   */
  isFirstBillingPeriod(contractStartDate: Date, periodStart: Date): boolean {
    return (
      contractStartDate.getFullYear() === periodStart.getFullYear() &&
      contractStartDate.getMonth() === periodStart.getMonth()
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────────────────────────────────────────

  private calculateBillingPeriod(
    contract: any,
    periodStart?: Date,
    periodEnd?: Date,
  ): { start: Date; end: Date } {
    if (periodStart && periodEnd) {
      return { start: periodStart, end: periodEnd };
    }

    const now = new Date();
    const start = periodStart || now;

    let end: Date;
    switch (contract.billingFrequency) {
      case 'monthly':
        end = new Date(start);
        end.setMonth(end.getMonth() + 1);
        break;
      case 'quarterly':
        end = new Date(start);
        end.setMonth(end.getMonth() + 3);
        break;
      case 'annual':
        end = new Date(start);
        end.setFullYear(end.getFullYear() + 1);
        break;
      default:
        end = new Date(start);
        end.setMonth(end.getMonth() + 1);
    }

    return { start, end };
  }

  private async calculateInvoiceAmounts(
    contract: any,
    product: BillableProduct | null,
    periodStart: Date,
  ) {
    const lineItems: Array<{
      description: string;
      quantity: Decimal;
      unitPrice: Decimal;
      amount: Decimal;
    }> = [];

    let subtotal = new Decimal(0);

    if (contract.products && contract.products.length > 0) {
      // Contract products attached — bill from them
      for (const cp of contract.products) {
        const unitPrice =
          cp.unitPrice != null
            ? new Decimal(cp.unitPrice)
            : new Decimal(cp.product.basePrice);
        const discountRate =
          cp.discount != null ? new Decimal(cp.discount) : new Decimal(0);
        const amount = unitPrice
          .mul(cp.quantity)
          .mul(new Decimal(1).sub(discountRate));

        lineItems.push({
          description: cp.product.name,
          quantity: new Decimal(cp.quantity),
          unitPrice,
          amount,
        });

        subtotal = subtotal.add(amount);
      }
    } else if (contract.seatCount && contract.seatPrice) {
      // No products attached — fall back to seat-based billing
      const seatPricing = this.seatCalculator.calculateSeatPricing(
        contract.seatCount,
        contract.seatPrice,
        null,
      );

      lineItems.push({
        description: `${contract.billingFrequency.charAt(0).toUpperCase() + contract.billingFrequency.slice(1)} Subscription - ${contract.seatCount} seats`,
        quantity: new Decimal(contract.seatCount),
        unitPrice: seatPricing.pricePerSeat,
        amount: seatPricing.subtotal,
      });

      subtotal = subtotal.add(seatPricing.subtotal);
    } else {
      // No products, no seat pricing — fall back to contract value
      const periodAmount = this.calculatePeriodAmount(
        contract.contractValue,
        contract.billingFrequency,
      );

      lineItems.push({
        description: `${contract.billingFrequency.charAt(0).toUpperCase() + contract.billingFrequency.slice(1)} Subscription`,
        quantity: new Decimal(1),
        unitPrice: periodAmount,
        amount: periodAmount,
      });

      subtotal = subtotal.add(periodAmount);
    }

    // Setup fee on first invoice (Phase 3.5)
    const setupFee = this.getSetupFee(product, contract.startDate, periodStart);
    if (setupFee.greaterThan(0)) {
      lineItems.push({
        description: 'Setup Fee (one-time)',
        quantity: new Decimal(1),
        unitPrice: setupFee,
        amount: setupFee,
      });
      subtotal = subtotal.add(setupFee);
    }

    const tax = new Decimal(0);
    const discount = new Decimal(0);
    const total = subtotal.add(tax).sub(discount);

    return { lineItems, subtotal, tax, discount, total };
  }

  private calculatePeriodAmount(
    contractValue: Decimal,
    frequency: string,
  ): Decimal {
    switch (frequency) {
      case 'monthly':
        return contractValue.div(12);
      case 'quarterly':
        return contractValue.div(4);
      case 'annual':
        return contractValue;
      default:
        return contractValue.div(12);
    }
  }

  private async generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.invoice.count({
      where: {
        invoiceNumber: {
          startsWith: `INV-${year}-`,
        },
      },
    });

    const nextNumber = (count + 1).toString().padStart(6, '0');
    return `INV-${year}-${nextNumber}`;
  }

  private calculateDueDate(issueDate: Date, paymentTermsDays: number): Date {
    const dueDate = new Date(issueDate);
    dueDate.setDate(dueDate.getDate() + paymentTermsDays);
    return dueDate;
  }
}

import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { TaxRatesService } from '../../tax-rates/tax-rates.service';
import { SeatCalculatorService } from './seat-calculator.service';
import { Decimal } from '@prisma/client/runtime/library';
import {
  InvoiceDryRunResult,
  TaxStatus,
  TierDivergence,
} from '../interfaces/dry-run.interface';

export interface GenerateInvoiceParams {
  contractId: string;
  periodStart?: Date;
  periodEnd?: Date;
  /**
   * Run date of a scheduled billing batch. When no explicit period is given the
   * period is the contract-aligned one containing this date, so a retry or
   * rerun on another day resolves to the same period (and the dedup index).
   */
  billingDate?: Date;
}

const SETUP_FEE_PREFIX = 'Setup Fee (one-time)';

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
  private readonly logger = new Logger(BillingEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly seatCalculator: SeatCalculatorService,
    private readonly auditLog: AuditLogService,
    private readonly taxRates: TaxRatesService,
  ) {}

  /**
   * Active contracts whose term covers `asOf` and whose billing frequency
   * matches the run. Accounts on credit hold are excluded in the query — they
   * would be rejected per-contract anyway.
   *
   * Paginated by id cursor (not offset): billed contracts leave the result
   * set, so an offset would skip unbilled ones. Never loads the whole table.
   */
  async findContractsDueForBilling(
    billingFrequency: string,
    asOf: Date,
    pagination: { afterId?: string; take: number },
  ): Promise<{ id: string }[]> {
    return this.prisma.contract.findMany({
      where: {
        ...(pagination.afterId && { id: { gt: pagination.afterId } }),
        // Already invoiced for the period containing `asOf`: nothing to do.
        // Uses the same period columns as idx_invoices_contract_period.
        invoices: {
          none: { periodStart: { lte: asOf }, periodEnd: { gt: asOf } },
        },
        status: 'active',
        billingFrequency,
        startDate: { lte: asOf },
        endDate: { gte: asOf },
        account: { creditHold: false, deletedAt: null },
      },
      select: { id: true },
      orderBy: { id: 'asc' },
      take: pagination.take,
    });
  }

  /**
   * Generate invoice from contract.
   */
  async generateInvoiceFromContract(
    params: GenerateInvoiceParams,
  ): Promise<InvoiceGenerationResult> {
    const { contractId, periodStart, periodEnd, billingDate } = params;

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

    // Credit hold must block the automated path too. CreditHoldGuard only
    // covers POST /api/invoices, so without this a frozen account kept being
    // invoiced by queued and scheduled billing. Dry-run preview below is
    // read-only and deliberately not blocked.
    if (contract.account.creditHold) {
      throw new BadRequestException(
        `Account ${contract.accountId} is on credit hold. Cannot generate invoice.`,
      );
    }

    const billingPeriod = this.calculateBillingPeriod(
      contract,
      periodStart,
      periodEnd,
      billingDate,
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

    let amounts = await this.computeLineItems(
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

    let invoice: Awaited<ReturnType<typeof this.prisma.invoice.create>>;
    try {
      invoice = await this.prisma.$transaction(async (tx) => {
        // Setup fee is exactly-once per contract: decide against prior
        // invoices inside this transaction, under a contract row lock so two
        // concurrent invoices for different periods cannot both charge it.
        if (this.hasSetupFeeLine(amounts.lineItems)) {
          await tx.$queryRaw`SELECT id FROM contracts WHERE id = ${contract.id} FOR UPDATE`;
          const charged = await this.findChargedSetupFees(tx, contract.id);
          if (charged.size > 0) {
            amounts = await this.computeLineItems(
              contract,
              product,
              billingPeriod.start,
              charged,
            );
          }
        }

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
          })),
        });

        // Inside the transaction: the trail cannot survive a rolled-back invoice.
        await this.auditLog.log(
          {
            entityType: 'invoice',
            entityId: newInvoice.id,
            action: 'created',
            actorType: 'system',
            metadata: {
              invoiceNumber: newInvoice.invoiceNumber,
              accountId: contract.accountId,
              contractId: contract.id,
              source: 'contract-billing',
              total: String(amounts.total),
              taxStatus: amounts.taxStatus,
              ...(amounts.tierDivergences.length > 0 && {
                tierDivergences: amounts.tierDivergences,
              }),
            },
          },
          tx,
        );

        return newInvoice;
      });
    } catch (error) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `An invoice already exists for contract ${contractId} for this billing period`,
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

  /**
   * Preview invoice from contract without persisting anything to the database.
   * Runs the full billing calculation pipeline and returns a dry-run result.
   */
  async previewInvoice(
    params: GenerateInvoiceParams,
  ): Promise<InvoiceDryRunResult> {
    const { contractId, periodStart, periodEnd, billingDate } = params;

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
      billingDate,
    );

    const product: BillableProduct | null = null;

    if (
      !this.shouldBillProduct(product, contract.startDate, billingPeriod.start)
    ) {
      throw new Error(
        `Product billing skipped for period ${billingPeriod.start.toISOString()} ` +
          `(usage_based, trial, or one_time after first period)`,
      );
    }

    const amounts = await this.computeLineItems(
      contract,
      product,
      billingPeriod.start,
      await this.findChargedSetupFees(this.prisma, contract.id),
    );

    const projectedInvoiceNumber = await this.generateInvoiceNumber();

    const issueDate = new Date();
    const projectedDueDate = this.calculateDueDate(
      issueDate,
      contract.account.paymentTermsDays,
    );

    return {
      invoiceId: null,
      projectedInvoiceNumber,
      contractId: contract.id,
      accountId: contract.accountId,
      currency: contract.account.currency,
      issueDate,
      projectedDueDate,
      periodStart: billingPeriod.start,
      periodEnd: billingPeriod.end,
      lineItems: amounts.lineItems,
      subtotal: amounts.subtotal,
      tax: amounts.tax,
      discount: amounts.discount,
      total: amounts.total,
      billingType: 'recurring',
      isDryRun: true,
      computedAt: new Date().toISOString(),
      tierDivergences: amounts.tierDivergences,
      taxStatus: amounts.taxStatus,
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
   * The product's setup fee. Whether it is still owed is NOT decided here:
   * exactly-once is enforced against prior invoices (see
   * findChargedSetupFees), because a calendar-month check misses a contract
   * first billed in a later month and double-charges within the start month.
   */
  getSetupFee(product: BillableProduct | null): Decimal {
    if (!product || !product.setupFee) return new Decimal(0);
    return product.setupFee;
  }

  /**
   * Descriptions of setup-fee lines already billed on a non-void invoice of
   * this contract. Pass the transaction client to read inside the tx.
   */
  private async findChargedSetupFees(
    client: Pick<Prisma.TransactionClient, 'invoiceItem'>,
    contractId: string,
  ): Promise<Set<string>> {
    const rows = await client.invoiceItem.findMany({
      where: {
        description: { startsWith: SETUP_FEE_PREFIX },
        invoice: { contractId, status: { notIn: ['void', 'cancelled'] } },
      },
      select: { description: true },
    });
    return new Set(rows.map((r) => r.description));
  }

  private hasSetupFeeLine(lineItems: { description: string }[]): boolean {
    return lineItems.some((i) => i.description.startsWith(SETUP_FEE_PREFIX));
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
    billingDate?: Date,
  ): { start: Date; end: Date } {
    if (periodStart && periodEnd) {
      return { start: periodStart, end: periodEnd };
    }

    if (!periodStart && billingDate) {
      return this.alignPeriodToBillingDate(contract, billingDate);
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

  /**
   * The billing period containing `billingDate`, on boundaries anchored at the
   * contract start and stepped by the billing frequency (UTC, month-end
   * clamped). Deterministic per (contract, period), whatever day it runs.
   */
  private alignPeriodToBillingDate(
    contract: { startDate: Date; billingFrequency: string },
    billingDate: Date,
  ): { start: Date; end: Date } {
    const step =
      contract.billingFrequency === 'quarterly'
        ? 3
        : contract.billingFrequency === 'annual'
          ? 12
          : 1;
    const anchor = contract.startDate;
    const target = Date.UTC(
      billingDate.getUTCFullYear(),
      billingDate.getUTCMonth(),
      billingDate.getUTCDate(),
    );
    const monthsApart =
      (billingDate.getUTCFullYear() - anchor.getUTCFullYear()) * 12 +
      (billingDate.getUTCMonth() - anchor.getUTCMonth());
    let k = Math.max(0, Math.floor(monthsApart / step));
    if (k > 0 && this.addMonthsUtc(anchor, k * step).getTime() > target) k--;
    return {
      start: this.addMonthsUtc(anchor, k * step),
      end: this.addMonthsUtc(anchor, (k + 1) * step),
    };
  }

  private addMonthsUtc(anchor: Date, months: number): Date {
    const total = anchor.getUTCMonth() + months;
    const year = anchor.getUTCFullYear() + Math.floor(total / 12);
    const month = ((total % 12) + 12) % 12;
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    return new Date(
      Date.UTC(year, month, Math.min(anchor.getUTCDate(), lastDay)),
    );
  }

  async computeLineItems(
    contract: any,
    product: BillableProduct | null,
    periodStart: Date,
    chargedSetupFees: ReadonlySet<string> = new Set(),
  ) {
    const lineItems: Array<{
      description: string;
      quantity: Decimal;
      unitPrice: Decimal;
      amount: Decimal;
    }> = [];

    let subtotal = new Decimal(0);
    const tierDivergences: TierDivergence[] = [];

    if (contract.products && contract.products.length > 0) {
      // Contract products attached — bill from them
      for (const cp of contract.products) {
        // Gate per product, not per invoice: one usage_based product must not
        // suppress the whole invoice (ADR-004 defers usage_based to Phase 6).
        if (
          !this.shouldBillProduct(cp.product, contract.startDate, periodStart)
        ) {
          continue;
        }

        const discountRate =
          cp.discount != null ? new Decimal(cp.discount) : new Decimal(0);

        let unitPrice: Decimal;
        let amount: Decimal;

        const tiers = cp.product.volumeTiers;
        if (cp.unitPrice == null && tiers) {
          // Catalog volume tiers apply only when the contract has NOT
          // negotiated its own unit price — a negotiated price wins.
          const tiered = this.seatCalculator.calculateSeatPricing(
            cp.quantity,
            new Decimal(cp.product.basePrice),
            tiers,
          );
          unitPrice = tiered.pricePerSeat;
          amount = tiered.subtotal.mul(new Decimal(1).sub(discountRate));
        } else {
          unitPrice =
            cp.unitPrice != null
              ? new Decimal(cp.unitPrice)
              : new Decimal(cp.product.basePrice);
          amount = unitPrice
            .mul(cp.quantity)
            .mul(new Decimal(1).sub(discountRate));

          // Negotiated price wins, but if the catalog tier would have been
          // cheaper, record the gap. Threshold of one cent keeps rounding
          // noise out of the signal.
          if (cp.unitPrice != null && tiers) {
            const tiered = this.seatCalculator.calculateSeatPricing(
              cp.quantity,
              new Decimal(cp.product.basePrice),
              tiers,
            );
            const tierAmount = tiered.subtotal.mul(
              new Decimal(1).sub(discountRate),
            );
            const difference = amount.sub(tierAmount);
            if (difference.greaterThan(new Decimal('0.01'))) {
              tierDivergences.push({
                productName: cp.product.name,
                quantity: String(cp.quantity),
                negotiatedUnitPrice: unitPrice.toFixed(2),
                tierUnitPrice: tiered.pricePerSeat.toFixed(2),
                negotiatedAmount: amount.toFixed(2),
                tierAmount: tierAmount.toFixed(2),
                difference: difference.toFixed(2),
              });
            }
          }
        }

        lineItems.push({
          description: cp.product.name,
          quantity: new Decimal(cp.quantity),
          unitPrice,
          amount,
        });

        subtotal = subtotal.add(amount);

        // Setup fee is per product and charged once per contract
        const setupDescription = `${SETUP_FEE_PREFIX} — ${cp.product.name}`;
        const productSetupFee = chargedSetupFees.has(setupDescription)
          ? new Decimal(0)
          : this.getSetupFee(cp.product);
        if (productSetupFee.greaterThan(0)) {
          lineItems.push({
            description: setupDescription,
            quantity: new Decimal(1),
            unitPrice: productSetupFee,
            amount: productSetupFee,
          });
          subtotal = subtotal.add(productSetupFee);
        }
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
    const setupFee = chargedSetupFees.has(SETUP_FEE_PREFIX)
      ? new Decimal(0)
      : this.getSetupFee(product);
    if (setupFee.greaterThan(0)) {
      lineItems.push({
        description: SETUP_FEE_PREFIX,
        quantity: new Decimal(1),
        unitPrice: setupFee,
        amount: setupFee,
      });
      subtotal = subtotal.add(setupFee);
    }

    const discount = new Decimal(0);
    const { tax, taxStatus } = await this.resolveTax(
      contract.account,
      subtotal,
      periodStart,
    );
    const total = subtotal.add(tax).sub(discount);

    return {
      lineItems,
      subtotal,
      tax,
      discount,
      total,
      tierDivergences,
      taxStatus,
    };
  }

  /**
   * Tax for an invoice, from the account's jurisdiction.
   *
   * Defaults chosen here (flagged for review):
   *  - jurisdiction = account.billingState when set, else account.billingCountry
   *  - rate is a fraction, matching TaxRate.rate as used by TaxRatesService
   *  - applied to the subtotal (per-line discounts are already deducted)
   *  - no configured rate → 0 tax and a warning, never a failed invoice
   */
  private async resolveTax(
    account: { billingState?: string | null; billingCountry?: string | null },
    subtotal: Decimal,
    asOf: Date,
  ): Promise<{ tax: Decimal; taxStatus: TaxStatus }> {
    const jurisdiction = account?.billingState || account?.billingCountry;
    if (!jurisdiction) {
      this.logger.warn(
        'No billing state or country on account — billing invoice with 0 tax (unrated)',
      );
      return { tax: new Decimal(0), taxStatus: 'unrated_no_jurisdiction' };
    }

    const taxRate = await this.taxRates.findApplicableRate(jurisdiction, asOf);
    if (!taxRate) {
      this.logger.warn(
        `No active tax rate for jurisdiction ${jurisdiction} — billing invoice with 0 tax (unrated)`,
      );
      return { tax: new Decimal(0), taxStatus: 'unrated_no_rate' };
    }

    const rate = new Decimal(taxRate.rate as any);

    // A configured 0% rate is a real answer, not missing config — zero-rated
    // supplies exist (e.g. Finnish healthcare). It is NOT flagged.
    if (rate.isZero()) {
      return { tax: new Decimal(0), taxStatus: 'zero_rated' };
    }

    return { tax: subtotal.mul(rate), taxStatus: 'rated' };
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

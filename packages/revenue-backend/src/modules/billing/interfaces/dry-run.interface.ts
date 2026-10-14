import { Decimal } from '@prisma/client/runtime/library';

export interface DryRunLineItem {
  description: string;
  quantity: Decimal;
  unitPrice: Decimal;
  amount: Decimal;
}

/**
 * A contract line billing ABOVE the product's catalog volume tier.
 *
 * The negotiated ContractProduct.unitPrice always wins (a signed deal is not
 * silently re-priced by a catalog edit), but the gap is reported so stale deals
 * can be found — in the invoice's audit metadata and in dry-run output.
 * Amounts are fixed-2 strings so they survive JSON without precision loss.
 */
export interface TierDivergence {
  productName: string;
  quantity: string;
  negotiatedUnitPrice: string;
  tierUnitPrice: string;
  negotiatedAmount: string;
  tierAmount: string;
  difference: string;
}

/**
 * Why an invoice carries the tax it does.
 *
 *  - `rated`      — a rate was found and applied
 *  - `zero_rated` — a 0% rate is CONFIGURED for the jurisdiction. A real case
 *                   (e.g. Finnish healthcare VAT exemption), not a problem.
 *  - `unrated_no_rate` / `unrated_no_jurisdiction` — the zero comes from
 *                   missing configuration. Billing proceeds, but the invoice
 *                   is flagged so the gap is visible instead of silent.
 */
export type TaxStatus =
  | 'rated'
  | 'zero_rated'
  | 'unrated_no_rate'
  | 'unrated_no_jurisdiction';

export interface InvoiceDryRunResult {
  invoiceId: null;
  projectedInvoiceNumber: string | null;
  contractId: string;
  accountId: string;
  currency: string;
  issueDate: Date;
  projectedDueDate: Date;
  periodStart: Date;
  periodEnd: Date;
  lineItems: DryRunLineItem[];
  subtotal: Decimal;
  tax: Decimal;
  discount: Decimal;
  total: Decimal;
  billingType: 'recurring';
  isDryRun: true;
  computedAt: string;
  tierDivergences?: TierDivergence[];
  taxStatus?: TaxStatus;
}

export interface ConsolidatedDryRunLineItem extends DryRunLineItem {
  contractId: string;
  contractNumber: string;
  accountId: string;
  accountName: string;
}

export interface ConsolidatedDryRunResult {
  invoiceId: null;
  projectedInvoiceNumber: string | null;
  parentAccountId: string;
  currency: string;
  issueDate: Date;
  projectedDueDate: Date;
  periodStart: Date;
  periodEnd: Date;
  lineItems: ConsolidatedDryRunLineItem[];
  subtotal: Decimal;
  tax: Decimal;
  discount: Decimal;
  total: Decimal;
  accountsIncluded: string[];
  subsidiariesIncluded: number;
  isDryRun: true;
  computedAt: string;
  taxStatus?: TaxStatus;
}

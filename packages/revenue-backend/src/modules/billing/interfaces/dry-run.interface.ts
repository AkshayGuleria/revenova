import { Decimal } from '@prisma/client/runtime/library';

export interface DryRunLineItem {
  description: string;
  quantity: Decimal;
  unitPrice: Decimal;
  amount: Decimal;
}

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
}

-- AlterTable: add billing period columns to invoice_items
ALTER TABLE "invoice_items" ADD COLUMN "period_end" DATE,
ADD COLUMN "period_start" DATE;

-- Partial unique index: prevents double-billing the same contract for the same period.
-- Only enforced when contract_id and both period columns are non-null.
CREATE UNIQUE INDEX idx_invoices_contract_period
  ON "invoices" (contract_id, period_start, period_end)
  WHERE contract_id IS NOT NULL AND period_start IS NOT NULL AND period_end IS NOT NULL;

-- Partial unique index: prevents duplicate consolidated invoices for the same account+period.
-- Only enforced on consolidated invoices with both period columns set.
CREATE UNIQUE INDEX idx_invoices_consolidated_period
  ON "invoices" (account_id, period_start, period_end)
  WHERE consolidated = true AND period_start IS NOT NULL AND period_end IS NOT NULL;

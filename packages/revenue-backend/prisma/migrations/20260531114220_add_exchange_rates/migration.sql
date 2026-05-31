-- CreateTable: Phase 4 - Exchange Rates for Multi-Currency Support
CREATE TABLE "exchange_rates" (
    "id" TEXT NOT NULL,
    "from_currency" TEXT NOT NULL,
    "to_currency" TEXT NOT NULL,
    "rate" DECIMAL(14,6) NOT NULL,
    "effective_date" DATE NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rates_from_currency_to_currency_effective_date_key" ON "exchange_rates"("from_currency", "to_currency", "effective_date");

-- CreateIndex
CREATE INDEX "exchange_rates_from_currency_to_currency_idx" ON "exchange_rates"("from_currency", "to_currency");

-- CreateIndex
CREATE INDEX "exchange_rates_effective_date_idx" ON "exchange_rates"("effective_date");

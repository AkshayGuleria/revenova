-- CreateTable
CREATE TABLE "tax_rates" (
    "id" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "tax_type" TEXT NOT NULL,
    "rate" DECIMAL(8,4) NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_rates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tax_rates_jurisdiction_idx" ON "tax_rates"("jurisdiction");

-- CreateIndex
CREATE INDEX "tax_rates_tax_type_idx" ON "tax_rates"("tax_type");

-- CreateIndex
CREATE INDEX "tax_rates_active_idx" ON "tax_rates"("active");

-- CreateIndex
CREATE INDEX "tax_rates_effective_from_idx" ON "tax_rates"("effective_from");

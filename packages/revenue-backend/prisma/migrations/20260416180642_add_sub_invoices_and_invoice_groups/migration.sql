-- AlterTable
ALTER TABLE "invoice_items" ADD COLUMN     "group_reference" TEXT;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "invoice_group_id" TEXT,
ADD COLUMN     "payment_mode" TEXT;

-- CreateTable
CREATE TABLE "invoice_groups" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "group_type" TEXT NOT NULL,
    "code" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_groups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "invoice_groups_account_id_idx" ON "invoice_groups"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_groups_account_id_group_type_code_key" ON "invoice_groups"("account_id", "group_type", "code");

-- CreateIndex
CREATE INDEX "invoices_parent_invoice_id_idx" ON "invoices"("parent_invoice_id");

-- CreateIndex
CREATE INDEX "invoices_invoice_group_id_idx" ON "invoices"("invoice_group_id");

-- AddForeignKey
ALTER TABLE "invoice_groups" ADD CONSTRAINT "invoice_groups_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_parent_invoice_id_fkey" FOREIGN KEY ("parent_invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_invoice_group_id_fkey" FOREIGN KEY ("invoice_group_id") REFERENCES "invoice_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

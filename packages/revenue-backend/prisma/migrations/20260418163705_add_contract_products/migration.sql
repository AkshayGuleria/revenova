-- AlterTable
ALTER TABLE "invoice_items" ADD COLUMN     "contract_product_id" TEXT;

-- CreateTable
CREATE TABLE "contract_products" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(10,2),
    "discount" DECIMAL(5,4),
    "billing_interval" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contract_products_contract_id_idx" ON "contract_products"("contract_id");

-- CreateIndex
CREATE INDEX "contract_products_product_id_idx" ON "contract_products"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "contract_products_contract_id_product_id_key" ON "contract_products"("contract_id", "product_id");

-- AddForeignKey
ALTER TABLE "contract_products" ADD CONSTRAINT "contract_products_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_products" ADD CONSTRAINT "contract_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_contract_product_id_fkey" FOREIGN KEY ("contract_product_id") REFERENCES "contract_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

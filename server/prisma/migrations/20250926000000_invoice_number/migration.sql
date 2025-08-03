-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "number" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");

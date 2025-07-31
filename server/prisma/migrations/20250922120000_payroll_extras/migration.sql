-- AlterTable
ALTER TABLE "ManualPayrollItem" ADD COLUMN "payrollItemId" INTEGER;

-- AddForeignKey
ALTER TABLE "ManualPayrollItem" ADD CONSTRAINT "ManualPayrollItem_payrollItemId_fkey" FOREIGN KEY ("payrollItemId") REFERENCES "PayrollItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

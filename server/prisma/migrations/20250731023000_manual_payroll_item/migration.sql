-- CreateTable
CREATE TABLE "ManualPayrollItem" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "paymentId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ManualPayrollItem_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ManualPayrollItem" ADD CONSTRAINT "ManualPayrollItem_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualPayrollItem" ADD CONSTRAINT "ManualPayrollItem_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "EmployeePayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

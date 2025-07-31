-- DropForeignKey
ALTER TABLE "Appointment" DROP CONSTRAINT "Appointment_clientId_fkey";

-- DropForeignKey
ALTER TABLE "AppointmentTemplate" DROP CONSTRAINT "AppointmentTemplate_clientId_fkey";

-- DropForeignKey
ALTER TABLE "EmployeePayment" DROP CONSTRAINT "EmployeePayment_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "EmployeeTemplateEmployee" DROP CONSTRAINT "EmployeeTemplateEmployee_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "ManualPayrollItem" DROP CONSTRAINT "ManualPayrollItem_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "PayrollItem" DROP CONSTRAINT "PayrollItem_appointmentId_fkey";

-- DropForeignKey
ALTER TABLE "PayrollItem" DROP CONSTRAINT "PayrollItem_employeeId_fkey";

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentTemplate" ADD CONSTRAINT "AppointmentTemplate_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeTemplateEmployee" ADD CONSTRAINT "EmployeeTemplateEmployee_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollItem" ADD CONSTRAINT "PayrollItem_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollItem" ADD CONSTRAINT "PayrollItem_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeePayment" ADD CONSTRAINT "EmployeePayment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualPayrollItem" ADD CONSTRAINT "ManualPayrollItem_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

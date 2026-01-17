-- AlterTable: Add templateId to Appointment
ALTER TABLE "Appointment" ADD COLUMN "templateId" INTEGER;

-- AlterTable: Add templateId to RecurrenceFamily
ALTER TABLE "RecurrenceFamily" ADD COLUMN "templateId" INTEGER;

-- AddForeignKey: Appointment.templateId -> AppointmentTemplate.id
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "AppointmentTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: RecurrenceFamily.templateId -> AppointmentTemplate.id
ALTER TABLE "RecurrenceFamily" ADD CONSTRAINT "RecurrenceFamily_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "AppointmentTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

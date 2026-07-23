-- AlterTable
ALTER TABLE "Message" ADD COLUMN "attributionLabel" TEXT;
ALTER TABLE "Message" ADD COLUMN "bubbleColorOverride" TEXT;

-- CreateEnum
CREATE TYPE "ServiceStatusKind" AS ENUM ('ON_THE_WAY', 'ARRIVED', 'THIRTY_MINUTES_LEFT');

-- CreateTable
CREATE TABLE "AppointmentServiceStatusEvent" (
    "id" SERIAL NOT NULL,
    "appointmentId" INTEGER NOT NULL,
    "kind" "ServiceStatusKind" NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "smsMessageId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppointmentServiceStatusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AppointmentServiceStatusEvent_appointmentId_kind_idx" ON "AppointmentServiceStatusEvent"("appointmentId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentServiceStatusEvent_appointmentId_kind_employeeId_key" ON "AppointmentServiceStatusEvent"("appointmentId", "kind", "employeeId");

-- AddForeignKey
ALTER TABLE "AppointmentServiceStatusEvent" ADD CONSTRAINT "AppointmentServiceStatusEvent_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentServiceStatusEvent" ADD CONSTRAINT "AppointmentServiceStatusEvent_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

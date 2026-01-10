-- AlterEnum: Add RECURRING_UNCONFIRMED to AppointmentStatus (if enum exists and value doesn't)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AppointmentStatus') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum 
            WHERE enumlabel = 'RECURRING_UNCONFIRMED' 
            AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'AppointmentStatus')
        ) THEN
            ALTER TYPE "AppointmentStatus" ADD VALUE 'RECURRING_UNCONFIRMED';
        END IF;
    END IF;
END $$;

-- CreateTable: RecurrenceFamily
CREATE TABLE "RecurrenceFamily" (
    "id" SERIAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "recurrenceRule" TEXT NOT NULL,
    "nextAppointmentDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurrenceFamily_pkey" PRIMARY KEY ("id")
);

-- AlterTable: Add familyId to Appointment (nullable for now)
ALTER TABLE "Appointment" ADD COLUMN "familyId" INTEGER;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "RecurrenceFamily"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Migration: Convert existing recurring appointments to RecurrenceFamily
-- This migration script will be run by a separate Node.js script to handle data migration
-- The SQL here just sets up the schema

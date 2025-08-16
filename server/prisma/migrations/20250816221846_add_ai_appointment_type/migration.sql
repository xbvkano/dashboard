-- AlterEnum
ALTER TYPE "AppointmentType" ADD VALUE 'AI';

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "aiCreated" BOOLEAN NOT NULL DEFAULT false;

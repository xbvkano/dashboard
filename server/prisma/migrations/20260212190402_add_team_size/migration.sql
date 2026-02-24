-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "teamSize" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "AppointmentTemplate" ADD COLUMN     "teamSize" INTEGER NOT NULL DEFAULT 1;

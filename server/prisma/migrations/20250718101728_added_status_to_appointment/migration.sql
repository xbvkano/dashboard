-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('APPOINTED', 'RESCHEDULE_IN', 'RESCHEDULE_OUT', 'CANCEL', 'OBSERVE', 'REBOOK', 'REOCCURRING');

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "status" "AppointmentStatus" NOT NULL DEFAULT 'APPOINTED';

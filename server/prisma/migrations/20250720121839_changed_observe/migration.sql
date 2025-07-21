/*
  Warnings:

  - The values [OBSERVE] on the enum `AppointmentStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "AppointmentStatus_new" AS ENUM ('APPOINTED', 'RESCHEDULE_NEW', 'RESCHEDULE_OLD', 'CANCEL', 'REBOOK', 'REOCCURRING', 'DELETED');
ALTER TABLE "Appointment" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Appointment" ALTER COLUMN "status" TYPE "AppointmentStatus_new" USING ("status"::text::"AppointmentStatus_new");
ALTER TYPE "AppointmentStatus" RENAME TO "AppointmentStatus_old";
ALTER TYPE "AppointmentStatus_new" RENAME TO "AppointmentStatus";
DROP TYPE "AppointmentStatus_old";
ALTER TABLE "Appointment" ALTER COLUMN "status" SET DEFAULT 'APPOINTED';
COMMIT;

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "observe" BOOLEAN NOT NULL DEFAULT false;

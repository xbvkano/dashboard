/*
  Warnings:

  - The values [AI] on the enum `AppointmentType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "AppointmentType_new" AS ENUM ('STANDARD', 'DEEP', 'MOVE_IN_OUT');
ALTER TABLE "Appointment" ALTER COLUMN "type" TYPE "AppointmentType_new" USING ("type"::text::"AppointmentType_new");
ALTER TABLE "AppointmentTemplate" ALTER COLUMN "type" TYPE "AppointmentType_new" USING ("type"::text::"AppointmentType_new");
ALTER TYPE "AppointmentType" RENAME TO "AppointmentType_old";
ALTER TYPE "AppointmentType_new" RENAME TO "AppointmentType";
DROP TYPE "AppointmentType_old";
COMMIT;

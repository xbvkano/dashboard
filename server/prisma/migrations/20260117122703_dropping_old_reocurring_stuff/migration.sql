/*
  Warnings:

  - You are about to drop the column `recurringDone` on the `Appointment` table. All the data in the column will be lost.
  - You are about to drop the column `reoccurring` on the `Appointment` table. All the data in the column will be lost.
  - You are about to drop the column `reocuringDate` on the `Appointment` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Appointment" DROP COLUMN "recurringDone",
DROP COLUMN "reoccurring",
DROP COLUMN "reocuringDate";

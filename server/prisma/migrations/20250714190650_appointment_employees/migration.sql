/*
  Warnings:

  - The primary key for the `_AppointmentEmployees` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[A,B]` on the table `_AppointmentEmployees` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "_AppointmentEmployees" DROP CONSTRAINT "_AppointmentEmployees_AB_pkey";

-- CreateIndex
CREATE UNIQUE INDEX "_AppointmentEmployees_AB_unique" ON "_AppointmentEmployees"("A", "B");

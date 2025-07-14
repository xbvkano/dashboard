-- AlterTable
ALTER TABLE "_AppointmentEmployees" ADD CONSTRAINT "_AppointmentEmployees_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_AppointmentEmployees_AB_unique";

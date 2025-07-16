-- AlterEnum
CREATE TYPE "Role" AS ENUM ('EMPLOYEE','ADMIN','OWNER');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'EMPLOYEE';

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "adminId" INTEGER NOT NULL DEFAULT 1;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

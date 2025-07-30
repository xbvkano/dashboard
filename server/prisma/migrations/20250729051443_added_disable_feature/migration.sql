-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "disabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "disabled" BOOLEAN NOT NULL DEFAULT false;

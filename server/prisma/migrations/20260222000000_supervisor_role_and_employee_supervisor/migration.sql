-- AlterEnum: add SUPERVISOR to Role (if not already present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'SUPERVISOR'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'Role')
  ) THEN
    ALTER TYPE "Role" ADD VALUE 'SUPERVISOR';
  END IF;
END $$;

-- AlterTable: add optional supervisorId to Employee
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "supervisorId" INTEGER;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Employee_supervisorId_fkey'
  ) THEN
    ALTER TABLE "Employee" ADD CONSTRAINT "Employee_supervisorId_fkey"
      FOREIGN KEY ("supervisorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('ZELLE', 'VENMO', 'CASH', 'PAYPAL', 'CHECK', 'OTHER');

-- CreateEnum
CREATE TYPE "AppointmentType" AS ENUM ('STANDARD', 'DEEP', 'MOVE_IN_OUT');

-- CreateTable
CREATE TABLE "Client" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "time" TEXT NOT NULL,
    "clientId" INTEGER NOT NULL,
    "type" "AppointmentType" NOT NULL,
    "address" TEXT NOT NULL,
    "cityStateZip" TEXT,
    "size" TEXT,
    "price" DOUBLE PRECISION,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "tip" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reoccurring" BOOLEAN NOT NULL DEFAULT false,
    "lineage" TEXT NOT NULL,
    "gateCode" TEXT,
    "doorCode" TEXT,
    "buildingNumber" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentTemplate" (
    "id" SERIAL NOT NULL,
    "templateName" TEXT NOT NULL,
    "type" "AppointmentType" NOT NULL,
    "size" TEXT,
    "address" TEXT NOT NULL,
    "cityStateZip" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "clientId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "AppointmentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeTemplate" (
    "id" SERIAL NOT NULL,
    "templateName" TEXT NOT NULL,
    "appointmentTemplateId" INTEGER NOT NULL,
    "totalPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "EmployeeTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeTemplateEmployee" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "employeeTemplateId" INTEGER NOT NULL,

    CONSTRAINT "EmployeeTemplateEmployee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_AppointmentEmployees" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Client_name_key" ON "Client"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_name_key" ON "Employee"("name");

-- CreateIndex
CREATE UNIQUE INDEX "_AppointmentEmployees_AB_unique" ON "_AppointmentEmployees"("A", "B");

-- CreateIndex
CREATE INDEX "_AppointmentEmployees_B_index" ON "_AppointmentEmployees"("B");

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentTemplate" ADD CONSTRAINT "AppointmentTemplate_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeTemplate" ADD CONSTRAINT "EmployeeTemplate_appointmentTemplateId_fkey" FOREIGN KEY ("appointmentTemplateId") REFERENCES "AppointmentTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeTemplateEmployee" ADD CONSTRAINT "EmployeeTemplateEmployee_employeeTemplateId_fkey" FOREIGN KEY ("employeeTemplateId") REFERENCES "EmployeeTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeTemplateEmployee" ADD CONSTRAINT "EmployeeTemplateEmployee_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AppointmentEmployees" ADD CONSTRAINT "_AppointmentEmployees_A_fkey" FOREIGN KEY ("A") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AppointmentEmployees" ADD CONSTRAINT "_AppointmentEmployees_B_fkey" FOREIGN KEY ("B") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

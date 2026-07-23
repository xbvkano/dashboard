-- CreateTable
CREATE TABLE "OnDutyRecurrence" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTimeLocal" TEXT NOT NULL,
    "endTimeLocal" TEXT NOT NULL,
    "timeZone" TEXT NOT NULL DEFAULT 'America/Los_Angeles',
    "intervalWeeks" INTEGER NOT NULL DEFAULT 1,
    "phase" INTEGER NOT NULL DEFAULT 0,
    "anchorDate" DATE NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnDutyRecurrence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnDutySchedule" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "recurrenceId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnDutySchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OnDutyRecurrence_active_dayOfWeek_idx" ON "OnDutyRecurrence"("active", "dayOfWeek");

-- CreateIndex
CREATE INDEX "OnDutyRecurrence_employeeId_idx" ON "OnDutyRecurrence"("employeeId");

-- CreateIndex
CREATE INDEX "OnDutySchedule_active_startAt_endAt_idx" ON "OnDutySchedule"("active", "startAt", "endAt");

-- CreateIndex
CREATE INDEX "OnDutySchedule_employeeId_idx" ON "OnDutySchedule"("employeeId");

-- CreateIndex
CREATE INDEX "OnDutySchedule_recurrenceId_idx" ON "OnDutySchedule"("recurrenceId");

-- AddForeignKey
ALTER TABLE "OnDutyRecurrence" ADD CONSTRAINT "OnDutyRecurrence_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnDutySchedule" ADD CONSTRAINT "OnDutySchedule_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnDutySchedule" ADD CONSTRAINT "OnDutySchedule_recurrenceId_fkey" FOREIGN KEY ("recurrenceId") REFERENCES "OnDutyRecurrence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

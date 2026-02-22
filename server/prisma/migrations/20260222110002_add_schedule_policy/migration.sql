-- CreateTable
CREATE TABLE "SchedulePolicy" (
    "id" SERIAL NOT NULL,
    "updateDayOfWeek" INTEGER NOT NULL DEFAULT 0,
    "remindEmployeeDays" INTEGER NOT NULL DEFAULT 3,
    "supervisorNotifyAfterDays" INTEGER NOT NULL DEFAULT 4,
    "stopRemindingAfterDays" INTEGER NOT NULL DEFAULT 7,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchedulePolicy_pkey" PRIMARY KEY ("id")
);

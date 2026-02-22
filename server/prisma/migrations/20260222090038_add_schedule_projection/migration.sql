-- CreateTable
CREATE TABLE "ScheduleProjection" (
    "id" SERIAL NOT NULL,
    "amTeamSize" INTEGER NOT NULL DEFAULT 0,
    "pmTeamSize" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleProjection_pkey" PRIMARY KEY ("id")
);

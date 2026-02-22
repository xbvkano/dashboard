-- AlterTable
ALTER TABLE "Schedule" ADD COLUMN "nextScheduleUpdateDueAt" TIMESTAMP(3);

-- Backfill: set to next Sunday (on or after today) for existing rows. PostgreSQL: 0=Sunday, 6=Saturday.
-- Next occurrence of Sunday = today + (7 - dow) % 7 days (when dow=0 we get 0 = today).
UPDATE "Schedule"
SET "nextScheduleUpdateDueAt" = (current_date + (7 - EXTRACT(DOW FROM current_date)::integer) % 7)::timestamp
WHERE "nextScheduleUpdateDueAt" IS NULL;

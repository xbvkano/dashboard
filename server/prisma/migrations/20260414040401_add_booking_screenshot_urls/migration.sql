-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "bookingScreenshotUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];

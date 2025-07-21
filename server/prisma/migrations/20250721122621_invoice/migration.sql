-- CreateTable
CREATE TABLE "Invoice" (
    "id" UUID NOT NULL,
    "clientName" TEXT NOT NULL,
    "billedTo" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "serviceDate" TIMESTAMP(3) NOT NULL,
    "serviceTime" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "carpetPrice" DOUBLE PRECISION,
    "discount" DOUBLE PRECISION,
    "taxPercent" DOUBLE PRECISION,
    "total" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_data" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "baseboards" BOOLEAN NOT NULL DEFAULT false,
    "fridgeInside" BOOLEAN NOT NULL DEFAULT false,
    "ovenInside" BOOLEAN NOT NULL DEFAULT false,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "price" INTEGER NOT NULL,
    "carpetShampooRooms" INTEGER NOT NULL,
    "blacklist" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'default',
    "otherSource" TEXT,
    "dateCreated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "form_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "caller" TEXT NOT NULL,
    "called" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "price" INTEGER,

    CONSTRAINT "call_pkey" PRIMARY KEY ("id")
);

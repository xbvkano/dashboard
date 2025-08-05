-- CreateTable
CREATE TABLE "Lock" (
    "id" INTEGER NOT NULL,
    "userId" INTEGER,
    "lockedAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    CONSTRAINT "Lock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Lock_userId_key" ON "Lock"("userId");

-- CreateTable
CREATE TABLE "LockLog" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),
    CONSTRAINT "LockLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Lock" ADD CONSTRAINT "Lock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LockLog" ADD CONSTRAINT "LockLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed row
INSERT INTO "Lock" ("id") VALUES (1);

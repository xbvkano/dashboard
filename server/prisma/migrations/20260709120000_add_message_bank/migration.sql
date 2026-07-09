-- CreateEnum
CREATE TYPE "MessageBankBuiltinVariable" AS ENUM ('NAME', 'PRICE', 'SERVICE_TYPE');

-- CreateTable
CREATE TABLE "MessageBankGroup" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageBankGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageBankTemplate" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "builtinVariables" "MessageBankBuiltinVariable"[],
    "customVariables" JSONB NOT NULL DEFAULT '[]',
    "groupId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageBankTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MessageBankGroup_name_key" ON "MessageBankGroup"("name");

-- CreateIndex
CREATE INDEX "MessageBankTemplate_groupId_idx" ON "MessageBankTemplate"("groupId");

-- AddForeignKey
ALTER TABLE "MessageBankTemplate" ADD CONSTRAINT "MessageBankTemplate_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "MessageBankGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

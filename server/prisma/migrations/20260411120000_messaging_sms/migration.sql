-- CreateEnum
CREATE TYPE "ContactPointType" AS ENUM ('PHONE', 'EMAIL');

-- CreateEnum
CREATE TYPE "ConversationChannel" AS ENUM ('SMS');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('OPEN', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SessionCloseReason" AS ENUM ('INACTIVITY', 'MANUAL', 'APPOINTMENT_BOOKED', 'OTHER');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "MessageSenderType" AS ENUM ('CUSTOMER', 'STAFF', 'SYSTEM', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "MessageDeliveryStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'UNDELIVERED', 'RECEIVED');

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "conversationSessionId" INTEGER;

-- CreateTable
CREATE TABLE "ContactPoint" (
    "id" SERIAL NOT NULL,
    "type" "ContactPointType" NOT NULL,
    "value" TEXT NOT NULL,
    "displayValue" TEXT,
    "twilioAddress" TEXT,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "clientId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" SERIAL NOT NULL,
    "channel" "ConversationChannel" NOT NULL,
    "status" "ConversationStatus" NOT NULL DEFAULT 'OPEN',
    "contactPointId" INTEGER NOT NULL,
    "businessNumber" TEXT NOT NULL,
    "clientId" INTEGER,
    "lastMessageAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationSession" (
    "id" SERIAL NOT NULL,
    "conversationId" INTEGER NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "closeReason" "SessionCloseReason",
    "summary" TEXT,
    "extractedData" JSONB,
    "bookingIntent" TEXT,
    "confidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" SERIAL NOT NULL,
    "conversationId" INTEGER NOT NULL,
    "sessionId" INTEGER,
    "twilioSid" TEXT,
    "twilioAccountSid" TEXT,
    "twilioMessagingSid" TEXT,
    "twilioStatusRaw" TEXT,
    "direction" "MessageDirection" NOT NULL,
    "senderType" "MessageSenderType" NOT NULL,
    "fromContactPointId" INTEGER,
    "toContactPointId" INTEGER,
    "userId" INTEGER,
    "clientId" INTEGER,
    "appointmentId" INTEGER,
    "body" TEXT NOT NULL,
    "mediaCount" INTEGER NOT NULL DEFAULT 0,
    "numSegments" INTEGER,
    "price" DOUBLE PRECISION,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "status" "MessageDeliveryStatus" NOT NULL,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rawPayload" JSONB,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContactPoint_type_value_key" ON "ContactPoint"("type", "value");

-- CreateIndex
CREATE INDEX "ContactPoint_clientId_idx" ON "ContactPoint"("clientId");

-- CreateIndex
CREATE INDEX "ContactPoint_value_idx" ON "ContactPoint"("value");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_contactPointId_businessNumber_key" ON "Conversation"("contactPointId", "businessNumber");

-- CreateIndex
CREATE INDEX "Conversation_clientId_idx" ON "Conversation"("clientId");

-- CreateIndex
CREATE INDEX "Conversation_status_idx" ON "Conversation"("status");

-- CreateIndex
CREATE INDEX "Conversation_lastMessageAt_idx" ON "Conversation"("lastMessageAt");

-- CreateIndex
CREATE INDEX "Conversation_businessNumber_idx" ON "Conversation"("businessNumber");

-- CreateIndex
CREATE INDEX "ConversationSession_conversationId_idx" ON "ConversationSession"("conversationId");

-- CreateIndex
CREATE INDEX "ConversationSession_closedAt_idx" ON "ConversationSession"("closedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Message_twilioSid_key" ON "Message"("twilioSid");

-- CreateIndex
CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId");

-- CreateIndex
CREATE INDEX "Message_sessionId_idx" ON "Message"("sessionId");

-- CreateIndex
CREATE INDEX "Message_createdAt_idx" ON "Message"("createdAt");

-- CreateIndex
CREATE INDEX "Message_userId_idx" ON "Message"("userId");

-- AddForeignKey
ALTER TABLE "ContactPoint" ADD CONSTRAINT "ContactPoint_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_contactPointId_fkey" FOREIGN KEY ("contactPointId") REFERENCES "ContactPoint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationSession" ADD CONSTRAINT "ConversationSession_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ConversationSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_fromContactPointId_fkey" FOREIGN KEY ("fromContactPointId") REFERENCES "ContactPoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_toContactPointId_fkey" FOREIGN KEY ("toContactPointId") REFERENCES "ContactPoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_conversationSessionId_fkey" FOREIGN KEY ("conversationSessionId") REFERENCES "ConversationSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

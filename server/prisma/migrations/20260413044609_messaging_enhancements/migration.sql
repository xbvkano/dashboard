-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "lastPushoverNotifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "messageBubbleColor" TEXT;

-- CreateTable
CREATE TABLE "UserConversationRead" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "conversationId" INTEGER NOT NULL,
    "lastReadMessageId" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserConversationRead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationPresence" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "conversationId" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationPresence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessagingInboxLock" (
    "key" TEXT NOT NULL DEFAULT 'admin_inbox',
    "holderUserId" INTEGER,
    "leaseUntil" TIMESTAMP(3),
    "tabId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessagingInboxLock_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "UserConversationRead_userId_idx" ON "UserConversationRead"("userId");

-- CreateIndex
CREATE INDEX "UserConversationRead_conversationId_idx" ON "UserConversationRead"("conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "UserConversationRead_userId_conversationId_key" ON "UserConversationRead"("userId", "conversationId");

-- CreateIndex
CREATE INDEX "ConversationPresence_conversationId_idx" ON "ConversationPresence"("conversationId");

-- CreateIndex
CREATE INDEX "ConversationPresence_expiresAt_idx" ON "ConversationPresence"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationPresence_userId_conversationId_key" ON "ConversationPresence"("userId", "conversationId");

-- AddForeignKey
ALTER TABLE "UserConversationRead" ADD CONSTRAINT "UserConversationRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserConversationRead" ADD CONSTRAINT "UserConversationRead_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserConversationRead" ADD CONSTRAINT "UserConversationRead_lastReadMessageId_fkey" FOREIGN KEY ("lastReadMessageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationPresence" ADD CONSTRAINT "ConversationPresence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationPresence" ADD CONSTRAINT "ConversationPresence_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessagingInboxLock" ADD CONSTRAINT "MessagingInboxLock_holderUserId_fkey" FOREIGN KEY ("holderUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

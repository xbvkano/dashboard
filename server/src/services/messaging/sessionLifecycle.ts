import type { PrismaClient } from '@prisma/client'
import { SESSION_INACTIVITY_MS } from './constants'

export interface EnsureSessionResult {
  sessionId: number
  rotated: boolean
}

/**
 * Ensures there is exactly one open session for the conversation, rotating on inactivity.
 * Call before appending a new message; uses `conversation.lastMessageAt` as prior activity time.
 */
export async function ensureOpenSession(
  prisma: PrismaClient,
  conversationId: number,
  now: Date
): Promise<EnsureSessionResult> {
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
  })
  if (!conv) {
    throw new Error(`Conversation ${conversationId} not found`)
  }

  const open = await prisma.conversationSession.findFirst({
    where: { conversationId, closedAt: null },
    orderBy: { openedAt: 'desc' },
  })

  const threshold = new Date(now.getTime() - SESSION_INACTIVITY_MS)
  const lastActivity = conv.lastMessageAt
  const shouldRotate = lastActivity != null && lastActivity < threshold

  if (shouldRotate && open) {
    await prisma.conversationSession.update({
      where: { id: open.id },
      data: {
        closedAt: now,
        closeReason: 'INACTIVITY',
      },
    })
    const created = await prisma.conversationSession.create({
      data: { conversationId },
    })
    return { sessionId: created.id, rotated: true }
  }

  if (!open) {
    const created = await prisma.conversationSession.create({
      data: { conversationId },
    })
    return { sessionId: created.id, rotated: false }
  }

  return { sessionId: open.id, rotated: false }
}

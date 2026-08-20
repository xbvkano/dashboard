import { ConversationStatus, type PrismaClient } from '@prisma/client'
import { ingestInboundSms } from './messagingService'
import {
  resolveInboxBusinessNumber,
  type MessagingInboxKind,
} from './inboxLines'

type Db = PrismaClient

export function uniqueDevInboundFromE164(nowMs = Date.now()): string {
  const suffix = String(nowMs % 10000).padStart(4, '0')
  return `+1555001${suffix}`
}

export async function markAllOpenConversationsRead(db: Db, userId: number): Promise<number> {
  const rows = await db.conversation.findMany({
    where: { status: ConversationStatus.OPEN },
    select: {
      id: true,
      messages: {
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 1,
        select: { id: true },
      },
    },
  })
  let marked = 0
  for (const row of rows) {
    const lastId = row.messages[0]?.id ?? null
    await db.userConversationRead.upsert({
      where: { userId_conversationId: { userId, conversationId: row.id } },
      create: { userId, conversationId: row.id, lastReadMessageId: lastId },
      update: { lastReadMessageId: lastId },
    })
    marked += 1
  }
  return marked
}

export async function createDevInboundUnread(args: {
  db: Db
  inboxes: MessagingInboxKind[]
}): Promise<Array<{ inbox: MessagingInboxKind; conversationId: number; fromE164: string }>> {
  const created: Array<{ inbox: MessagingInboxKind; conversationId: number; fromE164: string }> = []
  let tick = Date.now()
  for (const inbox of args.inboxes) {
    let businessNumber: string
    try {
      businessNumber = resolveInboxBusinessNumber(inbox)
    } catch {
      continue
    }
    const fromE164 = uniqueDevInboundFromE164(tick)
    tick += 1
    const out = await ingestInboundSms(
      args.db,
      {
        From: fromE164,
        To: businessNumber,
        Body: `DevTools test inbound (${inbox} inbox)`,
        MessageSid: `SM_DEV_${tick}`,
        NumMedia: '0',
      },
      { skipPushover: true },
    )
    created.push({ inbox, conversationId: out.conversationId, fromE164 })
  }
  return created
}

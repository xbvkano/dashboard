import { ConversationStatus, type PrismaClient } from '@prisma/client'
import { isLastMessageUnread } from '../../utils/messagingDto'
import {
  resolveInboxBusinessNumber,
  type MessagingInboxKind,
} from './inboxLines'

export type MessagingUnreadCounts = {
  client: number
  employee: number
  total: number
}

type UnreadCountDb = Pick<PrismaClient, 'conversation'>
type MarkReadDb = Pick<PrismaClient, 'conversation' | 'userConversationRead'>

function tryInboxBusinessNumber(kind: MessagingInboxKind): string | null {
  try {
    return resolveInboxBusinessNumber(kind)
  } catch {
    return null
  }
}

export async function countUnreadForBusinessNumber(
  db: UnreadCountDb,
  userId: number,
  businessNumber: string,
): Promise<number> {
  const rows = await db.conversation.findMany({
    where: {
      status: ConversationStatus.OPEN,
      businessNumber,
    },
    select: {
      messages: {
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 1,
        select: { id: true, direction: true },
      },
      userReads: {
        where: { userId },
        take: 1,
        select: { lastReadMessageId: true },
      },
    },
  })
  return rows.filter((row) =>
    isLastMessageUnread(row.messages[0], row.userReads[0]?.lastReadMessageId),
  ).length
}

export async function countMessagingUnread(
  db: UnreadCountDb,
  userId: number,
): Promise<MessagingUnreadCounts> {
  const clientNumber = tryInboxBusinessNumber('client')
  const employeeNumber = tryInboxBusinessNumber('employee')
  const [client, employee] = await Promise.all([
    clientNumber ? countUnreadForBusinessNumber(db, userId, clientNumber) : Promise.resolve(0),
    employeeNumber ? countUnreadForBusinessNumber(db, userId, employeeNumber) : Promise.resolve(0),
  ])
  return { client, employee, total: client + employee }
}

/** Mark every OPEN thread on this business line as read for the user, and reset Pushover throttle. */
export async function markInboxConversationsRead(
  db: MarkReadDb,
  userId: number,
  businessNumber: string,
): Promise<number> {
  const rows = await db.conversation.findMany({
    where: { status: ConversationStatus.OPEN, businessNumber },
    select: {
      id: true,
      messages: {
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 1,
        select: { id: true },
      },
    },
  })
  if (rows.length === 0) return 0
  await Promise.all(
    rows.map((row) => {
      const lastId = row.messages[0]?.id ?? null
      return db.userConversationRead.upsert({
        where: { userId_conversationId: { userId, conversationId: row.id } },
        create: { userId, conversationId: row.id, lastReadMessageId: lastId },
        update: { lastReadMessageId: lastId },
      })
    }),
  )
  await db.conversation.updateMany({
    where: { id: { in: rows.map((r) => r.id) } },
    data: { lastPushoverNotifiedAt: null },
  })
  return rows.length
}

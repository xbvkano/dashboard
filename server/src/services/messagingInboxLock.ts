import type { PrismaClient } from '@prisma/client'
import {
  CLIENT_INBOX_LOCK_KEY,
  type MessagingInboxKind,
  inboxLockKey,
} from './messaging/inboxLines'

const LEASE_MS = 60_000

export { CLIENT_INBOX_LOCK_KEY as INBOX_LOCK_KEY }

export async function acquireOrRenewInboxLock(
  prisma: PrismaClient,
  args: { userId: number; tabId?: string | null; force?: boolean; inbox?: MessagingInboxKind }
): Promise<{ ok: true } | { ok: false; holderUserId: number; leaseUntil: string }> {
  const key = inboxLockKey(args.inbox === 'employee' ? 'employee' : 'client')
  const now = new Date()
  const leaseUntil = new Date(now.getTime() + LEASE_MS)

  let row = await prisma.messagingInboxLock.findUnique({
    where: { key },
  })

  if (!row) {
    await prisma.messagingInboxLock.create({
      data: {
        key,
        holderUserId: args.userId,
        leaseUntil,
        tabId: args.tabId ?? undefined,
      },
    })
    return { ok: true }
  }

  const expired = !row.leaseUntil || row.leaseUntil.getTime() <= now.getTime()
  const sameUser = row.holderUserId === args.userId
  const vacant = row.holderUserId == null

  if (args.force && !sameUser && !expired && !vacant) {
    await prisma.messagingInboxLock.update({
      where: { key },
      data: { holderUserId: args.userId, leaseUntil, tabId: args.tabId ?? undefined },
    })
    return { ok: true }
  }

  if (vacant || expired || sameUser) {
    await prisma.messagingInboxLock.update({
      where: { key },
      data: { holderUserId: args.userId, leaseUntil, tabId: args.tabId ?? undefined },
    })
    return { ok: true }
  }

  return {
    ok: false,
    holderUserId: row.holderUserId!,
    leaseUntil: row.leaseUntil!.toISOString(),
  }
}

export async function releaseInboxLock(
  prisma: PrismaClient,
  args: { userId: number; inbox?: MessagingInboxKind }
): Promise<void> {
  const key = inboxLockKey(args.inbox === 'employee' ? 'employee' : 'client')
  const row = await prisma.messagingInboxLock.findUnique({ where: { key } })
  if (!row || row.holderUserId !== args.userId) return
  await prisma.messagingInboxLock.update({
    where: { key },
    data: { holderUserId: null, leaseUntil: null, tabId: null },
  })
}

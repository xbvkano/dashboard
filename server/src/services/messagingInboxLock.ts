import type { PrismaClient } from '@prisma/client'

export const INBOX_LOCK_KEY = 'admin_inbox'
const LEASE_MS = 60_000

export async function acquireOrRenewInboxLock(
  prisma: PrismaClient,
  args: { userId: number; tabId?: string | null; force?: boolean }
): Promise<{ ok: true } | { ok: false; holderUserId: number; leaseUntil: string }> {
  const now = new Date()
  const leaseUntil = new Date(now.getTime() + LEASE_MS)

  let row = await prisma.messagingInboxLock.findUnique({
    where: { key: INBOX_LOCK_KEY },
  })

  if (!row) {
    await prisma.messagingInboxLock.create({
      data: {
        key: INBOX_LOCK_KEY,
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
      where: { key: INBOX_LOCK_KEY },
      data: { holderUserId: args.userId, leaseUntil, tabId: args.tabId ?? undefined },
    })
    return { ok: true }
  }

  if (vacant || expired || sameUser) {
    await prisma.messagingInboxLock.update({
      where: { key: INBOX_LOCK_KEY },
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

export async function releaseInboxLock(prisma: PrismaClient, args: { userId: number }): Promise<void> {
  const row = await prisma.messagingInboxLock.findUnique({ where: { key: INBOX_LOCK_KEY } })
  if (!row || row.holderUserId !== args.userId) return
  await prisma.messagingInboxLock.update({
    where: { key: INBOX_LOCK_KEY },
    data: { holderUserId: null, leaseUntil: null, tabId: null },
  })
}

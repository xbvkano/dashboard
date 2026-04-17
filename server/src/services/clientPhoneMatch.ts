import type { PrismaClient } from '@prisma/client'
import { phoneLookupVariants, phoneNumbersMatchForLinking } from '../utils/phoneUtils'

/**
 * Finds a client whose stored number refers to the same NANP line as `canonicalE164`.
 * Uses DB variants only as a narrow filter; every candidate is verified with {@link phoneNumbersMatchForLinking}.
 */
export async function findFirstClientMatchingPhone(
  prisma: PrismaClient,
  canonicalE164: string
): Promise<{ id: number; number: string; name: string } | null> {
  const rows = await prisma.client.findMany({
    where: { number: { in: phoneLookupVariants(canonicalE164) } },
    select: { id: true, number: true, name: true },
  })
  const matched = rows.filter((r) => phoneNumbersMatchForLinking(canonicalE164, r.number))
  return matched[0] ?? null
}

/**
 * If the contact point is linked to a client whose phone does not match this thread, unlink
 * (contact point + conversations on this business line) so a correct link can be created later.
 */
export async function unlinkContactPointIfClientPhoneMismatch(
  prisma: PrismaClient,
  contactPointId: number,
  canonicalPhone: string,
  businessNumber: string
): Promise<void> {
  const cp = await prisma.contactPoint.findUnique({
    where: { id: contactPointId },
    select: { id: true, clientId: true },
  })
  if (!cp?.clientId) return

  const client = await prisma.client.findUnique({
    where: { id: cp.clientId },
    select: { id: true, number: true },
  })
  if (!client) {
    await prisma.contactPoint.update({ where: { id: contactPointId }, data: { clientId: null } })
    await prisma.conversation.updateMany({
      where: { contactPointId, businessNumber },
      data: { clientId: null },
    })
    return
  }

  if (!phoneNumbersMatchForLinking(canonicalPhone, client.number)) {
    await prisma.contactPoint.update({ where: { id: contactPointId }, data: { clientId: null } })
    await prisma.conversation.updateMany({
      where: { contactPointId, businessNumber },
      data: { clientId: null },
    })
  }
}

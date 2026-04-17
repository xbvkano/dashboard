import type { PrismaClient } from '@prisma/client'

/**
 * Picks a unique Client.name: tries base, then "base last4", then "base (1)", "base (2)", …
 */
export async function pickUniqueClientDisplayName(
  prisma: PrismaClient,
  baseName: string,
  phoneE164: string,
  excludeClientId?: number
): Promise<string> {
  const digits = phoneE164.replace(/\D/g, '')
  const last4 = digits.length >= 4 ? digits.slice(-4) : digits

  const candidates: string[] = [baseName, `${baseName} ${last4}`]
  for (let n = 1; n <= 500; n++) {
    candidates.push(`${baseName} (${n})`)
  }

  for (const c of candidates) {
    const clash = await prisma.client.findFirst({
      where: {
        name: { equals: c, mode: 'insensitive' },
        ...(excludeClientId != null ? { NOT: { id: excludeClientId } } : {}),
      },
      select: { id: true },
    })
    if (!clash) return c
  }

  throw new Error('Could not resolve a unique client name')
}

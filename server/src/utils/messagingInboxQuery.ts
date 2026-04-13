import type { Prisma } from '@prisma/client'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100

export function clampInboxLimit(raw: unknown): number {
  const n = typeof raw === 'string' ? parseInt(raw, 10) : typeof raw === 'number' ? raw : NaN
  if (!Number.isFinite(n) || n < 1) return DEFAULT_LIMIT
  return Math.min(Math.floor(n), MAX_LIMIT)
}

/** Digits only for phone search */
export function digitsOnly(s: string): string {
  return s.replace(/\D/g, '')
}

export type InboxCursor = { o: number }

export function encodeInboxCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ o: offset } satisfies InboxCursor), 'utf8').toString('base64url')
}

export function decodeInboxCursor(raw: unknown): InboxCursor | null {
  if (raw == null || raw === '') return null
  if (typeof raw !== 'string') return null
  try {
    const json = Buffer.from(raw, 'base64url').toString('utf8')
    const p = JSON.parse(json) as InboxCursor
    if (typeof p?.o !== 'number' || !Number.isFinite(p.o) || p.o < 0) return null
    return { o: Math.floor(p.o) }
  } catch {
    return null
  }
}

/** Build Prisma where for optional search q (name / phone) */
export function inboxSearchWhere(q: string | undefined): Prisma.ConversationWhereInput | undefined {
  const trimmed = typeof q === 'string' ? q.trim() : ''
  if (!trimmed) return undefined

  const digits = digitsOnly(trimmed)
  const or: Prisma.ConversationWhereInput[] = [
    {
      client: {
        name: { contains: trimmed, mode: 'insensitive' },
      },
    },
    {
      contactPoint: {
        displayValue: { contains: trimmed, mode: 'insensitive' },
      },
    },
  ]
  if (digits.length > 0) {
    or.push({
      contactPoint: {
        value: { contains: digits },
      },
    })
    or.push({
      client: {
        number: { contains: digits },
      },
    })
  }

  return { OR: or }
}

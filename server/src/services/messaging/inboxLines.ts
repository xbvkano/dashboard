import { normalizePhone } from '../../utils/phoneUtils'

export type MessagingInboxKind = 'client' | 'employee'

export const CLIENT_INBOX_LOCK_KEY = 'admin_inbox'
export const EMPLOYEE_INBOX_LOCK_KEY = 'employee_inbox'

/** Compare E.164-ish values for equality after normalization when possible. */
export function sameE164(a: string, b: string): boolean {
  const na = normalizePhone(a) ?? a.trim()
  const nb = normalizePhone(b) ?? b.trim()
  return Boolean(na && nb && na === nb)
}

export function getClientInboxBusinessNumber(): string {
  const n = process.env.TWILIO_FROM_NUMBER?.trim()
  if (!n) {
    throw new Error('TWILIO_FROM_NUMBER is not configured (required as client inbox business line)')
  }
  const normalized = normalizePhone(n) ?? n
  return normalized
}

/**
 * Employee / admin SMS line. Prefer TWILIO_ADMIN_FROM_NUMBER.
 * Must be a different number than TWILIO_FROM_NUMBER; keep it out of the client
 * Messaging Service sender pool.
 * Also accepts TWILIO_ADMIN_ROM_NUMBER (common typo) and TWILIO_ADMIN_PHONE_NUMBER (voice line).
 */
export function getEmployeeInboxBusinessNumber(): string {
  const n =
    process.env.TWILIO_ADMIN_FROM_NUMBER?.trim() ||
    process.env.TWILIO_ADMIN_ROM_NUMBER?.trim() ||
    process.env.TWILIO_ADMIN_PHONE_NUMBER?.trim()
  if (!n) {
    throw new Error(
      'TWILIO_ADMIN_FROM_NUMBER is not configured (required as employee inbox business line)',
    )
  }
  const normalized = normalizePhone(n) ?? n
  return normalized
}

export function resolveInboxBusinessNumber(kind: MessagingInboxKind): string {
  return kind === 'employee' ? getEmployeeInboxBusinessNumber() : getClientInboxBusinessNumber()
}

export function inboxLockKey(kind: MessagingInboxKind): string {
  return kind === 'employee' ? EMPLOYEE_INBOX_LOCK_KEY : CLIENT_INBOX_LOCK_KEY
}

/** Parse `inbox` query/body: client | employee. Default client. */
export function parseMessagingInboxKind(raw: unknown): MessagingInboxKind {
  if (typeof raw !== 'string') return 'client'
  const v = raw.trim().toLowerCase()
  if (v === 'employee' || v === 'employees' || v === 'admin') return 'employee'
  return 'client'
}

export function isEmployeeInboxBusinessNumber(businessNumber: string): boolean {
  try {
    return sameE164(businessNumber, getEmployeeInboxBusinessNumber())
  } catch {
    return false
  }
}

/**
 * US-focused phone normalization. Prefer storing E.164 (`+1XXXXXXXXXX`) for SMS/Twilio.
 */
export function normalizePhone(num: string): string | null {
  const digits = num.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return null
}

/**
 * Values to match legacy `Client.number` / `Employee.number` rows that may omit `+` or country code.
 */
export function phoneLookupVariants(e164: string): string[] {
  const d = e164.replace(/\D/g, '')
  const out = new Set<string>([e164, d])
  if (d.length === 11 && d.startsWith('1')) {
    out.add(d.slice(1))
  }
  if (d.length === 10) {
    out.add(`1${d}`)
    out.add(`+1${d}`)
  }
  return [...out]
}

/** Supervisor User: prefer linked Employee number, else `userName` as digits (same rules as `normalizePhone`). */
export function supervisorPhoneE164(supervisor: {
  employee?: { number: string } | null
  userName: string | null
}): string | null {
  if (supervisor.employee?.number) {
    return normalizePhone(supervisor.employee.number)
  }
  if (supervisor.userName) {
    return normalizePhone(supervisor.userName)
  }
  return null
}

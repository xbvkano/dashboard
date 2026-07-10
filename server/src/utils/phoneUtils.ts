/**
 * Phone normalization and login identity helpers.
 * US numbers use 10-digit national `userName` for legacy accounts; international numbers use full country-code digits.
 */

const E164_MIN_DIGITS = 8
const E164_MAX_DIGITS = 15

/** US-focused phone normalization. Returns E.164 (+...) or null. */
export function normalizePhone(num: string): string | null {
  const trimmed = num.trim()
  if (!trimmed) return null

  if (trimmed.startsWith('+')) {
    const digits = trimmed.replace(/\D/g, '')
    if (digits.length < E164_MIN_DIGITS || digits.length > E164_MAX_DIGITS) return null
    return `+${digits}`
  }

  const digits = trimmed.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  if (digits.length > 11 && digits.length <= E164_MAX_DIGITS) return `+${digits}`
  if (digits.length >= 10 && digits.length <= 11 && !digits.startsWith('1')) {
    return `+${digits}`
  }

  return null
}

/** Login / User.userName from E.164 or stored employee number. US → 10-digit national; intl → all digits. */
export function generateUserName(phoneNumber: string): string {
  const digits = phoneNumber.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1)
  return digits
}

/** Normalize login phone input to stored userName form. */
export function loginUserNameFromInput(input: string): string {
  const digits = input.replace(/\D/g, '')
  if (!digits) return ''
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1)
  return digits
}

/** Candidate userNames to try when logging in (legacy US variants). */
export function loginUserNameCandidates(input: string): string[] {
  const digits = input.replace(/\D/g, '')
  const out = new Set<string>()
  if (!digits) return []

  out.add(loginUserNameFromInput(input))
  out.add(digits)

  if (digits.length === 10) {
    out.add(`1${digits}`)
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    out.add(digits.slice(1))
  }

  return [...out]
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

/**
 * US NANP: compare two stored phone strings as equal only if the 10-digit national number matches.
 * Leading country code (+1 / 1) is ignored; formatting differences are ignored.
 */
export function nanp10DigitsForComparison(raw: string): string | null {
  const d = raw.replace(/\D/g, '')
  if (d.length === 11 && d.startsWith('1')) return d.slice(1)
  if (d.length === 10) return d
  return null
}

export function phoneNumbersMatchForLinking(a: string, b: string): boolean {
  const da = nanp10DigitsForComparison(a)
  const db = nanp10DigitsForComparison(b)
  if (da != null && db != null) return da === db
  const ea = a.replace(/\D/g, '')
  const eb = b.replace(/\D/g, '')
  if (ea.length >= E164_MIN_DIGITS && eb.length >= E164_MIN_DIGITS) return ea === eb
  return false
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

const E164_MAX_DIGITS = 15

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

function nationalDigits(value: string): string {
  const digits = digitsOnly(value)
  if (!digits) return ''
  return digits.startsWith('1') && digits.length === 11 ? digits.slice(1) : digits
}

function isUsNumber(value: string): boolean {
  const trimmed = value.trim()
  if (trimmed.startsWith('+')) return trimmed.startsWith('+1')
  const d = digitsOnly(trimmed)
  if (!d) return true
  if (d.length === 10) return true
  if (d.length === 11 && d.startsWith('1')) return true
  if (d.length < 10) return true
  return false
}

function formatInternationalDisplay(value: string): string {
  const digits = digitsOnly(value)
  if (!digits) return value.startsWith('+') ? '+' : ''
  return `+${digits}`
}

/** Display with country code. US: +1 (234)-567-8912; international: +61433441476 */
export function formatPhone(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (!isUsNumber(trimmed)) return formatInternationalDisplay(trimmed)

  const num = nationalDigits(trimmed)
  if (!num) return ''
  let result = '+1'
  if (num.length > 0) result += ' (' + num.slice(0, 3)
  if (num.length >= 3) result += ')'
  if (num.length > 3) result += '-' + num.slice(3, 6)
  if (num.length > 6) result += '-' + num.slice(6, 10)
  return result
}

/** US display without country code: (234)-567-8912 */
export function formatPhoneNational(value: string): string {
  if (!isUsNumber(value)) return formatInternationalDisplay(value)

  const num = nationalDigits(value)
  if (!num) return ''
  let result = ''
  if (num.length > 0) result += '(' + num.slice(0, 3)
  if (num.length >= 3) result += ')'
  if (num.length > 3) result += '-' + num.slice(3, 6)
  if (num.length > 6) result += '-' + num.slice(6, 10)
  return result
}

/** Strip non-digits; cap length while typing (E.164 max 15). Keeps leading + in returned string when present. */
export function phoneDigitsOnly(value: string, maxLen = E164_MAX_DIGITS): string {
  const hasPlus = value.trimStart().startsWith('+')
  const digits = digitsOnly(value).slice(0, maxLen)
  return hasPlus ? `+${digits}` : digits
}

/** Match server generateUserName for login lookup. */
export function phoneToLoginUserName(value: string): string {
  const digits = digitsOnly(value)
  if (!digits) return ''
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1)
  return digits
}

/** Minimum digit count for a valid phone (excluding +). */
export function phoneHasMinDigits(value: string, min = 8): boolean {
  return digitsOnly(value).length >= min
}

/** Normalize employee form payload before POST/PUT. */
export function phoneToApiPayload(value: string): string {
  const trimmed = value.trim()
  if (trimmed.startsWith('+')) return trimmed.replace(/[^\d+]/g, '')
  const digits = digitsOnly(trimmed)
  if (digits.length === 10) return digits
  if (digits.length === 11 && digits.startsWith('1')) return digits
  return digits.length > 0 ? `+${digits}` : ''
}

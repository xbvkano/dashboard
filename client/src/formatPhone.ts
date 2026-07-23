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

export type PhoneParts = { countryCode: string; national: string }

/**
 * Split a stored/API phone into country code + national digits for the split input UI.
 * Empty → default +1. Prefers US (+1 / 10-digit / 11-digit) before intl heuristics.
 */
export function splitPhone(value: string): PhoneParts {
  const trimmed = value.trim()
  if (!trimmed) return { countryCode: '1', national: '' }

  const digits = digitsOnly(trimmed)
  if (!digits) return { countryCode: '1', national: '' }

  const hasPlus = trimmed.startsWith('+')

  // Explicit or implied US / NANP
  if (hasPlus && digits.startsWith('1')) {
    return { countryCode: '1', national: digits.slice(1).slice(0, 10) }
  }
  if (!hasPlus) {
    if (digits.length === 11 && digits.startsWith('1')) {
      return { countryCode: '1', national: digits.slice(1, 11) }
    }
    if (digits.length <= 10) {
      return { countryCode: '1', national: digits.slice(0, 10) }
    }
  }

  // International: 1 and 7 are single-digit codes; otherwise prefer 2-digit
  if (digits.startsWith('7') && (hasPlus || digits.length > 11)) {
    return { countryCode: '7', national: digits.slice(1) }
  }
  if (digits.length <= 3 && hasPlus) {
    return { countryCode: digits, national: '' }
  }
  const codeLen = digits.length > 11 ? 2 : Math.min(2, digits.length)
  return {
    countryCode: digits.slice(0, codeLen) || '1',
    national: digits.slice(codeLen),
  }
}

/** Combine country code + national into one value for form state / API (`+CC…`). Empty national → ''. */
export function combinePhone(countryCode: string, national: string): string {
  const code = digitsOnly(countryCode) || '1'
  const nat = digitsOnly(national)
  if (!nat) return ''
  return `+${code}${nat}`
}

/** Format national digits for the number box (US mask when country is 1). */
export function formatNationalInput(countryCode: string, national: string): string {
  const code = digitsOnly(countryCode) || '1'
  const nat = digitsOnly(national)
  if (!nat) return ''
  if (code === '1') {
    let result = ''
    if (nat.length > 0) result += '(' + nat.slice(0, 3)
    if (nat.length >= 3) result += ')'
    if (nat.length > 3) result += '-' + nat.slice(3, 6)
    if (nat.length > 6) result += '-' + nat.slice(6, 10)
    return result
  }
  return nat
}

/** Max national digits given a country code (E.164 total ≤ 15). */
export function maxNationalDigits(countryCode: string): number {
  const code = digitsOnly(countryCode) || '1'
  if (code === '1') return 10
  return Math.max(1, E164_MAX_DIGITS - code.length)
}

function nationalDigits(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (!digits) return ''
  return digits.startsWith('1') ? digits.slice(1) : digits
}

/** US display with country code: +1 (234)-567-8912 */
export function formatPhone(value: string): string {
  const num = nationalDigits(value)
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
  const num = nationalDigits(value)
  if (!num) return ''
  let result = ''
  if (num.length > 0) result += '(' + num.slice(0, 3)
  if (num.length >= 3) result += ')'
  if (num.length > 3) result += '-' + num.slice(3, 6)
  if (num.length > 6) result += '-' + num.slice(6, 10)
  return result
}

/** Strip non-digits; cap length while typing (default 11 for +1 paste). */
export function phoneDigitsOnly(value: string, maxLen = 11): string {
  return value.replace(/\D/g, '').slice(0, maxLen)
}

/** Match server generateUserName: 10-digit national number for DB lookup. */
export function phoneToLoginUserName(value: string): string {
  const digits = value.replace(/\D/g, '')
  return digits.startsWith('1') && digits.length === 11 ? digits.slice(1) : digits
}

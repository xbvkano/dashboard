export function normalizePhone(num: string): string | null {
  const digits = num.replace(/\D/g, '')
  if (digits.length === 10) return '1' + digits
  if (digits.length === 11) return digits
  return null
}

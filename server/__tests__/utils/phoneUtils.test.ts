import { normalizePhone } from '../../src/utils/phoneUtils'

describe('phoneUtils', () => {
  describe('normalizePhone', () => {
    it('adds 1 prefix for 10-digit number', () => {
      expect(normalizePhone('5551234567')).toBe('15551234567')
    })

    it('keeps 11-digit number with leading 1 as-is', () => {
      expect(normalizePhone('15551234567')).toBe('15551234567')
    })

    it('strips non-digit characters', () => {
      expect(normalizePhone('(555) 123-4567')).toBe('15551234567')
      expect(normalizePhone('555-123-4567')).toBe('15551234567')
      expect(normalizePhone('+1 555.123.4567')).toBe('15551234567')
    })

    it('returns null for 9 digits', () => {
      expect(normalizePhone('555123456')).toBeNull()
    })

    it('returns null for 12+ digits', () => {
      expect(normalizePhone('155512345678')).toBeNull()
    })

    it('returns null for empty string', () => {
      expect(normalizePhone('')).toBeNull()
    })

    it('returns any 11-digit number as-is', () => {
      expect(normalizePhone('25551234567')).toBe('25551234567')
    })
  })
})

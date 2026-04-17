import {
  normalizePhone,
  phoneLookupVariants,
  phoneNumbersMatchForLinking,
  supervisorPhoneE164,
} from '../../src/utils/phoneUtils'

describe('phoneUtils', () => {
  describe('normalizePhone', () => {
    it('adds +1 prefix for 10-digit number', () => {
      expect(normalizePhone('5551234567')).toBe('+15551234567')
    })

    it('normalizes 11-digit number with leading 1 to E.164', () => {
      expect(normalizePhone('15551234567')).toBe('+15551234567')
    })

    it('strips non-digit characters', () => {
      expect(normalizePhone('(555) 123-4567')).toBe('+15551234567')
      expect(normalizePhone('555-123-4567')).toBe('+15551234567')
      expect(normalizePhone('+1 555.123.4567')).toBe('+15551234567')
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

    it('returns null for 11-digit numbers that are not US (+1)', () => {
      expect(normalizePhone('25551234567')).toBeNull()
    })
  })

  describe('phoneLookupVariants', () => {
    it('includes E.164 and digit-only forms', () => {
      const v = phoneLookupVariants('+15551234567')
      expect(v).toContain('+15551234567')
      expect(v).toContain('15551234567')
      expect(v).toContain('5551234567')
    })
  })

  describe('phoneNumbersMatchForLinking', () => {
    it('matches E.164, 10-digit, and formatted variants for the same NANP line', () => {
      expect(phoneNumbersMatchForLinking('+15551234567', '(555) 123-4567')).toBe(true)
      expect(phoneNumbersMatchForLinking('5551234567', '+1 555 123 4567')).toBe(true)
      expect(phoneNumbersMatchForLinking('15551234567', '+15551234567')).toBe(true)
    })

    it('does not match different lines', () => {
      expect(phoneNumbersMatchForLinking('+15551234567', '+16145842138')).toBe(false)
    })
  })

  describe('supervisorPhoneE164', () => {
    it('uses employee number when present', () => {
      expect(
        supervisorPhoneE164({
          userName: 'ignored',
          employee: { number: '(725) 577-4524' },
        })
      ).toBe('+17255774524')
    })

    it('falls back to userName digits', () => {
      expect(supervisorPhoneE164({ userName: '7255774523', employee: null })).toBe('+17255774523')
    })
  })
})

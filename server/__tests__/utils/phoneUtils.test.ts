import {
  normalizePhone,
  generateUserName,
  loginUserNameFromInput,
  loginUserNameCandidates,
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

    it('returns null for empty string', () => {
      expect(normalizePhone('')).toBeNull()
    })

    it('accepts international E.164 with + prefix', () => {
      expect(normalizePhone('+61 433 441 476')).toBe('+61433441476')
    })

    it('accepts international digits without + prefix', () => {
      expect(normalizePhone('61433441476')).toBe('+61433441476')
    })

    it('accepts other international country codes', () => {
      expect(normalizePhone('+44 7911 123456')).toBe('+447911123456')
    })

    it('returns null for too few digits', () => {
      expect(normalizePhone('+6112345')).toBeNull()
    })

    it('returns null for too many digits', () => {
      expect(normalizePhone('+6112345678901234')).toBeNull()
    })
  })

  describe('generateUserName', () => {
    it('stores 10-digit national for US numbers', () => {
      expect(generateUserName('+17255774523')).toBe('7255774523')
    })

    it('stores full digits for international numbers', () => {
      expect(generateUserName('+61433441476')).toBe('61433441476')
    })
  })

  describe('loginUserNameFromInput', () => {
    it('normalizes US numbers to 10 digits', () => {
      expect(loginUserNameFromInput('+1 (725) 577-4523')).toBe('7255774523')
    })

    it('keeps international digits', () => {
      expect(loginUserNameFromInput('+61 433 441 476')).toBe('61433441476')
    })
  })

  describe('loginUserNameCandidates', () => {
    it('includes US legacy variants', () => {
      const c = loginUserNameCandidates('17255774523')
      expect(c).toContain('7255774523')
      expect(c).toContain('17255774523')
    })

    it('includes international digits', () => {
      expect(loginUserNameCandidates('+61433441476')).toContain('61433441476')
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

    it('matches identical international numbers', () => {
      expect(phoneNumbersMatchForLinking('+61433441476', '61433441476')).toBe(true)
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

    it('normalizes international employee numbers', () => {
      expect(
        supervisorPhoneE164({
          userName: 'ignored',
          employee: { number: '+61433441476' },
        })
      ).toBe('+61433441476')
    })
  })
})

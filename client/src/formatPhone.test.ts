import { describe, expect, it } from 'vitest'
import {
  formatPhone,
  formatPhoneNational,
  phoneDigitsOnly,
  phoneHasMinDigits,
  phoneToApiPayload,
  phoneToLoginUserName,
} from './formatPhone'

describe('formatPhone', () => {
  it('formats 10-digit US number', () => {
    expect(formatPhone('7025550199')).toBe('+1 (702)-555-0199')
  })

  it('formats E164 number', () => {
    expect(formatPhone('+17025550199')).toBe('+1 (702)-555-0199')
  })

  it('formats pasted display string', () => {
    expect(formatPhone('+1 (702)-555-0199')).toBe('+1 (702)-555-0199')
  })

  it('handles partial digits while typing', () => {
    expect(formatPhone('702')).toBe('+1 (702)')
    expect(formatPhone('702555')).toBe('+1 (702)-555')
  })

  it('returns empty for empty input', () => {
    expect(formatPhone('')).toBe('')
    expect(formatPhone('abc')).toBe('')
  })

  it('formats international numbers with + prefix', () => {
    expect(formatPhone('+61433441476')).toBe('+61433441476')
    expect(formatPhone('+61 433 441 476')).toBe('+61433441476')
  })
})

describe('formatPhoneNational', () => {
  it('formats without country code', () => {
    expect(formatPhoneNational('7025550199')).toBe('(702)-555-0199')
    expect(formatPhoneNational('+17025550199')).toBe('(702)-555-0199')
  })

  it('handles partial digits while typing', () => {
    expect(formatPhoneNational('702')).toBe('(702)')
    expect(formatPhoneNational('702555')).toBe('(702)-555')
  })

  it('returns empty for empty input', () => {
    expect(formatPhoneNational('')).toBe('')
  })

  it('shows international numbers with country code', () => {
    expect(formatPhoneNational('+61433441476')).toBe('+61433441476')
  })
})

describe('phoneDigitsOnly', () => {
  it('strips non-digits', () => {
    expect(phoneDigitsOnly('+1 (234)-567-8912')).toBe('+12345678912')
  })

  it('caps at 15 digits', () => {
    expect(phoneDigitsOnly('123456789123456789')).toBe('123456789123456')
  })

  it('preserves leading + for international input', () => {
    expect(phoneDigitsOnly('+61433441476')).toBe('+61433441476')
  })
})

describe('phoneToLoginUserName', () => {
  it('normalizes formatted paste to 10 digits for US', () => {
    expect(phoneToLoginUserName('+1 (234)-567-8912')).toBe('2345678912')
  })

  it('strips leading 1 from 11-digit US input', () => {
    expect(phoneToLoginUserName('12345678912')).toBe('2345678912')
  })

  it('keeps 10-digit input', () => {
    expect(phoneToLoginUserName('7025550199')).toBe('7025550199')
  })

  it('keeps international digits', () => {
    expect(phoneToLoginUserName('+61 433 441 476')).toBe('61433441476')
  })
})

describe('phoneToApiPayload', () => {
  it('adds + for international numbers without prefix', () => {
    expect(phoneToApiPayload('61433441476')).toBe('+61433441476')
  })

  it('keeps US 10-digit as digits for server normalization', () => {
    expect(phoneToApiPayload('7255774523')).toBe('7255774523')
  })
})

describe('phoneHasMinDigits', () => {
  it('requires at least 8 digits', () => {
    expect(phoneHasMinDigits('+61433441476')).toBe(true)
    expect(phoneHasMinDigits('1234567')).toBe(false)
  })
})

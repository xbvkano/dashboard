import { describe, expect, it } from 'vitest'
import { formatPhone, formatPhoneNational, phoneDigitsOnly, phoneToLoginUserName } from './formatPhone'

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
})

describe('phoneDigitsOnly', () => {
  it('strips non-digits', () => {
    expect(phoneDigitsOnly('+1 (234)-567-8912')).toBe('12345678912')
  })

  it('caps at 11 digits', () => {
    expect(phoneDigitsOnly('12345678912345')).toBe('12345678912')
  })
})

describe('phoneToLoginUserName', () => {
  it('normalizes formatted paste to 10 digits', () => {
    expect(phoneToLoginUserName('+1 (234)-567-8912')).toBe('2345678912')
  })

  it('strips leading 1 from 11-digit input', () => {
    expect(phoneToLoginUserName('12345678912')).toBe('2345678912')
  })

  it('keeps 10-digit input', () => {
    expect(phoneToLoginUserName('7025550199')).toBe('7025550199')
  })
})

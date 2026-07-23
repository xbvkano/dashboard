import { describe, expect, it } from 'vitest'
import {
  combinePhone,
  formatNationalInput,
  formatPhone,
  formatPhoneNational,
  maxNationalDigits,
  phoneDigitsOnly,
  phoneHasMinDigits,
  phoneToApiPayload,
  phoneToLoginUserName,
  splitPhone,
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

describe('splitPhone', () => {
  it('defaults empty to +1', () => {
    expect(splitPhone('')).toEqual({ countryCode: '1', national: '' })
  })

  it('splits 10-digit US as +1', () => {
    expect(splitPhone('7025550199')).toEqual({ countryCode: '1', national: '7025550199' })
  })

  it('splits E164 US and 11-digit US', () => {
    expect(splitPhone('+17025550199')).toEqual({ countryCode: '1', national: '7025550199' })
    expect(splitPhone('17025550199')).toEqual({ countryCode: '1', national: '7025550199' })
  })

  it('splits international E164', () => {
    expect(splitPhone('+61433441476')).toEqual({ countryCode: '61', national: '433441476' })
  })

  it('handles partial US digits while typing', () => {
    expect(splitPhone('702')).toEqual({ countryCode: '1', national: '702' })
    expect(splitPhone('+1702')).toEqual({ countryCode: '1', national: '702' })
  })
})

describe('combinePhone', () => {
  it('returns empty when national is empty', () => {
    expect(combinePhone('1', '')).toBe('')
    expect(combinePhone('61', '')).toBe('')
  })

  it('combines US and intl with + prefix', () => {
    expect(combinePhone('1', '7025550199')).toBe('+17025550199')
    expect(combinePhone('61', '433441476')).toBe('+61433441476')
  })

  it('defaults blank country code to 1', () => {
    expect(combinePhone('', '7025550199')).toBe('+17025550199')
  })

  it('round-trips with splitPhone for US and intl', () => {
    const us = combinePhone('1', '7025550199')
    expect(splitPhone(us)).toEqual({ countryCode: '1', national: '7025550199' })
    const au = combinePhone('61', '433441476')
    expect(splitPhone(au)).toEqual({ countryCode: '61', national: '433441476' })
  })
})

describe('formatNationalInput', () => {
  it('applies US mask for country 1 without injecting country digits into the value', () => {
    expect(formatNationalInput('1', '7')).toBe('(7')
    expect(formatNationalInput('1', '70')).toBe('(70')
    expect(formatNationalInput('1', '702')).toBe('(702)')
    expect(formatNationalInput('1', '7024')).toBe('(702)-4')
    expect(formatNationalInput('1', '7024667306')).toBe('(702)-466-7306')
  })

  it('does not accumulate leading 1s when formatting national-only digits', () => {
    let national = ''
    for (const d of '7024667306') {
      national = (national + d).replace(/\D/g, '').slice(0, 10)
      const display = formatNationalInput('1', national)
      // Re-extract from display only (national field) — must equal national, not prepend country 1
      expect(display.replace(/\D/g, '')).toBe(national)
    }
    expect(combinePhone('1', national)).toBe('+17024667306')
  })

  it('shows plain digits for non-US country codes', () => {
    expect(formatNationalInput('61', '433441476')).toBe('433441476')
  })
})

describe('maxNationalDigits', () => {
  it('caps US at 10 and intl by remaining E.164 budget', () => {
    expect(maxNationalDigits('1')).toBe(10)
    expect(maxNationalDigits('61')).toBe(13)
  })
})

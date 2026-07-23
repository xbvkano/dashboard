import {
  SERVICE_STATUS_BUBBLE_COLOR,
  SERVICE_STATUS_SMS_BODIES,
  isServiceStatusKind,
} from '../../src/constants/serviceStatus'

describe('serviceStatus constants', () => {
  it('uses purple bubble color hex', () => {
    expect(SERVICE_STATUS_BUBBLE_COLOR).toMatch(/^#[0-9A-Fa-f]{6}$/)
    expect(SERVICE_STATUS_BUBBLE_COLOR.toUpperCase()).toBe('#7C3AED')
  })

  it('defines generic SMS bodies without employee names', () => {
    expect(SERVICE_STATUS_SMS_BODIES.ON_THE_WAY).toMatch(/on the way/i)
    expect(SERVICE_STATUS_SMS_BODIES.ON_THE_WAY).not.toMatch(/Maria|Ana|\$\{/)
    expect(SERVICE_STATUS_SMS_BODIES.THIRTY_MINUTES_LEFT).toMatch(/30 minutes/i)
    expect(SERVICE_STATUS_SMS_BODIES.THIRTY_MINUTES_LEFT).not.toMatch(/Maria|Ana|\$\{/)
    expect(SERVICE_STATUS_SMS_BODIES.ARRIVED).toBeUndefined()
  })

  it('accepts valid kinds and rejects invalid', () => {
    expect(isServiceStatusKind('ON_THE_WAY')).toBe(true)
    expect(isServiceStatusKind('ARRIVED')).toBe(true)
    expect(isServiceStatusKind('THIRTY_MINUTES_LEFT')).toBe(true)
    expect(isServiceStatusKind('')).toBe(false)
    expect(isServiceStatusKind('on_the_way')).toBe(false)
    expect(isServiceStatusKind('BOGUS')).toBe(false)
  })
})

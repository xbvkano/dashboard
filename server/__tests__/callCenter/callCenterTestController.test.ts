import {
  expectedDialCallerId,
  listCallCenterTestPresets,
} from '../../src/controllers/callCenterTestController'

describe('callCenterTestController helpers', () => {
  it('OWNER dials show original caller ID', () => {
    expect(expectedDialCallerId('OWNER', '+15551112222', '+17025550000')).toBe('+15551112222')
  })

  it('ADMIN / SUPERVISOR / null use Twilio admin number', () => {
    expect(expectedDialCallerId('ADMIN', '+15551112222', '+17025550000')).toBe('+17025550000')
    expect(expectedDialCallerId('SUPERVISOR', '+15551112222', '+17025550000')).toBe('+17025550000')
    expect(expectedDialCallerId(null, '+15551112222', '+17025550000')).toBe('+17025550000')
  })

  it('exposes privileged, on-duty, and voice presets', () => {
    const ids = listCallCenterTestPresets().map((p) => p.id)
    expect(ids).toEqual(
      expect.arrayContaining([
        'privileged-caller',
        'customer-caller',
        'on-duty-now',
        'by-code',
        'voice-privileged',
        'voice-customer',
      ])
    )
  })
})

import { isAppointmentInPast } from '../../src/utils/appointmentPast'

describe('isAppointmentInPast', () => {
  const LA = 'America/Los_Angeles'

  it('treats earlier today as past (LA timezone)', () => {
    const appt = {
      // Local business day 2026-04-14
      dateUtc: new Date('2026-04-14T07:00:00.000Z'),
      date: new Date('2026-04-14T07:00:00.000Z'),
      time: '09:00',
    }
    // 11:00 LA on the same day (18:00Z) -> appointment at 09:00 LA is in the past
    const now = new Date('2026-04-14T18:00:00.000Z')
    expect(isAppointmentInPast(appt, now, LA)).toBe(true)
  })

  it('treats later today as not past (LA timezone)', () => {
    const appt = {
      dateUtc: new Date('2026-04-14T07:00:00.000Z'),
      date: new Date('2026-04-14T07:00:00.000Z'),
      time: '16:00',
    }
    // 11:00 LA -> appointment at 16:00 LA is still in the future
    const now = new Date('2026-04-14T18:00:00.000Z')
    expect(isAppointmentInPast(appt, now, LA)).toBe(false)
  })
})


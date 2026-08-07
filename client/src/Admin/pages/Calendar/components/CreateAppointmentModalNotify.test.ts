import { describe, expect, it } from 'vitest'
import {
  buildAppointmentEditNotice,
  hasEmployeeNotifiableAppointmentChanges,
  isAppointmentBeforeBusinessToday,
} from './CreateAppointmentModalNotify'

describe('isAppointmentBeforeBusinessToday', () => {
  it('returns false for today even when the slot time is earlier than now', () => {
    // Fixed "now" is afternoon Aug 3, 2026 Pacific
    const now = new Date('2026-08-03T21:00:00.000Z')
    expect(
      isAppointmentBeforeBusinessToday(
        { localDate: '2026-08-03', time: '08:00' },
        now,
      ),
    ).toBe(false)
  })

  it('returns true for a prior calendar day', () => {
    const now = new Date('2026-08-03T21:00:00.000Z')
    expect(
      isAppointmentBeforeBusinessToday(
        { localDate: '2026-08-02', time: '18:00' },
        now,
      ),
    ).toBe(true)
  })

  it('returns false for a future calendar day', () => {
    const now = new Date('2026-08-03T21:00:00.000Z')
    expect(
      isAppointmentBeforeBusinessToday(
        { localDate: '2026-08-04', time: '09:00' },
        now,
      ),
    ).toBe(false)
  })
})

describe('hasEmployeeNotifiableAppointmentChanges', () => {
  const base = {
    address: '100 Main St',
    instructions: 'Gate 1',
    date: '2026-08-03',
    time: '09:00',
  }

  it('is true for address, instructions, date, or time changes', () => {
    expect(
      hasEmployeeNotifiableAppointmentChanges({
        previous: base,
        current: { ...base, address: '200 Oak' },
      }),
    ).toBe(true)
    expect(
      hasEmployeeNotifiableAppointmentChanges({
        previous: base,
        current: { ...base, time: '14:00' },
      }),
    ).toBe(true)
  })

  it('is false when logistics fields are unchanged', () => {
    expect(
      hasEmployeeNotifiableAppointmentChanges({
        previous: base,
        current: { ...base },
      }),
    ).toBe(false)
  })
})

describe('buildAppointmentEditNotice', () => {
  const base = {
    address: '100 Main St',
    instructions: 'Gate 1',
    date: '2026-08-03',
    time: '09:00',
  }

  it('includes only changed logistics lines', () => {
    const text = buildAppointmentEditNotice({
      previous: base,
      current: { ...base, instructions: 'Gate 2', time: '10:00' },
    })
    expect(text).toContain('Appointment Edit Notice')
    expect(text).toContain('Address: 100 Main St')
    expect(text).toContain('Instructions updated: Gate 2')
    expect(text).toContain('Time updated: 10:00')
    expect(text).not.toContain('Address updated:')
    expect(text).not.toContain('Date updated:')
  })
})

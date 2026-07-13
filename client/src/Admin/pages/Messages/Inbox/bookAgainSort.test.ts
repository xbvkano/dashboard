import { describe, expect, it } from 'vitest'
import type { ClientAppointment } from './messagingApi'
import {
  clientAppointmentChronoKey,
  sortClientAppointmentsNewestFirst,
} from './bookAgainSort'

function appt(partial: Partial<ClientAppointment> & Pick<ClientAppointment, 'id' | 'date' | 'time'>): ClientAppointment {
  return {
    address: null,
    type: 'STANDARD',
    size: null,
    price: 0,
    notes: null,
    ...partial,
  }
}

describe('sortClientAppointmentsNewestFirst', () => {
  it('puts the latest date/time first', () => {
    const sorted = sortClientAppointmentsNewestFirst([
      appt({ id: 1, date: '2026-01-10T08:00:00.000Z', time: '09:00' }),
      appt({ id: 2, localDate: '2026-03-15', date: '2026-03-15T07:00:00.000Z', time: '14:00' }),
      appt({ id: 3, localDate: '2026-03-15', date: '2026-03-15T07:00:00.000Z', time: '08:00' }),
      appt({ id: 4, localDate: '2025-12-01', date: '2025-12-01', time: '10:00' }),
    ])
    expect(sorted.map((a) => a.id)).toEqual([2, 3, 1, 4])
  })

  it('prefers localDate over raw date when building the key', () => {
    expect(
      clientAppointmentChronoKey(
        appt({ id: 1, localDate: '2026-07-13', date: '2026-07-14T00:00:00.000Z', time: '10:30' }),
      ),
    ).toBe('2026-07-13T10:30')
  })
})

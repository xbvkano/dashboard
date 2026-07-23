import {
  getAppointmentServiceWindow,
  getAppointmentActionWindow,
  isWithinAppointmentServiceWindow,
  listActiveAppointments,
  pickActiveAppointment,
  SERVICE_STATUS_EARLY_MINUTES,
} from '../../src/utils/serviceStatusWindow'

describe('serviceStatusWindow', () => {
  const LA = 'America/Los_Angeles'

  describe('getAppointmentServiceWindow', () => {
    it('builds start from local date + time and end from hours', () => {
      const { start, end } = getAppointmentServiceWindow(
        {
          dateUtc: new Date('2026-04-14T07:00:00.000Z'), // Apr 14 LA
          date: new Date('2026-04-14T07:00:00.000Z'),
          time: '09:00',
          hours: 3,
          size: null,
          type: 'STANDARD',
        },
        LA,
      )
      // 09:00 LA = 16:00Z on PDT
      expect(start.toISOString()).toBe('2026-04-14T16:00:00.000Z')
      expect(end.toISOString()).toBe('2026-04-14T19:00:00.000Z')
    })

    it('falls back to calculated hours when hours is null', () => {
      const { start, end } = getAppointmentServiceWindow(
        {
          dateUtc: new Date('2026-04-14T07:00:00.000Z'),
          date: new Date('2026-04-14T07:00:00.000Z'),
          time: '10:00',
          hours: null,
          size: '0-1000',
          type: 'STANDARD',
        },
        LA,
      )
      // 0-1000 STANDARD → 3 hours
      expect(end.getTime() - start.getTime()).toBe(3 * 60 * 60 * 1000)
    })
  })

  describe('getAppointmentActionWindow', () => {
    it(`starts ${SERVICE_STATUS_EARLY_MINUTES} minutes before appointment start`, () => {
      const job = getAppointmentServiceWindow(
        {
          dateUtc: new Date('2026-04-14T07:00:00.000Z'),
          date: new Date('2026-04-14T07:00:00.000Z'),
          time: '09:00',
          hours: 3,
          size: null,
          type: 'STANDARD',
        },
        LA,
      )
      const action = getAppointmentActionWindow(
        {
          dateUtc: new Date('2026-04-14T07:00:00.000Z'),
          date: new Date('2026-04-14T07:00:00.000Z'),
          time: '09:00',
          hours: 3,
          size: null,
          type: 'STANDARD',
        },
        LA,
      )
      expect(action.start.toISOString()).toBe('2026-04-14T15:00:00.000Z') // 08:00 LA
      expect(action.end.toISOString()).toBe(job.end.toISOString())
      expect(action.start.getTime()).toBe(job.start.getTime() - SERVICE_STATUS_EARLY_MINUTES * 60 * 1000)
    })
  })

  describe('isWithinAppointmentServiceWindow', () => {
    const appt = {
      dateUtc: new Date('2026-04-14T07:00:00.000Z'),
      date: new Date('2026-04-14T07:00:00.000Z'),
      time: '09:00',
      hours: 3,
      size: null as string | null,
      type: 'STANDARD' as const,
    }

    it('returns true when now is at appointment start', () => {
      expect(isWithinAppointmentServiceWindow(appt, new Date('2026-04-14T16:00:00.000Z'), LA)).toBe(
        true,
      )
    })

    it('returns true one hour before start (early On the way window)', () => {
      expect(isWithinAppointmentServiceWindow(appt, new Date('2026-04-14T15:00:00.000Z'), LA)).toBe(
        true,
      )
    })

    it('returns true when now is mid-window', () => {
      expect(isWithinAppointmentServiceWindow(appt, new Date('2026-04-14T17:30:00.000Z'), LA)).toBe(
        true,
      )
    })

    it('returns false when now is more than one hour before start', () => {
      expect(isWithinAppointmentServiceWindow(appt, new Date('2026-04-14T14:59:00.000Z'), LA)).toBe(
        false,
      )
    })

    it('returns false when now is at or after end (half-open)', () => {
      expect(isWithinAppointmentServiceWindow(appt, new Date('2026-04-14T19:00:00.000Z'), LA)).toBe(
        false,
      )
    })
  })

  describe('listActiveAppointments / pickActiveAppointment', () => {
    it('returns all overlapping in-window appointments sorted by start', () => {
      const a = {
        id: 1,
        address: '123 Main St',
        dateUtc: new Date('2026-04-14T07:00:00.000Z'),
        date: new Date('2026-04-14T07:00:00.000Z'),
        time: '09:00',
        hours: 4,
        size: null as string | null,
        type: 'STANDARD' as const,
        status: 'APPOINTED' as const,
      }
      const b = {
        id: 2,
        address: '456 Oak Ave',
        dateUtc: new Date('2026-04-14T07:00:00.000Z'),
        date: new Date('2026-04-14T07:00:00.000Z'),
        time: '10:00',
        hours: 3,
        size: null as string | null,
        type: 'STANDARD' as const,
        status: 'APPOINTED' as const,
      }
      // 10:30 LA = 17:30Z — both still active
      const listed = listActiveAppointments([b, a], new Date('2026-04-14T17:30:00.000Z'), LA)
      expect(listed.map((x) => x.id)).toEqual([1, 2])
      expect(pickActiveAppointment([b, a], new Date('2026-04-14T17:30:00.000Z'), LA)?.id).toBe(1)
    })

    it('includes job that has not started yet but is within early window', () => {
      const appt = {
        id: 5,
        dateUtc: new Date('2026-04-14T07:00:00.000Z'),
        date: new Date('2026-04-14T07:00:00.000Z'),
        time: '09:00',
        hours: 3,
        size: null as string | null,
        type: 'STANDARD' as const,
        status: 'APPOINTED' as const,
      }
      // 08:30 LA = 15:30Z
      expect(listActiveAppointments([appt], new Date('2026-04-14T15:30:00.000Z'), LA).map((x) => x.id)).toEqual([
        5,
      ])
    })

    it('skips cancelled / deleted / reschedule_old', () => {
      const cancelled = {
        id: 9,
        dateUtc: new Date('2026-04-14T07:00:00.000Z'),
        date: new Date('2026-04-14T07:00:00.000Z'),
        time: '09:00',
        hours: 3,
        size: null as string | null,
        type: 'STANDARD' as const,
        status: 'CANCEL' as const,
      }
      expect(pickActiveAppointment([cancelled], new Date('2026-04-14T17:00:00.000Z'), LA)).toBeNull()
      expect(listActiveAppointments([cancelled], new Date('2026-04-14T17:00:00.000Z'), LA)).toEqual([])
    })

    it('returns empty when none are in window', () => {
      const appt = {
        id: 3,
        dateUtc: new Date('2026-04-14T07:00:00.000Z'),
        date: new Date('2026-04-14T07:00:00.000Z'),
        time: '09:00',
        hours: 2,
        size: null as string | null,
        type: 'STANDARD' as const,
        status: 'APPOINTED' as const,
      }
      expect(pickActiveAppointment([appt], new Date('2026-04-14T20:00:00.000Z'), LA)).toBeNull()
      expect(listActiveAppointments([appt], new Date('2026-04-14T20:00:00.000Z'), LA)).toEqual([])
    })
  })
})

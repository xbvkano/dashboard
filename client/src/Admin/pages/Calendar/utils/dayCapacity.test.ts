import { describe, expect, it } from 'vitest'
import type { Appointment } from '../types'
import {
  buildDayCapacity,
  buildShiftSummary,
  getShiftFromTime,
  isActiveDayAppointment,
} from './dayCapacity'
import { matchTemplateForAppointment } from './matchTemplateForAppointment'

function appt(partial: Partial<Appointment> & Pick<Appointment, 'time' | 'clientId'>): Appointment {
  return {
    date: '2026-07-14',
    localDate: '2026-07-14',
    type: 'STANDARD',
    address: '1 Main',
    status: 'APPOINTED',
    teamSize: 2,
    ...partial,
  }
}

describe('getShiftFromTime', () => {
  it('treats times before 14:00 as AM', () => {
    expect(getShiftFromTime('09:00')).toBe('AM')
    expect(getShiftFromTime('13:59')).toBe('AM')
  })

  it('treats 14:00 and later as PM', () => {
    expect(getShiftFromTime('14:00')).toBe('PM')
    expect(getShiftFromTime('18:30')).toBe('PM')
  })

  it('returns null for malformed times', () => {
    expect(getShiftFromTime('')).toBeNull()
    expect(getShiftFromTime('abc')).toBeNull()
    expect(getShiftFromTime('25:00')).toBeNull()
    expect(getShiftFromTime(undefined)).toBeNull()
  })
})

describe('isActiveDayAppointment', () => {
  it('excludes canceled and reschedule-old statuses', () => {
    expect(isActiveDayAppointment({ status: 'CANCEL' })).toBe(false)
    expect(isActiveDayAppointment({ status: 'DELETED' })).toBe(false)
    expect(isActiveDayAppointment({ status: 'RESCHEDULE_OLD' })).toBe(false)
    expect(isActiveDayAppointment({ status: 'APPOINTED' })).toBe(true)
  })
})

describe('buildShiftSummary', () => {
  it('sums team required, excludes canceled, and subtracts scheduled from available', () => {
    const appointments = [
      appt({
        id: 1,
        time: '09:00',
        clientId: 10,
        teamSize: 3,
        client: { id: 10, name: 'Alice', number: '1', from: '', notes: '' },
        employees: [{ id: 1, name: 'Sam', number: '1' }],
      }),
      appt({
        id: 2,
        time: '10:00',
        clientId: 11,
        teamSize: 2,
        client: { id: 11, name: 'Bob', number: '1', from: '', notes: '' },
        employees: [{ id: 2, name: 'Pat', number: '1' }],
        status: 'CANCEL',
      }),
      appt({
        id: 3,
        time: '11:00',
        clientId: 12,
        teamSize: 1,
        client: { id: 12, name: 'Cara', number: '1', from: '', notes: '' },
        employees: [{ id: 1, name: 'Sam', number: '1' }],
      }),
    ]

    const summary = buildShiftSummary('AM', appointments, [
      { id: 1, name: 'Sam', available: true },
      { id: 2, name: 'Pat', available: true },
      { id: 3, name: 'Lee', available: true },
      { id: 4, name: 'Unavailable', available: false },
    ])

    expect(summary.appointmentCount).toBe(2)
    expect(summary.teamRequired).toBe(4)
    expect(summary.scheduledCount).toBe(1)
    expect(summary.scheduledEmployees[0].clients).toEqual(['Alice', 'Cara'])
    expect(summary.availableCount).toBe(2)
    expect(summary.availableEmployees.map((e) => e.name).sort()).toEqual(['Lee', 'Pat'])
    expect(summary.shortfall).toBe(3)
    expect(summary.demand.map((d) => `${d.clientName}:${d.teamSize}`)).toEqual([
      'Alice:3',
      'Cara:1',
    ])
  })

  it('ignores canceled demand and keeps PM appointments separate', () => {
    const appointments = [
      appt({ id: 1, time: '09:00', clientId: 1, teamSize: 2 }),
      appt({ id: 2, time: '15:00', clientId: 2, teamSize: 4, client: { id: 2, name: 'Dana', number: '1', from: '', notes: '' } }),
    ]
    const day = buildDayCapacity(appointments, [{ id: 9, name: 'Ava', available: true }], [])
    expect(day.am.teamRequired).toBe(2)
    expect(day.pm.teamRequired).toBe(4)
    expect(day.pm.demand[0].clientName).toBe('Dana')
    expect(day.am.availableCount).toBe(1)
    expect(day.pm.availableCount).toBe(0)
  })
})

describe('matchTemplateForAppointment', () => {
  const templates = [
    {
      id: 5,
      templateName: 'Home',
      type: 'STANDARD' as const,
      size: '1500-2000',
      address: '1 Main',
      price: 200,
      clientId: 1,
    },
    {
      id: 6,
      templateName: 'Deep',
      type: 'DEEP' as const,
      size: '1500-2000',
      address: '1 Main',
      price: 300,
      clientId: 1,
    },
  ]

  it('prefers templateId when present', () => {
    expect(matchTemplateForAppointment(templates, { templateId: 6 })?.id).toBe(6)
  })

  it('falls back to address/type/size', () => {
    expect(
      matchTemplateForAppointment(templates, {
        address: '1 Main',
        type: 'STANDARD',
        size: '1500-2000',
      })?.id,
    ).toBe(5)
  })
})

import {
  appointmentCalendarDateKey,
  APPOINTMENT_BUSINESS_TIME_ZONE,
} from '../types'

/** True when the appointment's business calendar day is strictly before today (LA). Today is notifiable. */
export function isAppointmentBeforeBusinessToday(
  appt: {
    localDate?: string | null
    date?: string | Date
    dateUtc?: string | Date | null
    time?: string
  },
  now: Date = new Date(),
): boolean {
  const dateKey = appointmentCalendarDateKey(appt)
  if (!dateKey) return false
  const today = now.toLocaleDateString('en-CA', { timeZone: APPOINTMENT_BUSINESS_TIME_ZONE })
  return dateKey < today
}

export type AppointmentEditPreviousPayload = {
  address: string
  instructions?: string | null
  date: string
  time: string
}

function normText(value: string | null | undefined): string {
  return (value ?? '').trim()
}

function sameText(a: string | null | undefined, b: string | null | undefined): boolean {
  return normText(a) === normText(b)
}

/**
 * Employee Upcoming Jobs shows address, instructions, date, and time (among logistics fields).
 * Only these changes warrant the notify-team modal / edit-notice SMS.
 */
export function hasEmployeeNotifiableAppointmentChanges(params: {
  previous: AppointmentEditPreviousPayload
  current: AppointmentEditPreviousPayload
}): boolean {
  const { previous, current } = params
  return (
    !sameText(previous.address, current.address) ||
    !sameText(previous.instructions, current.instructions) ||
    !sameText(previous.date, current.date) ||
    !sameText(previous.time, current.time)
  )
}

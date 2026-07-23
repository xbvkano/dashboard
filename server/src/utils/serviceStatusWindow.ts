import { DateTime } from 'luxon'
import { calculateAppointmentHours } from './appointmentUtils'
import { appointmentLocalDateKey, DEFAULT_APPOINTMENT_TIMEZONE } from './appointmentTimezone'

/** How early employees can see the green card / tap On the way before start. */
export const SERVICE_STATUS_EARLY_MINUTES = 60

export type ServiceWindowAppointment = {
  dateUtc: Date | null
  date: Date
  time: string
  hours: number | null
  size: string | null
  type: string
}

const EXCLUDED_STATUSES = new Set(['RESCHEDULE_OLD', 'DELETED', 'CANCEL'])

function parseHoursMinutes(time: string): { hour: number; minute: number } {
  const [h, m] = time.split(':').map((s) => parseInt(s, 10))
  return { hour: Number.isFinite(h) ? h : 0, minute: Number.isFinite(m) ? m : 0 }
}

/** Actual appointment start → end (job duration). */
export function getAppointmentServiceWindow(
  appt: ServiceWindowAppointment,
  zone: string = DEFAULT_APPOINTMENT_TIMEZONE,
): { start: Date; end: Date } {
  const localDay = appointmentLocalDateKey({ dateUtc: appt.dateUtc, date: appt.date }, zone)
  const { hour, minute } = parseHoursMinutes(appt.time)
  const startDt = DateTime.fromISO(localDay, { zone }).set({
    hour,
    minute,
    second: 0,
    millisecond: 0,
  })
  const hours =
    appt.hours != null && appt.hours > 0
      ? appt.hours
      : calculateAppointmentHours(appt.size, appt.type)
  const endDt = startDt.plus({ hours })
  return { start: startDt.toUTC().toJSDate(), end: endDt.toUTC().toJSDate() }
}

/** Action/visibility window: early minutes before start through job end. */
export function getAppointmentActionWindow(
  appt: ServiceWindowAppointment,
  zone: string = DEFAULT_APPOINTMENT_TIMEZONE,
): { start: Date; end: Date } {
  const { start, end } = getAppointmentServiceWindow(appt, zone)
  return {
    start: new Date(start.getTime() - SERVICE_STATUS_EARLY_MINUTES * 60 * 1000),
    end,
  }
}

export function isWithinAppointmentServiceWindow(
  appt: ServiceWindowAppointment,
  now: Date,
  zone: string = DEFAULT_APPOINTMENT_TIMEZONE,
): boolean {
  const { start, end } = getAppointmentActionWindow(appt, zone)
  const t = now.getTime()
  return t >= start.getTime() && t < end.getTime()
}

export type PickableAppointment = ServiceWindowAppointment & {
  id: number
  status: string
}

/** All in-window, non-excluded appointments, soonest start first. */
export function listActiveAppointments<T extends PickableAppointment>(
  appointments: T[],
  now: Date,
  zone: string = DEFAULT_APPOINTMENT_TIMEZONE,
): T[] {
  return appointments
    .filter((a) => !EXCLUDED_STATUSES.has(a.status))
    .filter((a) => isWithinAppointmentServiceWindow(a, now, zone))
    .map((a) => ({ appt: a, start: getAppointmentServiceWindow(a, zone).start.getTime() }))
    .sort((x, y) => x.start - y.start || x.appt.id - y.appt.id)
    .map((x) => x.appt)
}

/** Among in-window appointments, pick the soonest start. */
export function pickActiveAppointment<T extends PickableAppointment>(
  appointments: T[],
  now: Date,
  zone: string = DEFAULT_APPOINTMENT_TIMEZONE,
): T | null {
  return listActiveAppointments(appointments, now, zone)[0] ?? null
}

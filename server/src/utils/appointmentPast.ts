import { DateTime } from 'luxon'
import { appointmentLocalDateKey, DEFAULT_APPOINTMENT_TIMEZONE } from './appointmentTimezone'

function parseTimeToHm(time: string): { hour: number; minute: number } | null {
  const m = time.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const hour = parseInt(m[1], 10)
  const minute = parseInt(m[2], 10)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null
  if (hour < 0 || hour > 23) return null
  if (minute < 0 || minute > 59) return null
  return { hour, minute }
}

/**
 * True when an appointment's scheduled local date+time is in the past (or exactly now),
 * using the business appointment timezone.
 */
export function isAppointmentInPast(
  appt: { dateUtc: Date | null; date: Date; time?: string | null },
  now: Date,
  zone: string = DEFAULT_APPOINTMENT_TIMEZONE,
): boolean {
  const localDay = appointmentLocalDateKey({ dateUtc: appt.dateUtc, date: appt.date }, zone)
  const hm = appt.time ? parseTimeToHm(appt.time) : null
  const scheduled = hm
    ? DateTime.fromISO(localDay, { zone }).set({ hour: hm.hour, minute: hm.minute, second: 0, millisecond: 0 })
    : DateTime.fromISO(localDay, { zone }).startOf('day')
  if (!scheduled.isValid) return false
  const nowZ = DateTime.fromJSDate(now, { zone })
  return scheduled.toMillis() <= nowZ.toMillis()
}


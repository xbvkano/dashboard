import { DateTime } from 'luxon'
import { appointmentLocalDateKey, DEFAULT_APPOINTMENT_TIMEZONE } from './appointmentTimezone'

/**
 * True when an appointment's local calendar day is before today
 * (yesterday or earlier) in the business appointment timezone.
 * Today's jobs are never past until midnight, so they stay visible/active all day.
 */
export function isAppointmentInPast(
  appt: { dateUtc: Date | null; date: Date; time?: string | null },
  now: Date,
  zone: string = DEFAULT_APPOINTMENT_TIMEZONE,
): boolean {
  const localDay = appointmentLocalDateKey({ dateUtc: appt.dateUtc, date: appt.date }, zone)
  const apptDay = DateTime.fromISO(localDay, { zone }).startOf('day')
  if (!apptDay.isValid) return false
  const today = DateTime.fromJSDate(now, { zone }).startOf('day')
  return apptDay.toMillis() < today.toMillis()
}

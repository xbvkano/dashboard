import type { ClientAppointment } from '../messagingApi'

/** Stable calendar sort key: YYYY-MM-DD + time so lexicographic compare matches chronology. */
export function clientAppointmentChronoKey(a: ClientAppointment): string {
  const day =
    (a.localDate && a.localDate.slice(0, 10)) ||
    (typeof a.date === 'string' ? a.date.slice(0, 10) : '') ||
    '0000-00-00'
  const time = (a.time || '00:00').padStart(5, '0')
  return `${day}T${time}`
}

/** Newest calendar slot first (latest appointment at the top). */
export function sortClientAppointmentsNewestFirst(
  appointments: ClientAppointment[],
): ClientAppointment[] {
  return [...appointments].sort((a, b) =>
    clientAppointmentChronoKey(b).localeCompare(clientAppointmentChronoKey(a)),
  )
}

import { DateTime } from 'luxon'
import type { Prisma } from '@prisma/client'

/** Default IANA zone for bookings (US West). Per-user `User.timeZone` can override later. */
export const DEFAULT_APPOINTMENT_TIMEZONE = 'America/Los_Angeles'

/**
 * Parse YYYY-MM-DD as a local calendar date in `zone` and return the UTC instant for
 * start-of-day in that zone (DST-safe).
 */
export function localDateStringToStartOfDayUtc(
  dateStr: string,
  zone: string = DEFAULT_APPOINTMENT_TIMEZONE,
): Date {
  const dt = DateTime.fromISO(dateStr, { zone })
  if (!dt.isValid) {
    throw new Error('Invalid date format. Use YYYY-MM-DD')
  }
  return dt.startOf('day').toUTC().toJSDate()
}

/**
 * Format a stored UTC instant as local YYYY-MM-DD in `zone`.
 */
export function utcInstantToLocalDateString(
  instant: Date,
  zone: string = DEFAULT_APPOINTMENT_TIMEZONE,
): string {
  return DateTime.fromMillis(instant.getTime(), { zone: 'utc' }).setZone(zone).toFormat('yyyy-LL-dd')
}

/** Half-open range [start, endExclusive) in UTC for one local calendar day. */
export function getLocalDayRangeUtc(
  dateStr: string,
  zone: string = DEFAULT_APPOINTMENT_TIMEZONE,
): { start: Date; endExclusive: Date } {
  const dt = DateTime.fromISO(dateStr, { zone })
  if (!dt.isValid) {
    throw new Error('Invalid date format. Use YYYY-MM-DD')
  }
  const start = dt.startOf('day').toUTC()
  const endExclusive = dt.plus({ days: 1 }).startOf('day').toUTC()
  return { start: start.toJSDate(), endExclusive: endExclusive.toJSDate() }
}

/**
 * Legacy `Appointment.date` was `Date.UTC(y,m,d)` (naive UTC midnight). Interpret that
 * y/m/d as a **local** calendar day in `zone` and return the correct start-of-day UTC instant.
 */
export function legacyUtcMidnightDateToLocalStartUtc(
  legacy: Date,
  zone: string = DEFAULT_APPOINTMENT_TIMEZONE,
): Date {
  const y = legacy.getUTCFullYear()
  const m = legacy.getUTCMonth() + 1
  const d = legacy.getUTCDate()
  const key = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  return localDateStringToStartOfDayUtc(key, zone)
}

/** Prefer dateUtc; else derive from legacy date column. */
export function appointmentAnchorUtc(
  row: { dateUtc: Date | null; date: Date },
  zone: string = DEFAULT_APPOINTMENT_TIMEZONE,
): Date {
  if (row.dateUtc != null) return new Date(row.dateUtc)
  return legacyUtcMidnightDateToLocalStartUtc(new Date(row.date), zone)
}

export function appointmentLocalDateKey(
  row: { dateUtc: Date | null; date: Date },
  zone: string = DEFAULT_APPOINTMENT_TIMEZONE,
): string {
  return utcInstantToLocalDateString(appointmentAnchorUtc(row, zone), zone)
}

/** Old storage: `date` = naive `Date.UTC(y,m,d)` for calendar key. */
export function legacyNaiveUtcMidnightRange(dateStr: string): { start: Date; endExclusive: Date } {
  const parts = dateStr.split('-')
  if (parts.length !== 3) throw new Error('Invalid date format. Use YYYY-MM-DD')
  const y = parseInt(parts[0], 10)
  const mo = parseInt(parts[1], 10) - 1
  const d = parseInt(parts[2], 10)
  const start = new Date(Date.UTC(y, mo, d))
  const endExclusive = new Date(Date.UTC(y, mo, d + 1))
  return { start, endExclusive }
}

/**
 * Match appointments on a business local calendar day: new rows use `dateUtc`;
 * legacy rows may have `dateUtc` null and old `date` in naive UTC range.
 */
export function whereAppointmentOnBusinessDay(dateStr: string): Prisma.AppointmentWhereInput {
  const { start, endExclusive } = getLocalDayRangeUtc(dateStr)
  const legacy = legacyNaiveUtcMidnightRange(dateStr)
  return {
    OR: [
      { dateUtc: { gte: start, lt: endExclusive } },
      {
        AND: [{ dateUtc: null }, { date: { gte: legacy.start, lt: legacy.endExclusive } }],
      },
    ],
  }
}

/**
 * Appointments whose business calendar day falls in `[startLocalDateStr, endLocalDateInclusiveStr]` inclusive.
 * Aligns with schedule-overview filtering (modern `dateUtc` + legacy naive `date`).
 */
export function whereAppointmentOnInclusiveLocalDateRange(
  startLocalDateStr: string,
  endLocalDateInclusiveStr: string,
  zone: string = DEFAULT_APPOINTMENT_TIMEZONE,
): Prisma.AppointmentWhereInput {
  const rangeStart = DateTime.fromISO(startLocalDateStr, { zone }).startOf('day').toUTC()
  const rangeEndEx = DateTime.fromISO(endLocalDateInclusiveStr, { zone })
    .plus({ days: 1 })
    .startOf('day')
    .toUTC()
  if (!rangeStart.isValid || !rangeEndEx.isValid || rangeStart >= rangeEndEx) {
    throw new Error('Invalid local date range')
  }
  const legacyNaiveEnd = new Date(`${endLocalDateInclusiveStr}T00:00:00.000Z`)
  legacyNaiveEnd.setUTCDate(legacyNaiveEnd.getUTCDate() + 1)
  const legacyNaiveStart = new Date(`${startLocalDateStr}T00:00:00.000Z`)
  return {
    OR: [
      { dateUtc: { gte: rangeStart.toJSDate(), lt: rangeEndEx.toJSDate() } },
      {
        AND: [
          { dateUtc: null },
          { date: { gte: legacyNaiveStart, lt: legacyNaiveEnd } },
        ],
      },
    ],
  }
}

/** Appointments on or after a business local calendar day (inclusive). */
export function whereAppointmentOnOrAfterLocalDate(
  firstLocalDateStr: string,
  zone: string = DEFAULT_APPOINTMENT_TIMEZONE,
): Prisma.AppointmentWhereInput {
  const rangeStart = DateTime.fromISO(firstLocalDateStr, { zone }).startOf('day').toUTC()
  if (!rangeStart.isValid) {
    throw new Error('Invalid local date')
  }
  const legacyNaiveStart = new Date(`${firstLocalDateStr}T00:00:00.000Z`)
  return {
    OR: [
      { dateUtc: { gte: rangeStart.toJSDate() } },
      {
        AND: [{ dateUtc: null }, { date: { gte: legacyNaiveStart } }],
      },
    ],
  }
}

/** Compare / order using calendar anchor (dateUtc or legacy). */
export function orderByAppointmentCalendar(): Prisma.AppointmentOrderByWithRelationInput[] {
  return [{ dateUtc: 'asc' }, { date: 'asc' }, { time: 'asc' }]
}

export function orderByAppointmentCalendarDesc(): Prisma.AppointmentOrderByWithRelationInput[] {
  return [{ dateUtc: 'desc' }, { date: 'desc' }, { time: 'desc' }]
}

/** Re-anchor any instant to the business local calendar day’s UTC start (after date math / recurrence). */
export function normalizeToBusinessDayAnchorUtc(
  instant: Date,
  zone: string = DEFAULT_APPOINTMENT_TIMEZONE,
): Date {
  return localDateStringToStartOfDayUtc(utcInstantToLocalDateString(instant, zone), zone)
}

/** Next calendar day in `zone` relative to `asOf` (wall clock), as a local-day UTC range. */
export function getTomorrowLocalDayRangeUtcFrom(
  asOf: Date,
  zone: string = DEFAULT_APPOINTMENT_TIMEZONE,
): { start: Date; endExclusive: Date } {
  const tomorrowStr = DateTime.fromJSDate(asOf)
    .setZone(zone)
    .plus({ days: 1 })
    .toFormat('yyyy-LL-dd')
  return getLocalDayRangeUtc(tomorrowStr, zone)
}

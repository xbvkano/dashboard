import type { Appointment } from '@prisma/client'
import { appointmentLocalDateKey } from './appointmentTimezone'

/** Attach `localDate` (YYYY-MM-DD in business timezone) for API consumers. */
export function withAppointmentLocalDate<A extends { dateUtc: Date | null; date: Date }>(
  row: A,
): A & { localDate: string } {
  return { ...row, localDate: appointmentLocalDateKey(row) }
}

export function withAppointmentLocalDateMany<A extends { dateUtc: Date | null; date: Date }>(
  rows: A[],
): Array<A & { localDate: string }> {
  return rows.map(withAppointmentLocalDate)
}

/** Narrows Prisma appointment for JSON (plain objects). */
export type AppointmentWithLocalDate = Appointment & { localDate: string }

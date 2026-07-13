import { businessTodayLocalDateString } from '../types'

/** Parse YYYY-MM-DD as local calendar midnight (avoids UTC shift from Date.parse). */
export function parseLocalDateString(dateStr: string): Date {
  const parts = dateStr.split('-')
  if (parts.length !== 3) return new Date(NaN)
  const y = parseInt(parts[0], 10)
  const m = parseInt(parts[1], 10)
  const d = parseInt(parts[2], 10)
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return new Date(NaN)
  return new Date(y, m - 1, d)
}

/** Today’s local midnight in the business timezone. */
export function businessTodayDate(): Date {
  return parseLocalDateString(businessTodayLocalDateString())
}

export function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function isSelectedBusinessToday(selected: Date): boolean {
  return isSameLocalDay(selected, businessTodayDate())
}

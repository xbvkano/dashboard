/**
 * Helpers for schedule update policy: compute the "update due date" (day by which employee must update).
 * updateDayOfWeek: 0=Sunday .. 6=Saturday.
 */

/** Next occurrence of updateDayOfWeek on or after refDate (start of day). Use for backfill / new schedule default. */
export function getNextOrThisUpdateDay(refDate: Date, updateDayOfWeek: number): Date {
  const d = new Date(refDate)
  d.setHours(0, 0, 0, 0)
  while (d.getDay() !== updateDayOfWeek) {
    d.setDate(d.getDate() + 1)
  }
  return d
}

/** Next occurrence of updateDayOfWeek strictly after refDate. Use when employee has just updated (set their next due date). */
export function getNextUpdateDueDate(afterDate: Date, updateDayOfWeek: number): Date {
  const d = new Date(afterDate)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 1)
  while (d.getDay() !== updateDayOfWeek) {
    d.setDate(d.getDate() + 1)
  }
  return d
}

export type RecurrenceRule = {
  type: 'weekly' | 'biweekly' | 'every3weeks' | 'monthly' | 'customMonths' | 'monthlyPattern'
  interval?: number // For weekly/biweekly/every3weeks: 1, 2, 3. For customMonths: number of months
  dayOfWeek?: number // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  weekOfMonth?: number // 1 = first, 2 = second, 3 = third, 4 = fourth, -1 = last
  dayOfMonth?: number // 1-31 for monthly pattern
}

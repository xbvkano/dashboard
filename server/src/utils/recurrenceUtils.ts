/**
 * Recurrence rule utilities for calculating next appointment dates
 */

export type RecurrenceRule = {
  type: 'weekly' | 'biweekly' | 'every3weeks' | 'monthly' | 'customMonths' | 'monthlyPattern'
  interval?: number // For weekly/biweekly/every3weeks: 1, 2, 3. For customMonths: number of months
  dayOfWeek?: number // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  weekOfMonth?: number // 1 = first, 2 = second, 3 = third, 4 = fourth, -1 = last
  dayOfMonth?: number // 1-31 for monthly pattern
}

/**
 * Calculate the next appointment date based on a recurrence rule and a reference date
 */
export function calculateNextAppointmentDate(
  rule: RecurrenceRule,
  referenceDate: Date
): Date {
  const next = new Date(referenceDate)

  switch (rule.type) {
    case 'weekly':
      next.setDate(next.getDate() + 7)
      break
    case 'biweekly':
      next.setDate(next.getDate() + 14)
      break
    case 'every3weeks':
      next.setDate(next.getDate() + 21)
      break
    case 'monthly':
      next.setMonth(next.getMonth() + 1)
      break
    case 'customMonths':
      const months = rule.interval || 1
      next.setMonth(next.getMonth() + months)
      break
    case 'monthlyPattern':
      if (rule.weekOfMonth && rule.dayOfWeek !== undefined) {
        // First, second, third, fourth, or last occurrence of a day of week
        const currentMonth = referenceDate.getMonth() // 0-11
        const currentYear = referenceDate.getFullYear()
        const targetMonth = currentMonth + 1 // Next month (may be > 11, Date constructor handles it)
        const targetYear = currentYear
        
        const firstDay = new Date(targetYear, targetMonth, 1)
        const firstDayOfWeek = firstDay.getDay()
        let targetDay = 1 + ((rule.dayOfWeek - firstDayOfWeek + 7) % 7)
        if (rule.weekOfMonth > 0) {
          targetDay += (rule.weekOfMonth - 1) * 7
        } else {
          // Last occurrence
          const lastDay = new Date(targetYear, targetMonth + 1, 0)
          const lastDayOfWeek = lastDay.getDay()
          const daysFromLast = (lastDayOfWeek - rule.dayOfWeek + 7) % 7
          targetDay = lastDay.getDate() - daysFromLast
        }
        // Use setFullYear to properly handle month/year overflow (e.g., month 12 becomes month 0 of next year)
        next.setFullYear(targetYear, targetMonth, targetDay)
      } else if (rule.dayOfMonth) {
        // Specific day of month (e.g., 5th of every month)
        next.setMonth(next.getMonth() + 1)
        next.setDate(rule.dayOfMonth)
      } else {
        // Fallback to monthly
        next.setMonth(next.getMonth() + 1)
      }
      break
    default:
      // Fallback to weekly
      next.setDate(next.getDate() + 7)
  }

  return next
}

/**
 * Parse a legacy frequency string into a RecurrenceRule
 */
export function parseLegacyFrequency(frequency: string, months?: number): RecurrenceRule {
  switch (frequency) {
    case 'WEEKLY':
      return { type: 'weekly', interval: 1 }
    case 'BIWEEKLY':
      return { type: 'biweekly', interval: 2 }
    case 'EVERY3':
      return { type: 'every3weeks', interval: 3 }
    case 'MONTHLY':
      return { type: 'monthly' }
    case 'CUSTOM':
      return { type: 'customMonths', interval: months || 1 }
    default:
      return { type: 'weekly', interval: 1 }
  }
}

/**
 * Convert a RecurrenceRule to a JSON string for storage
 */
export function ruleToJson(rule: RecurrenceRule): string {
  return JSON.stringify(rule)
}

/**
 * Parse a JSON string back to a RecurrenceRule
 */
export function jsonToRule(json: string): RecurrenceRule {
  try {
    return JSON.parse(json)
  } catch {
    return { type: 'weekly', interval: 1 }
  }
}

/**
 * Format a recurrence rule for display
 */
export function formatRecurrenceRule(rule: RecurrenceRule): string {
  switch (rule.type) {
    case 'weekly':
      return 'Every week'
    case 'biweekly':
      return 'Every 2 weeks'
    case 'every3weeks':
      return 'Every 3 weeks'
    case 'monthly':
      return 'Every month'
    case 'customMonths':
      return `Every ${rule.interval || 1} ${rule.interval === 1 ? 'month' : 'months'}`
    case 'monthlyPattern':
      if (rule.weekOfMonth && rule.dayOfWeek !== undefined) {
        const weekNames = ['first', 'second', 'third', 'fourth', 'last']
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        const weekName = rule.weekOfMonth > 0 ? weekNames[rule.weekOfMonth - 1] : 'last'
        return `${weekName} ${dayNames[rule.dayOfWeek]} of every month`
      } else if (rule.dayOfMonth) {
        return `${rule.dayOfMonth}${getOrdinalSuffix(rule.dayOfMonth)} of every month`
      }
      return 'Monthly pattern'
    default:
      return 'Recurring'
  }
}

function getOrdinalSuffix(n: number): string {
  const j = n % 10
  const k = n % 100
  if (j === 1 && k !== 11) return 'st'
  if (j === 2 && k !== 12) return 'nd'
  if (j === 3 && k !== 13) return 'rd'
  return 'th'
}

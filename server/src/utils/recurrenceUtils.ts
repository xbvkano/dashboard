/**
 * Recurrence rule utilities for calculating next appointment dates
 */

export type RecurrenceRule = {
  type: 'weekly' | 'biweekly' | 'every3weeks' | 'every4weeks' | 'monthly' | 'customMonths' | 'monthlyPattern'
  interval?: number // For weekly/biweekly/every3weeks/every4weeks: 1, 2, 3, 4. For customMonths: number of months
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
    case 'every4weeks':
      next.setDate(next.getDate() + 28)
      break
    case 'monthly': {
      const originalDay = referenceDate.getDate()
      const refMonth = referenceDate.getMonth()
      const refYear = referenceDate.getFullYear()
      const lastDayOfRefMonth = new Date(refYear, refMonth + 1, 0).getDate()
      // If we're on the last day of the ref month (e.g. Feb 28 from Jan 31), use last day of target month
      const intendedDay = originalDay === lastDayOfRefMonth ? 31 : originalDay
      const targetMonth = next.getMonth() + 1
      const targetYear = next.getFullYear() + Math.floor(targetMonth / 12)
      const finalMonth = targetMonth % 12
      next.setFullYear(targetYear, finalMonth, 1)
      const lastDayOfTargetMonth = new Date(targetYear, finalMonth + 1, 0).getDate()
      const finalDay = Math.min(intendedDay, lastDayOfTargetMonth)
      next.setDate(finalDay)
      break
    }
    case 'customMonths': {
      const months = rule.interval || 1
      const originalDay = referenceDate.getDate()
      const refMonth = referenceDate.getMonth()
      const refYear = referenceDate.getFullYear()
      const lastDayOfRefMonth = new Date(refYear, refMonth + 1, 0).getDate()
      const intendedDay = originalDay === lastDayOfRefMonth ? 31 : originalDay
      const targetMonth = next.getMonth() + months
      const targetYear = next.getFullYear() + Math.floor(targetMonth / 12)
      const finalMonth = targetMonth % 12
      next.setFullYear(targetYear, finalMonth, 1)
      const lastDayOfTargetMonth = new Date(targetYear, finalMonth + 1, 0).getDate()
      const finalDay = Math.min(intendedDay, lastDayOfTargetMonth)
      next.setDate(finalDay)
      break
    }
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
    case 'EVERY4':
      return { type: 'every4weeks', interval: 4 }
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
    case 'every4weeks':
      return 'Every 4 weeks'
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

/**
 * Calculate how many times a recurrence will happen in a given month
 * starting from the last booked appointment date
 */
export function countOccurrencesInMonth(
  rule: RecurrenceRule,
  lastBookedDate: Date,
  targetMonth: number, // 0-11
  targetYear: number
): number {
  // Start from the last booked date
  let currentDate = new Date(lastBookedDate)
  currentDate.setHours(0, 0, 0, 0)
  
  // Calculate month boundaries
  const monthStart = new Date(targetYear, targetMonth, 1)
  monthStart.setHours(0, 0, 0, 0)
  const monthEnd = new Date(targetYear, targetMonth + 1, 0)
  monthEnd.setHours(23, 59, 59, 999)
  
  // If last booked date is after the month, no occurrences
  if (currentDate > monthEnd) {
    return 0
  }
  
  // For customMonths with interval > 1, check if it will occur in this month
  if (rule.type === 'customMonths' && rule.interval && rule.interval > 1) {
    // Calculate how many months from last booked date to target month
    const lastBookedMonth = currentDate.getFullYear() * 12 + currentDate.getMonth()
    const targetMonthNum = targetYear * 12 + targetMonth
    const monthsDiff = targetMonthNum - lastBookedMonth
    
    // Check if target month is a multiple of the interval from last booked date
    if (monthsDiff < 0 || monthsDiff % rule.interval !== 0) {
      return 0
    }
    
    // Calculate the actual date it would occur on (preserving day of month)
    const originalDay = currentDate.getDate()
    const lastDayOfMonth = new Date(targetYear, targetMonth + 1, 0).getDate()
    const finalDay = Math.min(originalDay, lastDayOfMonth)
    const occurrenceDate = new Date(targetYear, targetMonth, finalDay)
    occurrenceDate.setHours(0, 0, 0, 0)
    
    // Check if this date falls within the month boundaries
    if (occurrenceDate >= monthStart && occurrenceDate <= monthEnd) {
      return 1
    }
    
    return 0
  }
  
  // For all other types, calculate next occurrences and count how many fall in the month
  let count = 0
  let nextDate = calculateNextAppointmentDate(rule, currentDate)
  
  // Keep calculating next occurrences until we're past the month
  // Limit to prevent infinite loops (scale with distance: up to ~6 months at 4/week + buffer)
  const maxIterations = 50
  let iterations = 0
  while (nextDate <= monthEnd && iterations < maxIterations) {
    if (nextDate >= monthStart) {
      count++
    }
    currentDate = new Date(nextDate)
    nextDate = calculateNextAppointmentDate(rule, currentDate)
    iterations++
  }
  
  return count
}

/**
 * Input for projected revenue calculation (simplified from RecurrenceFamily)
 */
export interface FamilyForProjection {
  rule: RecurrenceRule
  referenceDate: Date
  price: number
}

/**
 * Calculate projected revenue for a month from active recurring families.
 * Counts ALL occurrences based on recurrence patterns (baseline estimate).
 * Does NOT exclude dates that already have confirmed/unconfirmed appointments.
 */
export function calculateProjectedRevenueForMonth(
  families: FamilyForProjection[],
  targetMonth: number, // 0-11
  targetYear: number
): { total: number; details: Array<{ occurrences: number; price: number; revenue: number }> } {
  const details: Array<{ occurrences: number; price: number; revenue: number }> = []
  let total = 0

  for (const family of families) {
    const occurrences = countOccurrencesInMonth(
      family.rule,
      family.referenceDate,
      targetMonth,
      targetYear
    )
    const revenue = occurrences * family.price
    details.push({ occurrences, price: family.price, revenue })
    total += revenue
  }

  return { total, details }
}
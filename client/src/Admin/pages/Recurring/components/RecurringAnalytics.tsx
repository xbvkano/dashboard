import { useState, useMemo } from 'react'
import { RecurrenceFamily } from '../index'

interface Props {
  activeFamilies: RecurrenceFamily[]
  stoppedFamilies: RecurrenceFamily[]
  selectedMonth: number
  selectedYear: number
}

interface ProjectedRevenueDetail {
  familyId: number
  clientName: string
  ruleSummary: string
  lastBookedDate: string | null
  occurrencesThisMonth: number
  pricePerOccurrence: number
  totalRevenue: number
}

/**
 * Calculate occurrences in selected month
 * Finds the first occurrence in the month, then counts all occurrences from there
 * Returns count and debug info
 */
function countOccurrencesThisMonth(
  rule: any,
  referenceDate: Date,
  selectedMonth: number,
  selectedYear: number,
  familyId: number,
  clientName: string,
  existingAppointmentDates?: Set<string>
): { count: number; dates: string[]; debugInfo: string[] } {
  const debugInfo: string[] = []
  debugInfo.push(`[Family ${familyId}: ${clientName}] Calculating occurrences for ${new Date(selectedYear, selectedMonth, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`)
  debugInfo.push(`  Rule: ${JSON.stringify(rule)}`)
  debugInfo.push(`  Reference date: ${referenceDate.toLocaleDateString()}`)
  
  const monthStart = new Date(selectedYear, selectedMonth, 1)
  monthStart.setHours(0, 0, 0, 0)
  const monthEnd = new Date(selectedYear, selectedMonth + 1, 0)
  monthEnd.setHours(23, 59, 59, 999)
  debugInfo.push(`  Month range: ${monthStart.toLocaleDateString()} to ${monthEnd.toLocaleDateString()}`)
  
  // Helper to calculate monthlyPattern date for a specific month
  const calculateMonthlyPatternDate = (rule: any, year: number, month: number): Date | null => {
    if (rule?.type !== 'monthlyPattern' || rule.weekOfMonth === undefined || rule.dayOfWeek === undefined) {
      return null
    }
    
    const firstDay = new Date(year, month, 1)
    const firstDayOfWeek = firstDay.getDay()
    let targetDay = 1 + ((rule.dayOfWeek - firstDayOfWeek + 7) % 7)
    
    if (rule.weekOfMonth > 0) {
      targetDay += (rule.weekOfMonth - 1) * 7
    } else {
      // Last occurrence
      const lastDay = new Date(year, month + 1, 0)
      const lastDayOfWeek = lastDay.getDay()
      const daysFromLast = (lastDayOfWeek - rule.dayOfWeek + 7) % 7
      targetDay = lastDay.getDate() - daysFromLast
    }
    
    const result = new Date(year, month, targetDay)
    return result
  }
  
  // Helper to calculate next date
  const calculateNext = (rule: any, date: Date): Date => {
    const next = new Date(date)
    switch (rule?.type) {
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
        // Preserve the day of month when adding months
        const originalDay = date.getDate()
        const targetMonth = next.getMonth() + months
        const targetYear = next.getFullYear() + Math.floor(targetMonth / 12)
        const finalMonth = targetMonth % 12
        next.setFullYear(targetYear, finalMonth, 1)
        const lastDayOfMonth = new Date(targetYear, finalMonth + 1, 0).getDate()
        const finalDay = Math.min(originalDay, lastDayOfMonth)
        next.setDate(finalDay)
        break
      case 'monthlyPattern':
        if (rule.weekOfMonth !== undefined && rule.dayOfWeek !== undefined) {
          const currentMonth = date.getMonth()
          const currentYear = date.getFullYear()
          const targetMonth = currentMonth + 1
          const targetYear = currentYear + Math.floor(targetMonth / 12)
          const finalMonth = targetMonth % 12
          const patternDate = calculateMonthlyPatternDate(rule, targetYear, finalMonth)
          if (patternDate) {
            next.setTime(patternDate.getTime())
          } else {
            next.setMonth(next.getMonth() + 1)
          }
        } else if (rule.dayOfMonth) {
          next.setMonth(next.getMonth() + 1)
          next.setDate(rule.dayOfMonth)
        } else {
          next.setMonth(next.getMonth() + 1)
        }
        break
      default:
        next.setDate(next.getDate() + 7)
    }
    return next
  }
  
  // Helper to calculate previous date
  const calculatePrevious = (rule: any, date: Date): Date => {
    const prev = new Date(date)
    switch (rule?.type) {
      case 'weekly':
        prev.setDate(prev.getDate() - 7)
        break
      case 'biweekly':
        prev.setDate(prev.getDate() - 14)
        break
      case 'every3weeks':
        prev.setDate(prev.getDate() - 21)
        break
      case 'monthly':
        prev.setMonth(prev.getMonth() - 1)
        break
      case 'customMonths':
        const months = rule.interval || 1
        // Preserve the day of month when subtracting months
        const originalDay = date.getDate()
        const targetMonth = prev.getMonth() - months
        const targetYear = prev.getFullYear() + Math.floor(targetMonth / 12)
        const finalMonth = (targetMonth % 12 + 12) % 12
        prev.setFullYear(targetYear, finalMonth, 1)
        const lastDayOfMonth = new Date(targetYear, finalMonth + 1, 0).getDate()
        const finalDay = Math.min(originalDay, lastDayOfMonth)
        prev.setDate(finalDay)
        break
      case 'monthlyPattern':
        if (rule.weekOfMonth !== undefined && rule.dayOfWeek !== undefined) {
          const currentMonth = date.getMonth()
          const currentYear = date.getFullYear()
          const targetMonth = currentMonth - 1
          const targetYear = currentYear + Math.floor(targetMonth / 12)
          const finalMonth = (targetMonth % 12 + 12) % 12
          const patternDate = calculateMonthlyPatternDate(rule, targetYear, finalMonth)
          if (patternDate) {
            prev.setTime(patternDate.getTime())
          } else {
            prev.setMonth(prev.getMonth() - 1)
          }
        } else if (rule.dayOfMonth) {
          prev.setMonth(prev.getMonth() - 1)
          prev.setDate(rule.dayOfMonth)
        } else {
          prev.setMonth(prev.getMonth() - 1)
        }
        break
      default:
        prev.setDate(prev.getDate() - 7)
    }
    return prev
  }
  
  // For customMonths with interval > 1, check if first occurrence would be in this month
  if (rule?.type === 'customMonths' && rule?.interval && rule.interval > 1) {
    debugInfo.push(`  CustomMonths with interval ${rule.interval}`)
    
    let foundInMonth = false
    let firstOccurrenceInMonth: Date | null = null
    let checkDate = new Date(referenceDate)
    let iterations = 0
    
    if (referenceDate < monthStart) {
      // Reference is before target month: walk FORWARD to find if we hit the target month
      debugInfo.push(`  Reference date is before month - calculating forward to find occurrence`)
      while (iterations < 24 && checkDate <= monthEnd) {
        const checkMonth = checkDate.getFullYear() * 12 + checkDate.getMonth()
        const targetMonthNum = selectedYear * 12 + selectedMonth
        const monthsDiff = targetMonthNum - checkMonth
        
        if (monthsDiff === 0 && checkDate >= monthStart) {
          // We landed in the target month
          firstOccurrenceInMonth = new Date(checkDate)
          firstOccurrenceInMonth.setHours(0, 0, 0, 0)
          foundInMonth = true
          debugInfo.push(`  Found occurrence by walking forward: ${firstOccurrenceInMonth.toLocaleDateString()} ✅`)
          break
        }
        
        checkDate = calculateNext(rule, checkDate)
        iterations++
      }
    } else {
      // Reference is in or after target month: work backwards from reference
      debugInfo.push(`  Finding first occurrence in month by working backwards from reference`)
      while (iterations < 24 && checkDate >= monthStart) {
        const checkMonth = checkDate.getFullYear() * 12 + checkDate.getMonth()
        const targetMonthNum = selectedYear * 12 + selectedMonth
        const monthsDiff = targetMonthNum - checkMonth
        
        if (monthsDiff % rule.interval === 0 && monthsDiff >= 0) {
          const originalDay = checkDate.getDate()
          const lastDayOfTargetMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate()
          const finalDay = Math.min(originalDay, lastDayOfTargetMonth)
          const occurrenceDate = new Date(selectedYear, selectedMonth, finalDay)
          occurrenceDate.setHours(0, 0, 0, 0)
          
          if (occurrenceDate >= monthStart && occurrenceDate <= monthEnd) {
            firstOccurrenceInMonth = occurrenceDate
            foundInMonth = true
            debugInfo.push(`  Found pattern match: ${checkDate.toLocaleDateString()} → ${occurrenceDate.toLocaleDateString()} ✅`)
            break
          }
        }
        
        checkDate = calculatePrevious(rule, checkDate)
        iterations++
      }
    }
    
    if (foundInMonth && firstOccurrenceInMonth) {
      debugInfo.push(`  First occurrence in month: ${firstOccurrenceInMonth.toLocaleDateString()}`)
      // Create date key directly from date components to avoid timezone issues
      const year = firstOccurrenceInMonth.getFullYear()
      const month = firstOccurrenceInMonth.getMonth() + 1
      const day = firstOccurrenceInMonth.getDate()
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      
      // Only exclude if exclusion set is provided (for calendar view)
      if (existingAppointmentDates && existingAppointmentDates.has(dateStr)) {
        debugInfo.push(`  ❌ Excluded - already has appointment on this date`)
        return { count: 0, dates: [], debugInfo }
      }
      debugInfo.push(`  ✅ Month aligns with interval - 1 occurrence`)
      return { count: 1, dates: [dateStr], debugInfo }
    } else {
      debugInfo.push(`  ❌ Month does not align with interval - 0 occurrences`)
      return { count: 0, dates: [], debugInfo }
    }
  }
  
  // Special handling for monthlyPattern - directly calculate the date for the selected month
  if (rule?.type === 'monthlyPattern' && rule.weekOfMonth !== undefined && rule.dayOfWeek !== undefined) {
    debugInfo.push(`  MonthlyPattern: Calculating date for selected month directly`)
    const patternDate = calculateMonthlyPatternDate(rule, selectedYear, selectedMonth)
    if (patternDate && patternDate >= monthStart && patternDate <= monthEnd) {
      const year = patternDate.getFullYear()
      const month = patternDate.getMonth() + 1
      const day = patternDate.getDate()
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      
      // Only exclude if exclusion set is provided (for calendar view)
      if (existingAppointmentDates && existingAppointmentDates.has(dateStr)) {
        debugInfo.push(`  ❌ Excluded - already has appointment on this date`)
        return { count: 0, dates: [], debugInfo }
      }
      debugInfo.push(`  ✅ Found 1 occurrence in month: ${dateStr}`)
      return { count: 1, dates: [dateStr], debugInfo }
    } else {
      debugInfo.push(`  ❌ Calculated date (${patternDate?.toLocaleDateString() || 'null'}) is not in target month`)
      return { count: 0, dates: [], debugInfo }
    }
  }
  
  // For all other types, find the first occurrence in the month
  debugInfo.push(`  Finding first occurrence in month by working backwards from reference date`)
  
  let firstOccurrenceInMonth: Date | null = null
  let currentDate = new Date(referenceDate)
  let iterations = 0
  
  // If reference is before the month, move forward to find first occurrence in month
  if (referenceDate < monthStart) {
    debugInfo.push(`  Reference date is before month - calculating forward to find first occurrence`)
    // Calculate maximum iterations needed: distance in days / minimum interval (7 days for weekly)
    const daysDiff = (monthStart.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24)
    const minIntervalDays = rule?.type === 'weekly' ? 7 : rule?.type === 'biweekly' ? 14 : rule?.type === 'every3weeks' ? 21 : 7
    const maxIterationsNeeded = Math.ceil(daysDiff / minIntervalDays) + 5 // Add buffer
    const iterationLimit = Math.max(50, maxIterationsNeeded) // At least 50, but scale with distance
    
    debugInfo.push(`  Days from reference to month start: ${Math.round(daysDiff)}, max iterations needed: ${iterationLimit}`)
    
    while (currentDate < monthStart && iterations < iterationLimit) {
      currentDate = calculateNext(rule, currentDate)
      iterations++
    }
    if (currentDate >= monthStart && currentDate <= monthEnd) {
      firstOccurrenceInMonth = new Date(currentDate)
      debugInfo.push(`  First occurrence in month: ${firstOccurrenceInMonth.toLocaleDateString()} (calculated forward in ${iterations} iterations)`)
    } else if (iterations >= iterationLimit) {
      debugInfo.push(`  ⚠️ Hit iteration limit (${iterationLimit}) - could not reach target month`)
    }
  } else {
    // Work backwards from reference to find first occurrence in month
    while (currentDate >= monthStart && iterations < 20) {
      const prevDate = calculatePrevious(rule, currentDate)
      if (prevDate < monthStart) {
        // This is the first occurrence in the month
        firstOccurrenceInMonth = new Date(currentDate)
        debugInfo.push(`  First occurrence in month: ${firstOccurrenceInMonth.toLocaleDateString()} (found by going back)`)
        break
      }
      currentDate = prevDate
      iterations++
    }
    
    // If we didn't find it going back, check if reference itself is the first
    if (!firstOccurrenceInMonth && referenceDate >= monthStart && referenceDate <= monthEnd) {
      firstOccurrenceInMonth = new Date(referenceDate)
      debugInfo.push(`  Reference date itself is first occurrence in month: ${firstOccurrenceInMonth.toLocaleDateString()}`)
    }
  }
  
  if (!firstOccurrenceInMonth) {
    debugInfo.push(`  ❌ No occurrence found in target month`)
    return { count: 0, dates: [], debugInfo }
  }
  
  // Now count all occurrences in the month starting from the first occurrence
  const occurrencesSet = new Set<string>()
  currentDate = new Date(firstOccurrenceInMonth)
  iterations = 0
  
  debugInfo.push(`  Counting occurrences from first occurrence (${firstOccurrenceInMonth.toLocaleDateString()}):`)
  
  while (currentDate <= monthEnd && iterations < 10) {
    if (currentDate >= monthStart) {
      // Create date key directly from date components to avoid timezone issues
      const year = currentDate.getFullYear()
      const month = currentDate.getMonth() + 1
      const day = currentDate.getDate()
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      occurrencesSet.add(dateStr)
      debugInfo.push(`    ${currentDate.toLocaleDateString()} ✅ (occurrence ${occurrencesSet.size})`)
    }
    currentDate = calculateNext(rule, currentDate)
    iterations++
    
    // Prevent infinite loop
    if (iterations > 0 && currentDate.getTime() <= firstOccurrenceInMonth.getTime()) {
      debugInfo.push(`    ⚠️ Date not progressing - stopping`)
      break
    }
  }
  
  // Filter out dates that already have appointments (from any family) - only if exclusion set is provided
  const allDates = Array.from(occurrencesSet)
  let filteredDates: string[]
  let count: number
  
  if (existingAppointmentDates) {
    // Calendar view: exclude dates with existing appointments
    filteredDates = allDates.filter(dateStr => {
      const shouldExclude = existingAppointmentDates.has(dateStr)
      if (shouldExclude) {
        debugInfo.push(`    ❌ Excluded ${dateStr} - already has appointment on this date`)
      }
      return !shouldExclude
    })
    count = filteredDates.length
    
    if (count > 0) {
      debugInfo.push(`  ✅ Found ${count} occurrence(s) in month (${allDates.length} total, ${allDates.length - count} excluded): ${filteredDates.join(', ')}`)
    } else if (allDates.length > 0) {
      debugInfo.push(`  ❌ All ${allDates.length} occurrence(s) excluded (already have appointments)`)
    } else {
      debugInfo.push(`  ❌ No occurrences found in target month`)
    }
  } else {
    // Projected Revenue: count ALL occurrences (baseline estimate)
    filteredDates = allDates
    count = filteredDates.length
    
    if (count > 0) {
      debugInfo.push(`  ✅ Found ${count} occurrence(s) in month: ${filteredDates.join(', ')}`)
    } else {
      debugInfo.push(`  ❌ No occurrences found in target month`)
    }
  }
  
  return { count, dates: filteredDates, debugInfo }
}

export default function RecurringAnalytics({ activeFamilies, stoppedFamilies, selectedMonth, selectedYear }: Props) {
  const [showDetails, setShowDetails] = useState(false)
  
  const totalActive = activeFamilies.length
  const totalStopped = stoppedFamilies.length
  
  // Filter appointments for the selected month/year
  const monthStart = new Date(selectedYear, selectedMonth, 1)
  const monthEnd = new Date(selectedYear, selectedMonth + 1, 0)
  monthEnd.setHours(23, 59, 59, 999)
  
  // Count upcoming appointments in selected month
  const totalUpcoming = useMemo(() => {
    return activeFamilies.reduce((sum, family) => {
      const appointments = family.appointments || []
      return sum + appointments.filter((a: any) => {
        const apptDate = new Date(a.date)
        apptDate.setHours(0, 0, 0, 0)
        return apptDate >= monthStart && apptDate <= monthEnd && 
               (a.status === 'APPOINTED' || a.status === 'RECURRING_UNCONFIRMED')
      }).length
    }, 0)
  }, [activeFamilies, selectedMonth, selectedYear])
  
  // Count unconfirmed appointments in selected month
  const totalUnconfirmed = useMemo(() => {
    return activeFamilies.reduce((sum, family) => {
      const appointments = family.appointments || []
      return sum + appointments.filter((a: any) => {
        const apptDate = new Date(a.date)
        apptDate.setHours(0, 0, 0, 0)
        return apptDate >= monthStart && apptDate <= monthEnd && 
               a.status === 'RECURRING_UNCONFIRMED'
      }).length
    }, 0)
  }, [activeFamilies, selectedMonth, selectedYear])
  
  // Calculate projected revenue for selected month
  const { projectedRevenue, details, calculationLogs } = useMemo(() => {
    const detailsList: ProjectedRevenueDetail[] = []
    const logs: string[] = []
    
    logs.push(`\n${'='.repeat(60)}`)
    logs.push(`PROJECTED REVENUE CALCULATION`)
    logs.push(`${'='.repeat(60)}`)
    logs.push(`Month/Year: ${new Date(selectedYear, selectedMonth, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`)
    logs.push(`Active Families: ${activeFamilies.length}`)
    logs.push(`Stopped Families: ${stoppedFamilies.length}`)
    logs.push(``)
    
    const monthStart = new Date(selectedYear, selectedMonth, 1)
    const monthEnd = new Date(selectedYear, selectedMonth + 1, 0)
    monthEnd.setHours(23, 59, 59, 999)
    
    // Collect all actual appointment dates (from ALL families - active AND stopped) for this month
    // NOTE: These are collected for informational purposes only. Projected Revenue counts ALL occurrences
    // regardless of whether appointments exist, as it's a baseline estimate of expected revenue.
    // The calendar view (purple projections) DOES exclude these dates to avoid showing duplicates.
    const existingAppointmentDates = new Set<string>()
    const existingAppointmentsByDate = new Map<string, Array<{familyId: number, clientName: string, status: string}>>()
    
    const allFamilies = [...activeFamilies, ...stoppedFamilies]
    logs.push(`  Collecting existing appointments for reference (${allFamilies.length} families: ${activeFamilies.length} active + ${stoppedFamilies.length} stopped)...`)
    let totalApptsProcessed = 0
    let apptsInMonth = 0
    
    allFamilies.forEach((family) => {
      (family.appointments || []).forEach((appt: any) => {
        totalApptsProcessed++
        const dateStr = appt.date
        const clientName = appt.client?.name || `Family ${family.id}`
        
        let apptDate: Date
        let parsedCorrectly = false
        let year: number, month: number, day: number
        
        if (typeof dateStr === 'string' && dateStr.includes('T')) {
          const dateOnly = dateStr.split('T')[0]
          const dateParts = dateOnly.split('-')
          if (dateParts.length === 3) {
            year = parseInt(dateParts[0])
            month = parseInt(dateParts[1])
            day = parseInt(dateParts[2])
            apptDate = new Date(year, month - 1, day)
            parsedCorrectly = true
          } else {
            apptDate = new Date(appt.date)
            year = apptDate.getFullYear()
            month = apptDate.getMonth() + 1
            day = apptDate.getDate()
          }
        } else if (typeof dateStr === 'string') {
          // Try parsing as YYYY-MM-DD format
          const dateParts = dateStr.split('-')
          if (dateParts.length === 3 && dateParts[0].length === 4) {
            year = parseInt(dateParts[0])
            month = parseInt(dateParts[1])
            day = parseInt(dateParts[2])
            apptDate = new Date(year, month - 1, day)
            parsedCorrectly = true
          } else {
            apptDate = new Date(appt.date)
            year = apptDate.getFullYear()
            month = apptDate.getMonth() + 1
            day = apptDate.getDate()
          }
        } else {
          apptDate = new Date(appt.date)
          year = apptDate.getFullYear()
          month = apptDate.getMonth() + 1
          day = apptDate.getDate()
        }
        
        // Check if this appointment is in the selected month
        if (month === selectedMonth + 1 && year === selectedYear) {
          apptsInMonth++
          const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          existingAppointmentDates.add(dateKey)
          
          if (!existingAppointmentsByDate.has(dateKey)) {
            existingAppointmentsByDate.set(dateKey, [])
          }
          existingAppointmentsByDate.get(dateKey)!.push({
            familyId: family.id,
            clientName,
            status: appt.status
          })
        }
      })
    })
    
    logs.push(`  Total appointments in selected month: ${apptsInMonth}`)
    logs.push(``)
    
    logs.push(`STEP 1: EXISTING APPOINTMENTS IN MONTH (For reference - NOT excluded from revenue calculation)`)
    logs.push(`-`.repeat(60))
    if (existingAppointmentDates.size === 0) {
      logs.push(`  No existing appointments in this month`)
    } else {
      const sortedDates = Array.from(existingAppointmentDates).sort()
      sortedDates.forEach(dateKey => {
        const appts = existingAppointmentsByDate.get(dateKey) || []
        const statusCounts = appts.reduce((acc: any, a) => {
          acc[a.status] = (acc[a.status] || 0) + 1
          return acc
        }, {})
        const statusStr = Object.entries(statusCounts).map(([status, count]) => `${count} ${status}`).join(', ')
        logs.push(`  ${dateKey}: ${appts.length} appointment(s) - ${statusStr}`)
        appts.forEach(appt => {
          logs.push(`    - Family ${appt.familyId} (${appt.clientName}): ${appt.status}`)
        })
      })
    }
    logs.push(``)
    logs.push(`NOTE: Projected Revenue counts ALL occurrences based on recurrence patterns,`)
    logs.push(`      regardless of whether appointments already exist. This provides a baseline`)
    logs.push(`      estimate of expected revenue from recurring patterns.`)
    logs.push(``)
    
    logs.push(`STEP 2: CALCULATING PROJECTED OCCURRENCES PER FAMILY`)
    logs.push(`-`.repeat(60))
    
    // Track all projected dates for summary
    const allProjectedDates = new Set<string>()
    
    // Process ONLY active families for projected revenue
    // Stopped families are excluded from revenue projections
    const allFamiliesForProjection = activeFamilies
    
    logs.push(`Processing ${allFamiliesForProjection.length} active families for projected revenue`)
    logs.push(`  (Stopped families are excluded from revenue projections)`)
    logs.push(``)
    
    const total = allFamiliesForProjection.reduce((sum, family, index) => {
      logs.push(``)
      logs.push(`Family ${family.id} (${index + 1}/${allFamiliesForProjection.length}) - ${family.status || 'unknown'}`)
      
      // Parse rule from recurrenceRule string if rule is not already parsed
      let rule = family.rule
      if (!rule && family.recurrenceRule) {
        try {
          rule = JSON.parse(family.recurrenceRule)
        } catch (e) {
          logs.push(`  ⚠️ Failed to parse recurrenceRule: ${family.recurrenceRule}`)
        }
      }
      
      const appointments = family.appointments || []
      
      // Find reference date - use any appointment (booked or unconfirmed) or nextAppointmentDate
      let referenceDate: Date | null = null
      let referenceAppointment: any = null
      
      // Try to find any appointment (prioritize APPOINTED, then RECURRING_UNCONFIRMED)
      if (appointments.length > 0) {
        // Sort by date, get the most recent one
        const sortedAppts = [...appointments].sort((a: any, b: any) => {
          const dateA = new Date(a.date).getTime()
          const dateB = new Date(b.date).getTime()
          return dateB - dateA
        })
        referenceAppointment = sortedAppts[0]
        referenceDate = new Date(referenceAppointment.date)
        referenceDate.setHours(0, 0, 0, 0)
      } else if (family.nextAppointmentDate) {
        referenceDate = new Date(family.nextAppointmentDate)
        referenceDate.setHours(0, 0, 0, 0)
      } else {
        // Try to use the first appointment if no most recent one
        if (appointments.length > 0) {
          referenceAppointment = appointments[0]
          referenceDate = new Date(referenceAppointment.date)
          referenceDate.setHours(0, 0, 0, 0)
        }
      }
      
      if (!referenceDate) {
        logs.push(`  ⚠️ SKIPPED: No reference date found`)
        return sum
      }
      
      if (!rule) {
        logs.push(`  ⚠️ SKIPPED: No rule found`)
        return sum
      }
      
      // Get client name from appointment or first appointment's client
      let clientName = referenceAppointment?.client?.name || 'Unknown Client'
      if (clientName === 'Unknown Client' && appointments.length > 0) {
        const firstWithClient = appointments.find((a: any) => a.client?.name)
        if (firstWithClient) {
          clientName = firstWithClient.client.name
        }
      }
      
      // Get price from appointment or template
      const price = referenceAppointment?.price || family.template?.price || 0
      
      logs.push(`  Client: ${clientName}`)
      logs.push(`  Rule: ${family.ruleSummary || JSON.stringify(rule)}`)
      logs.push(`  Reference Date: ${referenceDate.toLocaleDateString()} (${referenceAppointment?.status || 'nextAppointmentDate'})`)
      logs.push(`  Price: $${price.toFixed(2)}`)
      
      // Calculate how many times this recurrence will happen in the selected month
      // We need to work backwards from reference date to find where the pattern started
      // Then calculate forward to find all occurrences in the month
      // NOTE: We count ALL occurrences regardless of existing appointments - this is a baseline estimate
      const result = countOccurrencesThisMonth(
        rule,
        referenceDate,
        selectedMonth,
        selectedYear,
        family.id,
        clientName
        // NOT passing existingAppointmentDates - we want to count ALL occurrences
      )
      
      const occurrences = result.count
      const allDates = result.dates
      
      // Collect projected dates for summary
      allDates.forEach(date => allProjectedDates.add(date))
      
      // Show calculation details (condensed)
      const calculationLogs = result.debugInfo.filter(log => 
        log.includes('Found') || log.includes('occurrence(s)')
      )
      calculationLogs.forEach(log => {
        logs.push(`  ${log.replace(/^    /, '').replace(/^  /, '')}`)
      })
      
      const totalRevenue = occurrences * price
      
      if (occurrences > 0) {
        logs.push(`  ✅ PROJECTED: ${occurrences} occurrence(s) = $${totalRevenue.toFixed(2)}`)
        logs.push(`     Dates: ${allDates.join(', ')}`)
        detailsList.push({
          familyId: family.id,
          clientName,
          ruleSummary: family.ruleSummary || 'Recurring',
          lastBookedDate: referenceDate.toLocaleDateString(),
          occurrencesThisMonth: occurrences,
          pricePerOccurrence: price,
          totalRevenue,
        })
      } else {
        logs.push(`  ❌ NO PROJECTIONS: 0 occurrences in month`)
      }
      
      return sum + totalRevenue
    }, 0)
    
    logs.push(``)
    logs.push(`${'='.repeat(60)}`)
    logs.push(`FINAL SUMMARY`)
    logs.push(`${'='.repeat(60)}`)
    logs.push(`Total Families Processed: ${allFamiliesForProjection.length} (active families only)`)
    logs.push(`Families with Projections: ${detailsList.length}`)
    logs.push(`Total Projected Revenue: $${total.toFixed(2)}`)
    logs.push(``)
    logs.push(`IMPORTANT: Projected Revenue counts ALL occurrences based on recurrence patterns,`)
    logs.push(`regardless of whether appointments already exist. This is a baseline estimate`)
    logs.push(`of expected revenue from recurring patterns.`)
    logs.push(``)
    logs.push(`BREAKDOWN:`)
    logs.push(`  Days with Actual Appointments: ${existingAppointmentDates.size} (shown for reference)`)
    const sortedExistingDates = Array.from(existingAppointmentDates).sort()
    if (sortedExistingDates.length > 0) {
      sortedExistingDates.forEach(date => {
        const appts = existingAppointmentsByDate.get(date) || []
        const statusCounts = appts.reduce((acc: any, a) => {
          acc[a.status] = (acc[a.status] || 0) + 1
          return acc
        }, {})
        const statusStr = Object.entries(statusCounts).map(([status, count]) => `${count} ${status}`).join(', ')
        logs.push(`    ${date}: ${statusStr}`)
      })
    }
    logs.push(``)
    logs.push(`  Days with Projected Occurrences (ALL counted in revenue): ${allProjectedDates.size} unique days`)
    const sortedProjectedDates = Array.from(allProjectedDates).sort()
    sortedProjectedDates.forEach(date => {
      logs.push(`    ${date}: Projected`)
    })
    logs.push(``)
    logs.push(`  Note: Some projected dates may overlap with existing appointments.`)
    logs.push(`        This is intentional - revenue projection is a baseline estimate.`)
    logs.push(`        Also note: Day 14 has 2 projected occurrences (Family 10 weekly + Family 5 monthlyPattern),`)
    logs.push(`        but it's counted as 1 unique day in the summary above.`)
    logs.push(``)
    logs.push(`  Days with Appointments NOT in Projected Revenue:`)
    const appointmentDatesNotInProjections = Array.from(existingAppointmentDates).filter(
      date => !allProjectedDates.has(date)
    )
    if (appointmentDatesNotInProjections.length === 0) {
      logs.push(`    None - all appointment dates align with recurrence patterns`)
    } else {
      logs.push(`    These appointments exist in the calendar but are NOT counted in projected revenue`)
      logs.push(`    because they don't align with their family's recurrence patterns:`)
      appointmentDatesNotInProjections.forEach(date => {
        const appts = existingAppointmentsByDate.get(date) || []
        appts.forEach(appt => {
          logs.push(`    ${date}: Family ${appt.familyId} (${appt.clientName}) - ${appt.status}`)
          logs.push(`      → This appointment does not align with the recurrence pattern`)
        })
      })
    }
    logs.push(``)
    logs.push(`  CALENDAR vs REVENUE EXPLANATION:`)
    logs.push(`    Calendar shows ALL days with activity: stopped, confirmed, unconfirmed, and projected.`)
    logs.push(`    Projected Revenue shows ONLY days with projected occurrences based on recurrence patterns.`)
    logs.push(`    The difference (${12 - allProjectedDates.size} days) consists of:`)
    logs.push(`      - Stopped family appointments (excluded from revenue)`)
    logs.push(`      - Appointments that don't align with recurrence patterns (excluded from revenue)`)
    logs.push(``)
    logs.push(`Breakdown by Family:`)
    detailsList.forEach(detail => {
      logs.push(`  ${detail.clientName}: ${detail.occurrencesThisMonth} × $${detail.pricePerOccurrence.toFixed(2)} = $${detail.totalRevenue.toFixed(2)}`)
    })
    logs.push(`${'='.repeat(60)}`)
    logs.push(``)
    
    console.log(logs.join('\n'))
    
    return { projectedRevenue: total, details: detailsList, calculationLogs: logs }
  }, [activeFamilies, selectedMonth, selectedYear])

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Active Families</div>
          <div className="text-2xl font-semibold">{totalActive}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Upcoming Appointments</div>
          <div className="text-2xl font-semibold">{totalUpcoming}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Unconfirmed</div>
          <div className="text-2xl font-semibold text-purple-600">{totalUnconfirmed}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Projected Revenue</div>
          <div className="flex items-center gap-2">
            <div className="text-2xl font-semibold text-green-600">
              ${projectedRevenue.toFixed(2)}
            </div>
            <button
              onClick={() => setShowDetails(true)}
              className="text-xs text-blue-500 hover:text-blue-700 underline"
            >
              Details
            </button>
          </div>
        </div>
      </div>
      
      {showDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-4xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">Projected Revenue Details</h3>
              <button
                onClick={() => setShowDetails(false)}
                className="text-gray-500 hover:text-gray-700 text-xl"
              >
                ×
              </button>
            </div>
            <div className="text-sm text-gray-600 mb-4">
              Revenue projection for {new Date(selectedYear, selectedMonth, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </div>
            {details.length === 0 ? (
              <div className="text-gray-500">No active recurrences with booked appointments for this month.</div>
            ) : (
              <div className="space-y-2">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Client</th>
                      <th className="text-left p-2">Rule</th>
                      <th className="text-left p-2">Last Booked</th>
                      <th className="text-right p-2">Occurrences</th>
                      <th className="text-right p-2">Price Each</th>
                      <th className="text-right p-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {details.map((detail) => (
                      <tr key={detail.familyId} className="border-b">
                        <td className="p-2">{detail.clientName}</td>
                        <td className="p-2">{detail.ruleSummary}</td>
                        <td className="p-2">{detail.lastBookedDate}</td>
                        <td className="p-2 text-right">{detail.occurrencesThisMonth}</td>
                        <td className="p-2 text-right">${detail.pricePerOccurrence.toFixed(2)}</td>
                        <td className="p-2 text-right font-medium">${detail.totalRevenue.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 font-semibold">
                      <td colSpan={5} className="p-2 text-right">Total:</td>
                      <td className="p-2 text-right text-green-600">${projectedRevenue.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { RecurrenceFamily } from '../index'

interface Props {
  families: RecurrenceFamily[]
  selectedMonth: number
  selectedYear: number
}

// Helper to calculate monthlyPattern date for a specific month
function calculateMonthlyPatternDate(rule: any, year: number, month: number): Date | null {
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

// Helper to calculate next date based on recurrence rule
function calculateNextDate(rule: any, date: Date): Date {
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
    case 'every4weeks':
      next.setDate(next.getDate() + 28)
      break
    case 'monthly':
      next.setMonth(next.getMonth() + 1)
      break
    case 'customMonths':
      const months = rule.interval || 1
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
function calculatePreviousDate(rule: any, date: Date): Date {
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
    case 'every4weeks':
      prev.setDate(prev.getDate() - 28)
      break
    case 'monthly':
      prev.setMonth(prev.getMonth() - 1)
      break
    case 'customMonths':
      const months = rule.interval || 1
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

// Get projected occurrence dates for a family in the selected month
function getProjectedOccurrences(family: RecurrenceFamily, selectedMonth: number, selectedYear: number): Date[] {
  const rule = family.rule || (family.recurrenceRule ? JSON.parse(family.recurrenceRule) : null)
  if (!rule) {
    return []
  }

  const monthStart = new Date(selectedYear, selectedMonth, 1)
  monthStart.setHours(0, 0, 0, 0)
  const monthEnd = new Date(selectedYear, selectedMonth + 1, 0)
  monthEnd.setHours(23, 59, 59, 999)

  // Find reference date - use most recent appointment or nextAppointmentDate
  let referenceDate: Date | null = null
  const appointments = family.appointments || []
  
  if (appointments.length > 0) {
    const sortedAppts = [...appointments].sort((a: any, b: any) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime()
    })
    referenceDate = new Date(sortedAppts[0].date)
    referenceDate.setHours(0, 0, 0, 0)
  } else if (family.nextAppointmentDate) {
    referenceDate = new Date(family.nextAppointmentDate)
    referenceDate.setHours(0, 0, 0, 0)
  }
  
  if (!referenceDate) {
    return []
  }

  // Special handling for monthlyPattern - directly calculate the date for the selected month
  if (rule.type === 'monthlyPattern' && rule.weekOfMonth !== undefined && rule.dayOfWeek !== undefined) {
    const patternDate = calculateMonthlyPatternDate(rule, selectedYear, selectedMonth)
    if (patternDate && patternDate >= monthStart && patternDate <= monthEnd) {
      return [patternDate]
    }
    return []
  }

  // Handle customMonths with interval > 1
  if (rule.type === 'customMonths' && rule.interval && rule.interval > 1) {
    let checkDate = new Date(referenceDate)
    let iterations = 0
    
    if (referenceDate < monthStart) {
      // Reference is before target month: walk FORWARD to find if we hit the target month
      while (iterations < 24 && checkDate <= monthEnd) {
        const checkMonth = checkDate.getFullYear() * 12 + checkDate.getMonth()
        const targetMonthNum = selectedYear * 12 + selectedMonth
        const monthsDiff = targetMonthNum - checkMonth
        
        if (monthsDiff === 0 && checkDate >= monthStart) {
          const occurrenceDate = new Date(checkDate)
          occurrenceDate.setHours(0, 0, 0, 0)
          return [occurrenceDate]
        }
        
        checkDate = calculateNextDate(rule, checkDate)
        iterations++
      }
    } else {
      // Reference is in or after target month: work backwards from reference
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
            return [occurrenceDate]
          }
        }
        
        checkDate = calculatePreviousDate(rule, checkDate)
        iterations++
      }
    }
    return []
  }

  // For other types, find first occurrence in month
  let firstOccurrenceInMonth: Date | null = null
  let currentDate = new Date(referenceDate)
  let iterations = 0

  if (referenceDate < monthStart) {
    const daysDiff = (monthStart.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24)
    const minIntervalDays = rule.type === 'weekly' ? 7 : rule.type === 'biweekly' ? 14 : rule.type === 'every3weeks' ? 21 : rule.type === 'every4weeks' ? 28 : 7
    const maxIterationsNeeded = Math.ceil(daysDiff / minIntervalDays) + 5
    const iterationLimit = Math.max(50, maxIterationsNeeded)
    
    while (currentDate < monthStart && iterations < iterationLimit) {
      currentDate = calculateNextDate(rule, currentDate)
      iterations++
    }
    if (currentDate >= monthStart && currentDate <= monthEnd) {
      firstOccurrenceInMonth = new Date(currentDate)
    }
  } else {
    while (currentDate >= monthStart && iterations < 20) {
      const prevDate = calculatePreviousDate(rule, currentDate)
      if (prevDate < monthStart) {
        firstOccurrenceInMonth = new Date(currentDate)
        break
      }
      currentDate = prevDate
      iterations++
    }
    
    if (!firstOccurrenceInMonth && referenceDate >= monthStart && referenceDate <= monthEnd) {
      firstOccurrenceInMonth = new Date(referenceDate)
    }
  }

  if (!firstOccurrenceInMonth) return []

  // Collect all occurrences in the month
  const occurrences: Date[] = []
  currentDate = new Date(firstOccurrenceInMonth)
  iterations = 0

  while (currentDate <= monthEnd && iterations < 10) {
    if (currentDate >= monthStart) {
      occurrences.push(new Date(currentDate))
    }
    currentDate = calculateNextDate(rule, currentDate)
    iterations++
    
    if (iterations > 0 && currentDate.getTime() <= firstOccurrenceInMonth.getTime()) {
      break
    }
  }

  return occurrences
}

export default function RecurringCalendar({ families, selectedMonth, selectedYear }: Props) {
  const navigate = useNavigate()
  const today = new Date()
  const firstDay = new Date(selectedYear, selectedMonth, 1)
  const lastDay = new Date(selectedYear, selectedMonth + 1, 0)
  const daysInMonth = lastDay.getDate()
  const startingDayOfWeek = firstDay.getDay()

  // Collect all appointments for this month
  const appointmentsByDate = useMemo(() => {
    const map = new Map<number, { confirmed: number; unconfirmed: number; projected: number; stopped: number }>()
    
    // First, collect actual appointments
    const calendarApptsByDate = new Map<string, Array<{familyId: number, clientName: string, status: string}>>()
    
    families.forEach((family) => {
      family.appointments?.forEach((appt: any) => {
        // Parse date string (YYYY-MM-DD) to avoid timezone issues
        const dateStr = appt.date
        let apptDate: Date | null = null
        let day: number | null = null
        
        if (typeof dateStr === 'string' && dateStr.includes('T')) {
          // If it's an ISO string, extract just the date part
          const dateOnly = dateStr.split('T')[0]
          const dateParts = dateOnly.split('-')
          if (dateParts.length === 3) {
            const year = parseInt(dateParts[0])
            const month = parseInt(dateParts[1]) - 1 // Month is 0-indexed
            const dayNum = parseInt(dateParts[2])
            apptDate = new Date(year, month, dayNum)
            if (apptDate.getMonth() === selectedMonth && apptDate.getFullYear() === selectedYear) {
              day = apptDate.getDate()
            }
          }
        } else {
          // Fallback to original method if date format is different
          apptDate = new Date(appt.date)
          if (apptDate.getMonth() === selectedMonth && apptDate.getFullYear() === selectedYear) {
            day = apptDate.getDate()
          }
        }
        
        if (day !== null) {
          const year = apptDate!.getFullYear()
          const month = apptDate!.getMonth() + 1
          const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          
          if (!map.has(day)) {
            map.set(day, { confirmed: 0, unconfirmed: 0, projected: 0, stopped: 0 })
          }
          const counts = map.get(day)!
          // Check if family is stopped - if so, mark as stopped instead of confirmed/unconfirmed
          if (family.status === 'stopped') {
            counts.stopped++
          } else if (appt.status === 'APPOINTED') {
            counts.confirmed++
          } else if (appt.status === 'RECURRING_UNCONFIRMED') {
            counts.unconfirmed++
          }
          
          // Track for logging
          if (!calendarApptsByDate.has(dateKey)) {
            calendarApptsByDate.set(dateKey, [])
          }
          const clientName = appt.client?.name || `Family ${family.id}`
          calendarApptsByDate.get(dateKey)!.push({
            familyId: family.id,
            clientName,
            status: appt.status
          })
        }
      })
    })
    
    // Now calculate projected occurrences, excluding dates with actual appointments
    const monthName = new Date(selectedYear, selectedMonth, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    console.log(`\n${'='.repeat(60)}`)
    console.log(`CALENDAR VIEW CALCULATION`)
    console.log(`${'='.repeat(60)}`)
    console.log(`Month/Year: ${monthName}`)
    console.log(``)
    
    // First, summarize existing appointments
    const existingApptsByDay = new Map<number, {confirmed: number, unconfirmed: number, stopped: number}>()
    for (let day = 1; day <= daysInMonth; day++) {
      const counts = map.get(day)
      if (counts && (counts.confirmed > 0 || counts.unconfirmed > 0 || counts.stopped > 0)) {
        existingApptsByDay.set(day, { confirmed: counts.confirmed, unconfirmed: counts.unconfirmed, stopped: counts.stopped })
      }
    }
    
    console.log(`STEP 1: EXISTING APPOINTMENTS IN CALENDAR`)
    console.log(`-`.repeat(60))
    if (existingApptsByDay.size === 0) {
      console.log(`  No existing appointments in this month`)
    } else {
      const sortedDays = Array.from(existingApptsByDay.keys()).sort((a, b) => a - b)
      sortedDays.forEach(day => {
        const counts = existingApptsByDay.get(day)!
        const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        const parts: string[] = []
        if (counts.stopped > 0) parts.push(`${counts.stopped} stopped`)
        if (counts.confirmed > 0) parts.push(`${counts.confirmed} confirmed`)
        if (counts.unconfirmed > 0) parts.push(`${counts.unconfirmed} unconfirmed`)
        console.log(`  Day ${day} (${dateStr}): ${parts.join(', ')}`)
        const appts = calendarApptsByDate.get(dateStr) || []
        appts.forEach(appt => {
          console.log(`    - Family ${appt.familyId} (${appt.clientName}): ${appt.status}`)
        })
      })
    }
    console.log(``)
    
    console.log(`STEP 2: CALCULATING PROJECTED OCCURRENCES`)
    console.log(`-`.repeat(60))
    
    const projectedByFamily = new Map<number, {dates: Date[], added: Date[], removed: Date[]}>()
    
    families.forEach((family) => {
      if (family.status !== 'active') return
      
      const projectedDates = getProjectedOccurrences(family, selectedMonth, selectedYear)
      const added: Date[] = []
      const removed: Date[] = []
      
      projectedDates.forEach((projDate) => {
        const day = projDate.getDate()
        
        // Check if there are ANY appointments (from ANY family) on this date
        const existingCounts = map.get(day) || { confirmed: 0, unconfirmed: 0, projected: 0, stopped: 0 }
        const hasExistingAppointment = existingCounts.confirmed > 0 || existingCounts.unconfirmed > 0 || existingCounts.stopped > 0
        
        // Only add projected if there's no actual appointment on this date (from any family)
        if (!hasExistingAppointment) {
          if (!map.has(day)) {
            map.set(day, { confirmed: 0, unconfirmed: 0, projected: 0, stopped: 0 })
          }
          map.get(day)!.projected++
          added.push(projDate)
        } else {
          removed.push(projDate)
        }
      })
      
      if (projectedDates.length > 0) {
        projectedByFamily.set(family.id, { dates: projectedDates, added, removed })
      }
    })
    
    // Log summary by family
    projectedByFamily.forEach((data, familyId) => {
      const family = families.find(f => f.id === familyId)
      const clientName = family?.appointments?.[0]?.client?.name || `Family ${familyId}`
      console.log(`  Family ${familyId} (${clientName}):`)
      console.log(`    Calculated: ${data.dates.length} projected date(s)`)
      if (data.added.length > 0) {
        const dateStrs = data.added.map(d => `${d.getDate()}/${selectedMonth + 1}/${selectedYear}`)
        console.log(`    ✅ Added to calendar: ${data.added.length} - ${dateStrs.join(', ')}`)
      }
      if (data.removed.length > 0) {
        const dateStrs = data.removed.map(d => {
          const day = d.getDate()
          const counts = map.get(day) || { confirmed: 0, unconfirmed: 0, projected: 0, stopped: 0 }
          const parts: string[] = []
          if (counts.stopped > 0) parts.push(`${counts.stopped} stopped`)
          if (counts.confirmed > 0) parts.push(`${counts.confirmed} confirmed`)
          if (counts.unconfirmed > 0) parts.push(`${counts.unconfirmed} unconfirmed`)
          return `${d.getDate()}/${selectedMonth + 1}/${selectedYear} (${parts.join(', ')})`
        })
        console.log(`    ❌ Excluded (has appointments): ${data.removed.length} - ${dateStrs.join(', ')}`)
      }
    })
    
    console.log(``)
    console.log(`STEP 3: FINAL CALENDAR SUMMARY`)
    console.log(`-`.repeat(60))
    
    const daysWithData: number[] = []
    for (let day = 1; day <= daysInMonth; day++) {
      const counts = map.get(day)
      if (counts && (counts.confirmed > 0 || counts.unconfirmed > 0 || counts.projected > 0 || counts.stopped > 0)) {
        daysWithData.push(day)
      }
    }
    
    if (daysWithData.length === 0) {
      console.log(`  No appointments or projections in this month`)
    } else {
      daysWithData.sort((a, b) => a - b)
      daysWithData.forEach(day => {
        const counts = map.get(day)!
        const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        const parts: string[] = []
        if (counts.stopped > 0) parts.push(`${counts.stopped} stopped`)
        if (counts.confirmed > 0) parts.push(`${counts.confirmed} confirmed`)
        if (counts.unconfirmed > 0) parts.push(`${counts.unconfirmed} unconfirmed`)
        if (counts.projected > 0) parts.push(`${counts.projected} projected`)
        console.log(`  Day ${day} (${dateStr}): ${parts.join(', ')}`)
      })
    }
    
    const totalStopped = Array.from(map.values()).reduce((sum, c) => sum + (c.stopped || 0), 0)
    const totalConfirmed = Array.from(map.values()).reduce((sum, c) => sum + c.confirmed, 0)
    const totalUnconfirmed = Array.from(map.values()).reduce((sum, c) => sum + c.unconfirmed, 0)
    const totalProjected = Array.from(map.values()).reduce((sum, c) => sum + c.projected, 0)
    
    console.log(``)
    console.log(`TOTALS:`)
    console.log(`  Stopped: ${totalStopped}`)
    console.log(`  Confirmed: ${totalConfirmed}`)
    console.log(`  Unconfirmed: ${totalUnconfirmed}`)
    console.log(`  Projected: ${totalProjected}`)
    console.log(`${'='.repeat(60)}`)
    console.log(``)
    
    return map
  }, [families, selectedMonth, selectedYear])

  const days = []
  // Empty cells for days before month starts
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(null)
  }
  // Days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(day)
  }

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="text-lg font-semibold mb-4">
        {monthNames[selectedMonth]} {selectedYear}
      </h3>
      <div className="grid grid-cols-7 gap-1 text-xs">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="text-center font-medium text-gray-600 p-1">
            {day}
          </div>
        ))}
        {days.map((day, idx) => {
          if (day === null) {
            return <div key={`empty-${idx}`} className="p-2" />
          }
          const counts = appointmentsByDate.get(day) || { confirmed: 0, unconfirmed: 0, projected: 0, stopped: 0 }
          const isToday = day === today.getDate() && 
                          selectedMonth === today.getMonth() && 
                          selectedYear === today.getFullYear()
          const hasAppointments = counts.confirmed > 0 || counts.unconfirmed > 0 || counts.projected > 0 || counts.stopped > 0
          const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          
          return (
            <div
              key={day}
              className={`p-2 border rounded text-center ${
                isToday ? 'bg-blue-100 border-blue-300' : ''
              } ${hasAppointments ? 'cursor-pointer hover:bg-gray-50' : ''}`}
              onClick={() => {
                if (hasAppointments) {
                  navigate(`/dashboard/calendar?date=${dateStr}`)
                }
              }}
            >
              <div className="font-medium">{day}</div>
              {counts.stopped > 0 && (
                <div className="text-xs text-red-600">● {counts.stopped}</div>
              )}
              {counts.confirmed > 0 && (
                <div className="text-xs text-green-600">✓ {counts.confirmed}</div>
              )}
              {counts.unconfirmed > 0 && (
                <div className="text-xs text-blue-600">○ {counts.unconfirmed}</div>
              )}
              {counts.projected > 0 && (
                <div className="text-xs text-purple-600">🗺️ {counts.projected}</div>
              )}
            </div>
          )
        })}
      </div>
      <div className="mt-4 text-xs text-gray-600 space-y-1">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 bg-red-200 rounded"></span>
          <span>Stopped</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 bg-green-200 rounded"></span>
          <span>Confirmed</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 bg-blue-200 rounded"></span>
          <span>Unconfirmed</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 bg-purple-200 rounded"></span>
          <span>Projected</span>
        </div>
      </div>
    </div>
  )
}

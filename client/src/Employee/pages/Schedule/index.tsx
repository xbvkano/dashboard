import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { API_BASE_URL } from '../../../api'
import { useEmployeeLanguage } from '../../EmployeeLanguageContext'

type DayShifts = {
  morning: boolean
  afternoon: boolean
  morningStatus?: 'F' | 'B' | null // null means not saved yet
  afternoonStatus?: 'F' | 'B' | null
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, date.getDate())
}

function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  )
}

function isBefore(date1: Date, date2: Date): boolean {
  return date1 < date2 && !isSameDay(date1, date2)
}

function getDaysFromToday(): (Date & { isNextMonth?: boolean })[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const days: (Date & { isNextMonth?: boolean })[] = []
  const currentMonth = today.getMonth()
  const currentYear = today.getFullYear()
  
  // Add today (for display, but not selectable)
  const todayWithFlag = Object.assign(new Date(today), { isNextMonth: false })
  days.push(todayWithFlag)
  
  // Add next 14 days (starting from tomorrow)
  for (let i = 1; i <= 14; i++) {
    const date = new Date(currentYear, currentMonth, today.getDate() + i)
    const isNextMonth = date.getMonth() !== currentMonth
    const dayWithFlag = Object.assign(date, { isNextMonth })
    days.push(dayWithFlag)
  }
  
  return days
}

function getDaysInMonth(date: Date): (Date | null)[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const start = startOfMonth(date)
  const end = endOfMonth(date)
  const startDay = start.getDay()
  const days: (Date | null)[] = []
  
  // Add empty cells for days before month starts
  for (let i = 0; i < startDay; i++) {
    days.push(null)
  }
  
  // Add all days in the month
  for (let d = 1; d <= end.getDate(); d++) {
    days.push(new Date(date.getFullYear(), date.getMonth(), d))
  }
  
  return days
}

// Parse schedule string: YYYY-MM-DD-T-S
function parseScheduleEntry(entry: string): { date: string; type: 'M' | 'A'; status: 'F' | 'B' } | null {
  const parts = entry.split('-')
  if (parts.length !== 5) return null
  const [year, month, day, type, status] = parts
  if ((type !== 'M' && type !== 'A') || (status !== 'F' && status !== 'B')) return null
  return {
    date: `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`,
    type: type as 'M' | 'A',
    status: status as 'F' | 'B'
  }
}

// Convert schedule entries to DayShifts format with status tracking
function scheduleToDayShifts(futureSchedule: string[]): Record<string, DayShifts> {
  const result: Record<string, DayShifts> = {}
  
  futureSchedule.forEach(entry => {
    const parsed = parseScheduleEntry(entry)
    if (!parsed) return
    
    if (!result[parsed.date]) {
      result[parsed.date] = { 
        morning: false, 
        afternoon: false,
        morningStatus: null,
        afternoonStatus: null
      }
    }
    
    if (parsed.type === 'M') {
      result[parsed.date].morning = true
      result[parsed.date].morningStatus = parsed.status
    } else if (parsed.type === 'A') {
      result[parsed.date].afternoon = true
      result[parsed.date].afternoonStatus = parsed.status
    }
  })
  
  return result
}

// Get new additions: shifts in schedule that are not in savedSchedule, grouped by date
function getNewAdditionsGrouped(
  schedule: Record<string, DayShifts>,
  savedSchedule: Record<string, DayShifts>
): Array<{ dateStr: string; shifts: ('morning' | 'afternoon')[] }> {
  const byDate: Record<string, ('morning' | 'afternoon')[]> = {}
  Object.entries(schedule).forEach(([dateStr, shifts]) => {
    const saved = savedSchedule[dateStr]
    const savedMorning = saved?.morning && saved.morningStatus != null
    const savedAfternoon = saved?.afternoon && saved.afternoonStatus != null
    const adds: ('morning' | 'afternoon')[] = []
    if (shifts.morning && !savedMorning) adds.push('morning')
    if (shifts.afternoon && !savedAfternoon) adds.push('afternoon')
    if (adds.length > 0) {
      byDate[dateStr] = adds
    }
  })
  return Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateStr, shifts]) => ({ dateStr, shifts }))
}

type SchedulePolicy = { updateDayOfWeek: number; supervisorNotifyAfterDays: number; stopRemindingAfterDays: number }

function InformationSection({
  policy,
  nextUpdateDueDateFormatted,
}: {
  policy: SchedulePolicy | null
  nextUpdateDueDateFormatted: string | null
}) {
  const [isOpen, setIsOpen] = useState(false)
  const { t } = useEmployeeLanguage()
  const updateDayName = t.dayNamesLong?.[policy?.updateDayOfWeek ?? 0] ?? String(policy?.updateDayOfWeek ?? '')
  const policySummaryText = policy
    ? t.policySummary
        .replace('{updateDay}', updateDayName)
        .replace('{supervisorDays}', String(policy.supervisorNotifyAfterDays))
        .replace('{stopDays}', String(policy.stopRemindingAfterDays))
    : t.policySummary
        .replace('{updateDay}', t.policyUpdateDayPlaceholder)
        .replace('{supervisorDays}', t.policySupervisorDaysPlaceholder)
        .replace('{stopDays}', t.policyStopDaysPlaceholder)
  return (
    <div className="mb-5 border border-slate-200 rounded-xl overflow-hidden bg-white">
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
      >
        <span>{t.information}</span>
        <svg
          className={`w-5 h-5 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="px-4 pb-4 pt-0 text-sm text-slate-600 space-y-4 border-t border-slate-100">
          <div>
            <h4 className="font-semibold text-slate-700 mb-1 flex items-center gap-2">
              <span className="w-4 h-4 bg-slate-100 rounded border border-slate-300 shrink-0 inline-block" />
              {t.open}
            </h4>
            <p>{t.openDesc}</p>
          </div>
          <div>
            <h4 className="font-semibold text-slate-700 mb-1 flex items-center gap-2">
              <span className="w-4 h-4 bg-blue-500 rounded border border-blue-600 shrink-0 inline-block" />
              {t.selectedNotSaved}
            </h4>
            <p>{t.selectedNotSavedDesc}</p>
          </div>
          <div>
            <h4 className="font-semibold text-slate-700 mb-1 flex items-center gap-2">
              <span className="w-4 h-4 bg-violet-600 rounded border border-violet-700 shrink-0 inline-block" />
              {t.availability}
            </h4>
            <p>{t.availabilityDesc}</p>
          </div>
          <div>
            <h4 className="font-semibold text-slate-700 mb-1 flex items-center gap-2">
              <span className="w-4 h-4 bg-amber-500 rounded border border-amber-600 shrink-0 inline-block" />
              {t.legendUnconfirmed}
            </h4>
            <p>{t.unconfirmedDesc}</p>
          </div>
          <div>
            <h4 className="font-semibold text-slate-700 mb-1 flex items-center gap-2">
              <span className="w-4 h-4 bg-emerald-600 rounded border border-emerald-700 shrink-0 inline-block" />
              {t.scheduled}
            </h4>
            <p>{t.scheduledDesc}</p>
          </div>
          <div className="pt-2 border-t border-slate-100">
            <h4 className="font-semibold text-slate-700 mb-2">{t.scheduleUpdatePolicy}</h4>
            {nextUpdateDueDateFormatted && (
              <p className="text-slate-700 font-medium mb-2">
                {t.policyNextUpdateDate.replace('{date}', nextUpdateDueDateFormatted)}
              </p>
            )}
            <p className="text-slate-600">{policySummaryText}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// Convert DayShifts to schedule entries
function dayShiftsToSchedule(schedule: Record<string, DayShifts>): string[] {
  const entries: string[] = []
  
  Object.entries(schedule).forEach(([dateStr, shifts]) => {
    if (shifts.morning) {
      entries.push(`${dateStr}-M-F`)
    }
    if (shifts.afternoon) {
      entries.push(`${dateStr}-A-F`)
    }
  })
  
  // Sort by date
  return entries.sort()
}

export default function Schedule() {
  const { t, locale } = useEmployeeLanguage()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const [schedule, setSchedule] = useState<Record<string, DayShifts>>({})
  const [savedSchedule, setSavedSchedule] = useState<Record<string, DayShifts>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [nextScheduleUpdateDueAt, setNextScheduleUpdateDueAt] = useState<string | null>(null) // YYYY-MM-DD
  const [schedulePolicy, setSchedulePolicy] = useState<SchedulePolicy | null>(null)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [scheduledByDay, setScheduledByDay] = useState<Record<string, { morning: boolean; afternoon: boolean; morningUnconfirmed?: boolean; afternoonUnconfirmed?: boolean }>>({})

  // Load existing schedule, upcoming appointments, and schedule policy
  useEffect(() => {
    loadSchedule()
    loadUpcomingAppointments()
    loadSchedulePolicy()
  }, [])

  async function loadSchedulePolicy() {
    try {
      const userName = localStorage.getItem('userName')
      const headers: HeadersInit = { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' }
      if (userName) headers['x-user-name'] = userName
      const res = await fetch(`${API_BASE_URL}/employee/schedule-policy`, { headers })
      if (!res.ok) return
      const data = await res.json()
      setSchedulePolicy({
        updateDayOfWeek: data.updateDayOfWeek ?? 0,
        supervisorNotifyAfterDays: data.supervisorNotifyAfterDays ?? 4,
        stopRemindingAfterDays: data.stopRemindingAfterDays ?? 7,
      })
    } catch {
      // ignore
    }
  }

  async function loadUpcomingAppointments() {
    try {
      const userName = localStorage.getItem('userName')
      const headers: HeadersInit = { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' }
      if (userName) headers['x-user-name'] = userName
      const res = await fetch(`${API_BASE_URL}/employee/upcoming-appointments`, { headers })
      if (!res.ok) return
      const list = await res.json()
      const byDay: Record<string, { morning: boolean; afternoon: boolean; morningUnconfirmed?: boolean; afternoonUnconfirmed?: boolean }> = {}
      list.forEach((a: { date: string; block: 'AM' | 'PM'; confirmed?: boolean }) => {
        if (!byDay[a.date]) byDay[a.date] = { morning: false, afternoon: false }
        if (a.block === 'AM') {
          byDay[a.date].morning = true
          if (a.confirmed === false) byDay[a.date].morningUnconfirmed = true
        } else {
          byDay[a.date].afternoon = true
          if (a.confirmed === false) byDay[a.date].afternoonUnconfirmed = true
        }
      })
      setScheduledByDay(byDay)
    } catch {
      // ignore
    }
  }

  async function loadSchedule() {
    try {
      setLoading(true)
      const userName = localStorage.getItem('userName')
      const headers: HeadersInit = { 'Content-Type': 'application/json', "ngrok-skip-browser-warning": "1" }
      if (userName) {
        headers['x-user-name'] = userName
      }
      
      const response = await fetch(`${API_BASE_URL}/employee/schedule`, { headers })
      if (!response.ok) throw new Error(t.failedToLoad)
      const data = await response.json()
      
      if (data?.futureSchedule && Array.isArray(data.futureSchedule)) {
        const dayShifts = scheduleToDayShifts(data.futureSchedule)
        setSavedSchedule(dayShifts) // Store saved schedule separately
        setSchedule(dayShifts) // Also set as current schedule
      }
      if (data?.employeeUpdate) {
        setLastUpdate(new Date(data.employeeUpdate))
      }
      if (data?.nextScheduleUpdateDueAt) {
        const d = new Date(data.nextScheduleUpdateDueAt)
        setNextScheduleUpdateDueAt(getDayKey(d))
      } else {
        setNextScheduleUpdateDueAt(null)
      }
    } catch (err) {
      console.error('Failed to load schedule:', err)
    } finally {
      setLoading(false)
    }
  }

  function getDayKey(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  function toggleShift(date: Date, shift: 'morning' | 'afternoon') {
    if (isBefore(date, today)) return // Can't modify past days
    if (isSameDay(date, today)) return // Can't modify today
    
    const key = getDayKey(date)
    const savedEntry = savedSchedule[key]
    
    // Check if this shift is already saved - if so, don't allow deselection
    if (shift === 'morning' && savedEntry?.morning && savedEntry.morningStatus !== null) {
      return // Can't deselect saved morning shift
    }
    if (shift === 'afternoon' && savedEntry?.afternoon && savedEntry.afternoonStatus !== null) {
      return // Can't deselect saved afternoon shift
    }
    
    setSchedule(prev => ({
      ...prev,
      [key]: {
        morning: shift === 'morning' ? !prev[key]?.morning : prev[key]?.morning ?? false,
        afternoon: shift === 'afternoon' ? !prev[key]?.afternoon : prev[key]?.afternoon ?? false,
        // Preserve status if it exists, otherwise set to null (unsaved)
        morningStatus: shift === 'morning' 
          ? (savedEntry?.morningStatus ?? null)
          : (prev[key]?.morningStatus ?? savedEntry?.morningStatus ?? null),
        afternoonStatus: shift === 'afternoon'
          ? (savedEntry?.afternoonStatus ?? null)
          : (prev[key]?.afternoonStatus ?? savedEntry?.afternoonStatus ?? null),
      }
    }))
  }

  function handleSaveClick() {
    setShowConfirmModal(true)
  }

  async function performSave() {
    setShowConfirmModal(false)
    try {
      setSaving(true)
      setError('')
      setSuccess('')
      
      const scheduleEntries = dayShiftsToSchedule(schedule)
      const userName = localStorage.getItem('userName')
      const headers: HeadersInit = { 'Content-Type': 'application/json', "ngrok-skip-browser-warning": "1" }
      if (userName) {
        headers['x-user-name'] = userName
      }
      
      const response = await fetch(`${API_BASE_URL}/employee/schedule`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ futureSchedule: scheduleEntries }),
      })
      
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || t.failedToSave)
      }
      
      setSuccess(t.scheduleSaved)
      setTimeout(() => setSuccess(''), 3000)
      await loadSchedule()
    } catch (err: any) {
      setError(err.message || t.failedToSave)
    } finally {
      setSaving(false)
    }
  }
  
  const DAY_MS = 86400000
  function getDaysPastDue(): number | null {
    if (!schedulePolicy) return null
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    if (nextScheduleUpdateDueAt) {
      const [y, m, d] = nextScheduleUpdateDueAt.split('-').map(Number)
      const dueDate = new Date(y, m - 1, d).getTime()
      if (todayStart <= dueDate) return null
      return Math.floor((todayStart - dueDate) / DAY_MS)
    }
    const lastDue = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    while (lastDue.getDay() !== schedulePolicy.updateDayOfWeek) {
      lastDue.setDate(lastDue.getDate() - 1)
    }
    const lastDueStart = lastDue.getTime()
    if (lastUpdate) {
      const lastUpdateStart = new Date(lastUpdate.getFullYear(), lastUpdate.getMonth(), lastUpdate.getDate()).getTime()
      if (lastUpdateStart >= lastDueStart) return null
    }
    return Math.floor((todayStart - lastDueStart) / DAY_MS)
  }

  const daysPastDue = getDaysPastDue()
  const showUpdateReminder = schedulePolicy && daysPastDue != null && daysPastDue >= 1 && daysPastDue <= schedulePolicy.stopRemindingAfterDays
  const updateDayName = schedulePolicy != null ? (t.dayNamesLong?.[schedulePolicy.updateDayOfWeek] ?? '') : ''

  function getDayStyle(date: Date): string {
    const key = getDayKey(date)
    const isUpdateDueDate = nextScheduleUpdateDueAt != null && key === nextScheduleUpdateDueAt
    if (isBefore(date, today)) {
      return isUpdateDueDate ? 'bg-slate-200 text-slate-400 ring-2 ring-amber-500 ring-inset' : 'bg-slate-200 text-slate-400'
    }
    if (isSameDay(date, today)) {
      return isUpdateDueDate ? 'bg-blue-100 text-blue-900 ring-2 ring-amber-500 ring-inset' : 'bg-blue-100 text-blue-900'
    }
    const daysDiff = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    if (daysDiff >= 1 && daysDiff <= 14) {
      return isUpdateDueDate ? 'bg-amber-100 text-amber-900 ring-2 ring-amber-500' : 'bg-amber-50 text-amber-900'
    }
    return isUpdateDueDate ? 'bg-amber-50 text-amber-900 ring-2 ring-amber-500' : 'bg-white text-slate-900'
  }

  function canSelect(date: Date): boolean {
    return !isBefore(date, today) && !isSameDay(date, today)
  }

  // Get days starting from today (up to 14 days)
  const daysFromToday = getDaysFromToday()
  
  // Group days by week for display
  const weeks: ((Date & { isNextMonth?: boolean }) | null)[][] = []
  let currentWeek: ((Date & { isNextMonth?: boolean }) | null)[] = []
  
  // Add empty cells to align first day with its weekday
  const firstDay = daysFromToday[0]
  const firstDayOfWeek = firstDay.getDay()
  for (let i = 0; i < firstDayOfWeek; i++) {
    currentWeek.push(null)
  }
  
  // Add all days from today
  daysFromToday.forEach(day => {
    currentWeek.push(day)
    if (currentWeek.length === 7) {
      weeks.push(currentWeek)
      currentWeek = []
    }
  })
  
  // Fill remaining week if needed
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push(null)
    }
    weeks.push(currentWeek)
  }
  
  // Flatten weeks for grid display
  const days = weeks.flat()
  
  const monthName = today.toLocaleDateString(locale, { month: 'long', year: 'numeric' })
  const hasNextMonthDays = daysFromToday.some(d => d.isNextMonth)

  const newAdditionsGrouped = getNewAdditionsGrouped(schedule, savedSchedule)
  const formatDateDisplay = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-')
    const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
    return date.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' })
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh]">
        <h1 className="text-xl font-semibold text-slate-800 mb-2">{t.mySchedule}</h1>
        <div className="text-slate-500">{t.loading}</div>
      </div>
    )
  }

  return (
    <div className="pb-4">
      <h1 className="text-xl md:text-2xl font-semibold text-slate-800 mb-1">{t.mySchedule}</h1>
      <p className="text-sm text-slate-500 mb-4">{t.subtitle}</p>
      
      {/* Information dropdown */}
      <InformationSection
        policy={schedulePolicy}
        nextUpdateDueDateFormatted={
          nextScheduleUpdateDueAt
            ? (() => {
                const [y, m, d] = nextScheduleUpdateDueAt.split('-').map(Number)
                return new Date(y, m - 1, d).toLocaleDateString(locale, {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })
              })()
            : null
        }
      />

      {/* Supervisor note */}
      <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
        <strong>{t.removeAvailabilityNote}</strong>
      </div>

      {/* Schedule update reminder (when policy says they should update) */}
      {showUpdateReminder && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm font-medium text-amber-800">
          {t.scheduleUpdateReminder.replace('{updateDay}', updateDayName)}
        </div>
      )}

      {/* Calendar card */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-5">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-base font-medium text-slate-700">{monthName}</h2>
          {hasNextMonthDays && (
            <span className="text-xs text-slate-500 ml-1">{t.next14Days}</span>
          )}
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-0.5 md:gap-1 px-2 pt-2">
          {t.weekdays.map(day => (
            <div key={day} className="text-center text-[10px] md:text-xs font-semibold text-slate-500 py-1">
              {day.slice(0, 2)}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7 gap-0.5 md:gap-1 p-2">
          {days.map((date, idx) => {
            if (!date) {
              return <div key={idx} className="aspect-square min-h-[3.5rem]" />
            }
            
            const key = getDayKey(date)
            const daySchedule = schedule[key] || { morning: false, afternoon: false }
            const canSelectDay = canSelect(date)
            const isNextMonth = (date as any).isNextMonth
            const scheduledMorning = scheduledByDay[key]?.morning ?? false
            const scheduledAfternoon = scheduledByDay[key]?.afternoon ?? false
            const unconfirmedMorning = scheduledByDay[key]?.morningUnconfirmed ?? false
            const unconfirmedAfternoon = scheduledByDay[key]?.afternoonUnconfirmed ?? false
            
            return (
              <div
                key={idx}
                className={`aspect-square min-h-[3.5rem] border rounded-lg p-1 flex flex-col transition-colors ${
                  isNextMonth ? 'border-dashed border-slate-300' : 'border-slate-200'
                } ${getDayStyle(date)}`}
              >
                <div className="text-[10px] md:text-xs font-semibold mb-0.5 text-center flex items-center justify-center gap-0.5">
                  <span>{date.getDate()}</span>
                  {isNextMonth && (
                    <span className="text-[8px] text-slate-400 font-normal">→</span>
                  )}
                </div>
                {isNextMonth && (
                  <div className="text-[8px] text-slate-500 text-center mb-0.5">
                    {date.toLocaleDateString(locale, { month: 'short' })}
                  </div>
                )}
                {canSelectDay ? (
                  <div className="flex-1 flex flex-col gap-1 min-h-0">
                    <button
                      onClick={() => toggleShift(date, 'morning')}
                      disabled={savedSchedule[key]?.morning && savedSchedule[key]?.morningStatus !== null}
                      className={`flex-1 min-h-[22px] text-[9px] md:text-[10px] rounded font-medium transition-all touch-manipulation ${
                        unconfirmedMorning
                          ? 'bg-amber-500 text-white cursor-default'
                          : scheduledMorning
                          ? 'bg-emerald-600 text-white cursor-default'
                          : savedSchedule[key]?.morning && savedSchedule[key]?.morningStatus !== null
                          ? savedSchedule[key]?.morningStatus === 'B'
                            ? 'bg-emerald-600 text-white cursor-not-allowed'
                            : 'bg-violet-600 text-white cursor-not-allowed'
                          : daySchedule.morning
                          ? 'bg-blue-500 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 active:bg-slate-300'
                      }`}
                    >
                      AM
                    </button>
                    <button
                      onClick={() => toggleShift(date, 'afternoon')}
                      disabled={savedSchedule[key]?.afternoon && savedSchedule[key]?.afternoonStatus !== null}
                      className={`flex-1 min-h-[22px] text-[9px] md:text-[10px] rounded font-medium transition-all touch-manipulation ${
                        unconfirmedAfternoon
                          ? 'bg-amber-500 text-white cursor-default'
                          : scheduledAfternoon
                          ? 'bg-emerald-600 text-white cursor-default'
                          : savedSchedule[key]?.afternoon && savedSchedule[key]?.afternoonStatus !== null
                          ? savedSchedule[key]?.afternoonStatus === 'B'
                            ? 'bg-emerald-600 text-white cursor-not-allowed'
                            : 'bg-violet-600 text-white cursor-not-allowed'
                          : daySchedule.afternoon
                          ? 'bg-blue-500 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 active:bg-slate-300'
                      }`}
                    >
                      PM
                    </button>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <span className="text-[9px] text-slate-400">{t.today}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="mb-5 flex flex-wrap gap-4 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-slate-100 rounded border border-slate-300 shrink-0"></div>
          <span>{t.legendOpen}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-500 rounded border border-blue-600 shrink-0"></div>
          <span>{t.legendSelected}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-violet-600 rounded border border-violet-700 shrink-0"></div>
          <span>{t.legendAvailability}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-amber-500 rounded border border-amber-600 shrink-0"></div>
          <span>{t.legendUnconfirmed}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-emerald-600 rounded border border-emerald-700 shrink-0"></div>
          <span>{t.legendScheduled}</span>
        </div>
        {nextScheduleUpdateDueAt && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border-2 border-amber-500 bg-amber-50 shrink-0"></div>
            <span>{t.legendUpdateDueDate}</span>
          </div>
        )}
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-4 bg-emerald-50 text-emerald-700 rounded-lg text-sm border border-emerald-100">
          {success}
        </div>
      )}

      {/* Save Button */}
      <button
        onClick={handleSaveClick}
        disabled={saving}
        className="w-full px-4 py-3.5 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600 active:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
      >
        {saving ? t.saving : t.saveSchedule}
      </button>

      {/* Confirmation Modal */}
      {showConfirmModal &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 modal-safe-area"
            onClick={() => setShowConfirmModal(false)}
          >
            <div
              className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[85vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-5 sm:p-6">
                <h3 className="text-lg font-semibold text-slate-800 mb-3">{t.confirmSaveTitle}</h3>
                
                {newAdditionsGrouped.length > 0 ? (
                  <>
                    <p className="text-sm text-slate-600 mb-3">{t.addingAvailability}</p>
                    <ul className="mb-4 space-y-2 max-h-40 overflow-y-auto">
                      {newAdditionsGrouped.map(({ dateStr, shifts }) => (
                        <li key={dateStr} className="text-sm flex items-start gap-2">
                          <span className="font-medium text-slate-800 shrink-0">{formatDateDisplay(dateStr)}</span>
                          <span className="text-slate-500">—</span>
                          <span>
                            {shifts.length === 2
                              ? t.morningAndAfternoon
                              : shifts[0] === 'morning'
                                ? t.morningOnly
                                : t.afternoonOnly}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="text-sm text-slate-600 mb-4">{t.noNewAvailability}</p>
                )}

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-5">
                  <p className="text-sm text-amber-800">
                    <strong>{t.importantNote}</strong>
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowConfirmModal(false)}
                    className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 active:bg-slate-100 transition-colors"
                  >
                    {t.cancel}
                  </button>
                  <button
                    onClick={performSave}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-blue-500 text-white font-semibold hover:bg-blue-600 active:bg-blue-700 transition-colors"
                  >
                    {t.saveSchedule}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}

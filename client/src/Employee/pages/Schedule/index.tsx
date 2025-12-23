import { useState, useEffect } from 'react'
import { API_BASE_URL, fetchJson } from '../../../api'

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
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const [schedule, setSchedule] = useState<Record<string, DayShifts>>({})
  const [savedSchedule, setSavedSchedule] = useState<Record<string, DayShifts>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  // Load existing schedule
  useEffect(() => {
    loadSchedule()
  }, [])

  async function loadSchedule() {
    try {
      setLoading(true)
      const userName = localStorage.getItem('userName')
      const headers: HeadersInit = { 'Content-Type': 'application/json', "ngrok-skip-browser-warning": "1" }
      if (userName) {
        headers['x-user-name'] = userName
      }
      
      const response = await fetch(`${API_BASE_URL}/employee/schedule`, { headers })
      if (!response.ok) throw new Error('Failed to load schedule')
      const data = await response.json()
      
      if (data?.futureSchedule && Array.isArray(data.futureSchedule)) {
        const dayShifts = scheduleToDayShifts(data.futureSchedule)
        setSavedSchedule(dayShifts) // Store saved schedule separately
        setSchedule(dayShifts) // Also set as current schedule
      }
      if (data?.employeeUpdate) {
        setLastUpdate(new Date(data.employeeUpdate))
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

  async function handleSave() {
    try {
      setSaving(true)
      setError('')
      setSuccess('')
      
      // Allow empty schedule - just update timestamp
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
        throw new Error(err.error || 'Failed to save schedule')
      }
      
      setSuccess('Schedule saved successfully!')
      setTimeout(() => setSuccess(''), 3000)
      // Reload schedule to update savedSchedule state and lastUpdate
      await loadSchedule()
    } catch (err: any) {
      setError(err.message || 'Failed to save schedule')
    } finally {
      setSaving(false)
    }
  }
  
  function getDaysSinceUpdate(): number | null {
    if (!lastUpdate) return null
    const now = new Date()
    const diffTime = now.getTime() - lastUpdate.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }
  
  function formatDaysSinceUpdate(): string {
    const days = getDaysSinceUpdate()
    if (days === null) return 'Never updated'
    if (days === 0) return 'Updated today'
    if (days === 1) return 'Updated 1 day ago'
    return `Updated ${days} days ago`
  }


  function getDayStyle(date: Date): string {
    if (isBefore(date, today)) {
      return 'bg-gray-200 text-gray-400'
    }
    if (isSameDay(date, today)) {
      return 'bg-blue-100 text-blue-900'
    }
    const daysDiff = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    if (daysDiff >= 1 && daysDiff <= 14) {
      return 'bg-yellow-50 text-yellow-900'
    }
    return 'bg-white text-gray-900'
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
  
  const monthName = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const hasNextMonthDays = daysFromToday.some(d => d.isNextMonth)

  if (loading) {
    return (
      <div className="p-4">
        <h2 className="text-xl font-semibold mb-4">Schedule</h2>
        <div className="text-center text-gray-500">Loading...</div>
      </div>
    )
  }

  const daysSinceUpdate = getDaysSinceUpdate()
  const updateColor = daysSinceUpdate !== null && daysSinceUpdate >= 7 ? 'text-orange-600' : 'text-green-600'

  return (
    <div className="p-4 pb-24">
      <h2 className="text-xl font-semibold mb-4">Schedule</h2>
      
      {/* Last Update Display */}
      {lastUpdate && (
        <div className={`mb-4 text-sm font-medium ${updateColor}`}>
          {formatDaysSinceUpdate()}
        </div>
      )}
      
      {/* Header */}
      <div className="flex items-center justify-center mb-4">
        <h3 className="text-lg font-medium">{monthName}</h3>
        {hasNextMonthDays && (
          <span className="ml-2 text-sm text-gray-500">
            (Next 14 days)
          </span>
        )}
      </div>

      {/* Calendar Grid */}
      <div className="mb-6">
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center text-xs font-medium text-gray-600 p-1">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((date, idx) => {
            if (!date) {
              return <div key={idx} className="aspect-square" />
            }
            
            const key = getDayKey(date)
            const daySchedule = schedule[key] || { morning: false, afternoon: false }
            const canSelectDay = canSelect(date)
            const isNextMonth = (date as any).isNextMonth
            
            return (
              <div
                key={idx}
                className={`aspect-square border rounded p-1 flex flex-col ${getDayStyle(date)} ${
                  isNextMonth ? 'border-dashed border-gray-400' : 'border-gray-300'
                }`}
              >
                <div className="text-xs font-medium mb-1 text-center flex items-center justify-center gap-1">
                  <span>{date.getDate()}</span>
                  {isNextMonth && (
                    <span className="text-[8px] text-gray-500 font-normal">→</span>
                  )}
                </div>
                {isNextMonth && (
                  <div className="text-[8px] text-gray-500 text-center mb-0.5">
                    {date.toLocaleDateString('en-US', { month: 'short' })}
                  </div>
                )}
                {canSelectDay ? (
                  <div className="flex-1 flex flex-col gap-1">
                    <button
                      onClick={() => toggleShift(date, 'morning')}
                      disabled={savedSchedule[key]?.morning && savedSchedule[key]?.morningStatus !== null}
                      className={`flex-1 text-[10px] rounded px-1 py-0.5 font-medium transition-colors ${
                        savedSchedule[key]?.morning && savedSchedule[key]?.morningStatus !== null
                          ? savedSchedule[key]?.morningStatus === 'F'
                            ? 'bg-green-600 text-white cursor-not-allowed'
                            : 'bg-purple-600 text-white cursor-not-allowed'
                          : daySchedule.morning
                          ? 'bg-blue-400 text-white'
                          : 'bg-gray-100 hover:bg-gray-200 active:bg-gray-300'
                      }`}
                    >
                      AM
                    </button>
                    <button
                      onClick={() => toggleShift(date, 'afternoon')}
                      disabled={savedSchedule[key]?.afternoon && savedSchedule[key]?.afternoonStatus !== null}
                      className={`flex-1 text-[10px] rounded px-1 py-0.5 font-medium transition-colors ${
                        savedSchedule[key]?.afternoon && savedSchedule[key]?.afternoonStatus !== null
                          ? savedSchedule[key]?.afternoonStatus === 'F'
                            ? 'bg-green-600 text-white cursor-not-allowed'
                            : 'bg-purple-600 text-white cursor-not-allowed'
                          : daySchedule.afternoon
                          ? 'bg-blue-400 text-white'
                          : 'bg-gray-100 hover:bg-gray-200 active:bg-gray-300'
                      }`}
                    >
                      PM
                    </button>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col gap-1 justify-center items-center">
                    <div className="text-[9px] text-gray-400">Today</div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="mb-4 text-xs text-gray-600 space-y-1.5">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-gray-200 rounded border border-gray-300"></div>
          <span>Past days</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-100 rounded border border-gray-300"></div>
          <span>Today</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-yellow-50 rounded border border-gray-300"></div>
          <span>Next 14 days</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-white rounded border border-gray-300"></div>
          <span>Future</span>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-100 text-green-700 rounded text-sm">
          {success}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 px-4 py-3 bg-blue-500 text-white rounded font-medium hover:bg-blue-600 active:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Saving...' : 'Save Schedule'}
        </button>
      </div>
    </div>
  )
}

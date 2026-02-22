import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { API_BASE_URL, fetchJson } from '../../../../api'
import { formatPhone } from '../../../../formatPhone'
import type { Appointment } from '../../Calendar/types'
import DayTimelineModalContainer, { type DayTimelineModalView } from '../../Calendar/components/DayTimelineHelpers/DayTimelineModalContainer'

type ScheduleOverviewEmployee = {
  id: number
  name: string
  number: string
  disabled?: boolean
  schedule: { futureSchedule: string[] }
}

type ScheduleOverview = {
  employees: ScheduleOverviewEmployee[]
  scheduledByDay: Record<string, { am: number; pm: number }>
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

function getDayKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getDaysInMonth(date: Date): (Date | null)[] {
  const start = startOfMonth(date)
  const end = endOfMonth(date)
  const startDay = start.getDay()
  const days: (Date | null)[] = []
  for (let i = 0; i < startDay; i++) days.push(null)
  for (let d = 1; d <= end.getDate(); d++) {
    days.push(new Date(date.getFullYear(), date.getMonth(), d))
  }
  return days
}

/** Schedule entry: YYYY-MM-DD-T-S, T=M (morning) or A (afternoon), S=F (free) or B (busy) */
function isAvailableOnSlot(futureSchedule: string[], dateStr: string, slot: 'M' | 'A'): boolean {
  const need = slot === 'M' ? `${dateStr}-M-F` : `${dateStr}-A-F`
  return futureSchedule.some((entry) => {
    const parts = entry.split('-')
    if (parts.length !== 5) return false
    const [y, m, d, t, status] = parts
    const entryDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    return entryDate === dateStr && t === slot && status === 'F'
  })
}

function computeAvailableByDayBySlot(
  employees: ScheduleOverviewEmployee[],
  year: number,
  month: number
): Record<string, { am: number; pm: number }> {
  const result: Record<string, { am: number; pm: number }> = {}
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    result[dateStr] = {
      am: employees.filter((e) => isAvailableOnSlot(e.schedule?.futureSchedule ?? [], dateStr, 'M')).length,
      pm: employees.filter((e) => isAvailableOnSlot(e.schedule?.futureSchedule ?? [], dateStr, 'A')).length,
    }
  }
  return result
}

function isToday(date: Date): boolean {
  const t = new Date()
  return (
    date.getFullYear() === t.getFullYear() &&
    date.getMonth() === t.getMonth() &&
    date.getDate() === t.getDate()
  )
}

function isPast(date: Date): boolean {
  const t = new Date()
  t.setHours(0, 0, 0, 0)
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d < t
}

/** True if date is within the next 14 days from today (today + 0..14) */
function isWithin14Days(date: Date): boolean {
  const t = new Date()
  t.setHours(0, 0, 0, 0)
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const diff = Math.floor((d.getTime() - t.getTime()) / (1000 * 60 * 60 * 24))
  return diff >= 0 && diff <= 14
}

/** True if date is more than 14 days from today */
function isBeyond14Days(date: Date): boolean {
  const t = new Date()
  t.setHours(0, 0, 0, 0)
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const diff = Math.floor((d.getTime() - t.getTime()) / (1000 * 60 * 60 * 24))
  return diff > 14
}

/** Appointment time before 2pm = AM */
function isAmSlot(timeStr: string): boolean {
  if (!timeStr) return true
  const [h, m] = timeStr.split(':').map((s) => parseInt(s, 10))
  const minutes = (h ?? 0) * 60 + (m ?? 0)
  return minutes < 14 * 60
}

/** Parse schedule entry YYYY-MM-DD-T-S to day shifts (M=AM, A=PM, F/B=status) */
function parseScheduleEntry(entry: string): { date: string; type: 'M' | 'A'; status: 'F' | 'B' } | null {
  const parts = entry.split('-')
  if (parts.length !== 5) return null
  const [y, m, d, type, status] = parts
  if ((type !== 'M' && type !== 'A') || (status !== 'F' && status !== 'B')) return null
  return {
    date: `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`,
    type: type as 'M' | 'A',
    status: status as 'F' | 'B',
  }
}

function scheduleToDayShifts(futureSchedule: string[]): Record<string, { morning: boolean; afternoon: boolean; morningStatus: 'F' | 'B' | null; afternoonStatus: 'F' | 'B' | null }> {
  const result: Record<string, { morning: boolean; afternoon: boolean; morningStatus: 'F' | 'B' | null; afternoonStatus: 'F' | 'B' | null }> = {}
  futureSchedule.forEach((entry) => {
    const parsed = parseScheduleEntry(entry)
    if (!parsed) return
    if (!result[parsed.date]) {
      result[parsed.date] = { morning: false, afternoon: false, morningStatus: null, afternoonStatus: null }
    }
    if (parsed.type === 'M') {
      result[parsed.date].morning = true
      result[parsed.date].morningStatus = parsed.status
    } else {
      result[parsed.date].afternoon = true
      result[parsed.date].afternoonStatus = parsed.status
    }
  })
  return result
}

function upcomingToScheduledByDay(upcoming: { date: string; block: 'AM' | 'PM'; confirmed?: boolean }[]): Record<string, { morning: boolean; afternoon: boolean; morningUnconfirmed: boolean; afternoonUnconfirmed: boolean }> {
  const byDay: Record<string, { morning: boolean; afternoon: boolean; morningUnconfirmed: boolean; afternoonUnconfirmed: boolean }> = {}
  upcoming.forEach((a) => {
    if (!byDay[a.date]) byDay[a.date] = { morning: false, afternoon: false, morningUnconfirmed: false, afternoonUnconfirmed: false }
    if (a.block === 'AM') {
      byDay[a.date].morning = true
      if (a.confirmed === false) byDay[a.date].morningUnconfirmed = true
    } else {
      byDay[a.date].afternoon = true
      if (a.confirmed === false) byDay[a.date].afternoonUnconfirmed = true
    }
  })
  return byDay
}

type EmployeeOption = { id: number; name: string; number: string }

export default function Schedule() {
  const today = new Date()
  const [viewDate, setViewDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [viewMode, setViewMode] = useState<'all' | 'employee'>('all')
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeOption | null>(null)
  const [employeeScheduleView, setEmployeeScheduleView] = useState<{
    futureSchedule: string[]
    upcoming: { date: string; block: 'AM' | 'PM'; confirmed?: boolean }[]
  } | null>(null)
  const [overview, setOverview] = useState<ScheduleOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [dayAppointments, setDayAppointments] = useState<
    { time: string; employees: { id: number; name: string; number: string }[] }[]
  >([])
  const [projection, setProjection] = useState({ amTeamSize: 0, pmTeamSize: 0 })
  const [projectionInput, setProjectionInput] = useState({ am: '', pm: '' })
  const [savingProjection, setSavingProjection] = useState(false)
  const [showSelectEmployee, setShowSelectEmployee] = useState(false)
  const [selectEmployeeSearch, setSelectEmployeeSearch] = useState('')
  const [selectEmployeeDebounced, setSelectEmployeeDebounced] = useState('')
  const [selectEmployeeList, setSelectEmployeeList] = useState<EmployeeOption[]>([])
  const [employeeViewAppointment, setEmployeeViewAppointment] = useState<Appointment | null>(null)
  const [employeeModalView, setEmployeeModalView] = useState<DayTimelineModalView>('details')
  const [showSchedulePolicyModal, setShowSchedulePolicyModal] = useState(false)
  const [schedulePolicy, setSchedulePolicy] = useState<{
    updateDayOfWeek: number
    supervisorNotifyAfterDays: number
    stopRemindingAfterDays: number
  } | null>(null)
  const [schedulePolicySaving, setSchedulePolicySaving] = useState(false)
  const navigate = useNavigate()

  const startStr = useMemo(() => getDayKey(startOfMonth(viewDate)), [viewDate])
  const endStr = useMemo(() => getDayKey(endOfMonth(viewDate)), [viewDate])

  useEffect(() => {
    const t = setTimeout(() => setSelectEmployeeDebounced(selectEmployeeSearch), 300)
    return () => clearTimeout(t)
  }, [selectEmployeeSearch])

  useEffect(() => {
    if (!showSelectEmployee) return
    fetchJson<EmployeeOption[]>(
      `${API_BASE_URL}/employees?search=${encodeURIComponent(selectEmployeeDebounced)}&skip=0&take=30&all=true`
    )
      .then(setSelectEmployeeList)
      .catch(() => setSelectEmployeeList([]))
  }, [showSelectEmployee, selectEmployeeDebounced])

  useEffect(() => {
    if (!showSchedulePolicyModal) return
    fetchJson<{
      updateDayOfWeek: number
      supervisorNotifyAfterDays: number
      stopRemindingAfterDays: number
    }>(`${API_BASE_URL}/employees/schedule-policy`)
      .then(setSchedulePolicy)
      .catch(() => setSchedulePolicy({
        updateDayOfWeek: 0,
        supervisorNotifyAfterDays: 4,
        stopRemindingAfterDays: 7,
      }))
  }, [showSchedulePolicyModal])

  useEffect(() => {
    if (viewMode !== 'all') return
    let cancelled = false
    setLoading(true)
    fetchJson<ScheduleOverview>(
      `${API_BASE_URL}/employees/schedule-overview?start=${startStr}&end=${endStr}&search=`
    )
      .then((data) => {
        if (!cancelled) setOverview(data)
      })
      .catch((err) => {
        console.error(err)
        if (!cancelled) setOverview({ employees: [], scheduledByDay: {} })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [viewMode, startStr, endStr])

  useEffect(() => {
    if (!selectedEmployee) {
      setEmployeeScheduleView(null)
      return
    }
    setLoading(true)
    fetchJson<{ futureSchedule: string[]; upcoming: { date: string; block: 'AM' | 'PM'; confirmed?: boolean }[] }>(
      `${API_BASE_URL}/employees/${selectedEmployee.id}/schedule-view`
    )
      .then((data) => {
        setEmployeeScheduleView({ futureSchedule: data.futureSchedule ?? [], upcoming: data.upcoming ?? [] })
      })
      .catch(() => setEmployeeScheduleView(null))
      .finally(() => setLoading(false))
  }, [selectedEmployee?.id])

  useEffect(() => {
    fetchJson<{ amTeamSize: number; pmTeamSize: number }>(`${API_BASE_URL}/employees/schedule-projection`)
      .then((data) => {
        setProjection(data)
        setProjectionInput({ am: String(data.amTeamSize), pm: String(data.pmTeamSize) })
      })
      .catch(() => {})
  }, [])

  const availableByDay = useMemo(() => {
    if (!overview) return {}
    return computeAvailableByDayBySlot(
      overview.employees,
      viewDate.getFullYear(),
      viewDate.getMonth()
    )
  }, [overview, viewDate.getFullYear(), viewDate.getMonth()])

  const scheduledByDay = overview?.scheduledByDay ?? {}
  const days = useMemo(() => getDaysInMonth(viewDate), [viewDate])
  const monthLabel = viewDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  const employeeDayShifts = useMemo(
    () => (employeeScheduleView ? scheduleToDayShifts(employeeScheduleView.futureSchedule) : {}),
    [employeeScheduleView]
  )
  const employeeScheduledByDay = useMemo(
    () => (employeeScheduleView ? upcomingToScheduledByDay(employeeScheduleView.upcoming) : {}),
    [employeeScheduleView]
  )

  const goPrev = () => setViewDate((d) => addMonths(d, -1))
  const goNext = () => setViewDate((d) => addMonths(d, 1))

  const clearEmployeeView = () => {
    setSelectedEmployee(null)
    setViewMode('all')
    setShowSelectEmployee(false)
  }

  const handleSelectEmployee = (emp: EmployeeOption) => {
    setSelectedEmployee(emp)
    setViewMode('employee')
    setShowSelectEmployee(false)
    setSelectedDay(null)
  }

  const handleEmployeeBlockClick = async (dateKey: string, slot: 'AM' | 'PM') => {
    if (!selectedEmployee) return
    try {
      const list = await fetchJson<Appointment[]>(`${API_BASE_URL}/appointments?date=${dateKey}`)
      const appointment = (list ?? []).find((a) => {
        const hasEmployee = a.employees?.some((e: { id: number }) => e.id === selectedEmployee.id)
        if (!hasEmployee) return false
        const isAm = isAmSlot(a.time ?? '')
        return slot === 'AM' ? isAm : !isAm
      })
        if (appointment) {
        const normalized = {
          ...appointment,
          date: typeof appointment.date === 'string' ? appointment.date.slice(0, 10) : (appointment.date as Date).toISOString?.()?.slice(0, 10) ?? dateKey,
        } as Appointment
        setEmployeeViewAppointment(normalized)
        setEmployeeModalView('details')
      }
    } catch {
      // ignore
    }
  }

  const handleDayClick = (date: Date) => {
    const key = getDayKey(date)
    setSelectedDay(key)
    fetchJson<{ time: string; employees: { id: number; name: string; number: string }[] }[]>(
      `${API_BASE_URL}/appointments?date=${key}`
    )
      .then(setDayAppointments)
      .catch(() => setDayAppointments([]))
  }

  const saveProjection = () => {
    const am = Math.max(0, parseInt(projectionInput.am, 10) || 0)
    const pm = Math.max(0, parseInt(projectionInput.pm, 10) || 0)
    setSavingProjection(true)
    fetch(`${API_BASE_URL}/employees/schedule-projection`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amTeamSize: am, pmTeamSize: pm }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to save'))))
      .then((data: { amTeamSize: number; pmTeamSize: number }) => {
        setProjection(data)
        setProjectionInput({ am: String(data.amTeamSize), pm: String(data.pmTeamSize) })
      })
      .finally(() => setSavingProjection(false))
  }

  const availableAm = useMemo(() => {
    if (!selectedDay || !overview) return []
    return overview.employees.filter((e) =>
      isAvailableOnSlot(e.schedule?.futureSchedule ?? [], selectedDay, 'M')
    )
  }, [selectedDay, overview])
  const availablePm = useMemo(() => {
    if (!selectedDay || !overview) return []
    return overview.employees.filter((e) =>
      isAvailableOnSlot(e.schedule?.futureSchedule ?? [], selectedDay, 'A')
    )
  }, [selectedDay, overview])
  const scheduledAm = useMemo(() => {
    if (!selectedDay) return []
    const seen = new Set<number>()
    const list: { id: number; name: string; number: string }[] = []
    dayAppointments.forEach((a) => {
      if (!isAmSlot(a.time ?? '')) return
      a.employees?.forEach((emp) => {
        if (!seen.has(emp.id)) {
          seen.add(emp.id)
          list.push(emp)
        }
      })
    })
    return list
  }, [selectedDay, dayAppointments])
  const scheduledPm = useMemo(() => {
    if (!selectedDay) return []
    const seen = new Set<number>()
    const list: { id: number; name: string; number: string }[] = []
    dayAppointments.forEach((a) => {
      if (isAmSlot(a.time ?? '')) return
      a.employees?.forEach((emp) => {
        if (!seen.has(emp.id)) {
          seen.add(emp.id)
          list.push(emp)
        }
      })
    })
    return list
  }, [selectedDay, dayAppointments])

  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className="p-4 pb-16">
      <Link to=".." className="text-blue-500 text-sm">&larr; Back</Link>
      <h2 className="text-xl font-semibold mb-4">Employee Schedule</h2>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          {selectedEmployee ? (
            <>
              <span className="text-sm text-slate-600">Viewing:</span>
              <span className="font-medium text-slate-800">{selectedEmployee.name}</span>
              <button
                type="button"
                onClick={clearEmployeeView}
                className="text-sm text-blue-600 hover:underline"
              >
                Clear
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setShowSelectEmployee(true)}
                className="px-3 py-2 bg-slate-700 text-white rounded-lg text-sm font-medium hover:bg-slate-800"
              >
                Select employee
              </button>
              <button
                type="button"
                onClick={() => setShowSchedulePolicyModal(true)}
                className="px-3 py-2 bg-slate-600 text-white rounded-lg text-sm font-medium hover:bg-slate-700"
              >
                Set schedule policy
              </button>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goPrev}
            className="px-3 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
          >
            ← Prev
          </button>
          <span className="font-medium text-slate-800 min-w-[140px] text-center">{monthLabel}</span>
          <button
            type="button"
            onClick={goNext}
            className="px-3 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
          >
            Next →
          </button>
        </div>
      </div>

      {/* Projection settings: for days > 14 out (All view only) */}
      {viewMode === 'all' && (
      <div className="mb-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
        <h3 className="text-sm font-semibold text-slate-700 mb-2">Projection (days &gt; 14 from today)</h3>
        <p className="text-xs text-slate-500 mb-3">
          Team size targets for future dates. Shown in blue on the calendar. Later we’ll prevent bookings from exceeding these.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2">
            <span className="text-sm text-slate-600">AM:</span>
            <input
              type="number"
              min={0}
              value={projectionInput.am}
              onChange={(e) => setProjectionInput((p) => ({ ...p, am: e.target.value }))}
              className="w-16 border border-slate-300 rounded px-2 py-1 text-sm"
            />
          </label>
          <label className="flex items-center gap-2">
            <span className="text-sm text-slate-600">PM:</span>
            <input
              type="number"
              min={0}
              value={projectionInput.pm}
              onChange={(e) => setProjectionInput((p) => ({ ...p, pm: e.target.value }))}
              className="w-16 border border-slate-300 rounded px-2 py-1 text-sm"
            />
          </label>
          <button
            type="button"
            onClick={saveProjection}
            disabled={savingProjection}
            className="px-3 py-1.5 bg-slate-700 text-white rounded text-sm hover:bg-slate-800 disabled:opacity-50"
          >
            {savingProjection ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
      )}

      {loading ? (
        <div className="py-8 text-center text-slate-500">Loading…</div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="grid grid-cols-7 gap-px bg-slate-200">
            {weekdays.map((day) => (
              <div
                key={day}
                className="bg-slate-50 py-2 text-center text-xs font-semibold text-slate-600"
              >
                {day}
              </div>
            ))}
            {days.map((date, idx) => {
              if (!date) {
                return <div key={`empty-${idx}`} className="bg-slate-50 min-h-0" />
              }
              const key = getDayKey(date)
              const in14 = isWithin14Days(date)
              const beyond14 = isBeyond14Days(date)
              const isTodayDate = isToday(date)
              const dayBg = in14 ? 'bg-blue-50' : 'bg-white'

              if (viewMode === 'employee') {
                const shifts = employeeDayShifts[key]
                const sched = employeeScheduledByDay[key]
                const scheduledAm = sched?.morning ?? false
                const scheduledPm = sched?.afternoon ?? false
                const unconfirmedAm = sched?.morningUnconfirmed ?? false
                const unconfirmedPm = sched?.afternoonUnconfirmed ?? false
                const getAmClass = () => {
                  if (beyond14) return 'bg-slate-200 text-slate-400'
                  if (unconfirmedAm) return 'bg-amber-500 text-white'
                  if (scheduledAm) return 'bg-emerald-600 text-white'
                  if (shifts?.morning && shifts.morningStatus !== null) return 'bg-violet-600 text-white'
                  return 'bg-slate-100 text-slate-500'
                }
                const getPmClass = () => {
                  if (beyond14) return 'bg-slate-200 text-slate-400'
                  if (unconfirmedPm) return 'bg-amber-500 text-white'
                  if (scheduledPm) return 'bg-emerald-600 text-white'
                  if (shifts?.afternoon && shifts.afternoonStatus !== null) return 'bg-violet-600 text-white'
                  return 'bg-slate-100 text-slate-500'
                }
                const amClickable = !beyond14 && (scheduledAm || unconfirmedAm)
                const pmClickable = !beyond14 && (scheduledPm || unconfirmedPm)
                return (
                  <div
                    key={key}
                    className={`min-h-[120px] p-1 text-left ${dayBg} flex flex-col gap-1 ${
                      isTodayDate ? 'ring-2 ring-blue-400 ring-inset' : ''
                    } text-slate-800`}
                  >
                    <div className="text-xs font-semibold shrink-0">{date.getDate()}</div>
                    <div className="flex-1 flex flex-col gap-1 min-h-0">
                      {amClickable ? (
                        <button
                          type="button"
                          onClick={() => handleEmployeeBlockClick(key, 'AM')}
                          className={`rounded px-1 py-1 flex flex-col min-h-[36px] justify-center w-full text-left cursor-pointer hover:opacity-90 ${getAmClass()}`}
                        >
                          <div className="text-[9px] font-semibold uppercase tracking-wide opacity-90">AM</div>
                        </button>
                      ) : (
                        <div className={`rounded px-1 py-1 flex flex-col min-h-[36px] justify-center ${getAmClass()}`}>
                          <div className="text-[9px] font-semibold uppercase tracking-wide opacity-90">AM</div>
                        </div>
                      )}
                      {pmClickable ? (
                        <button
                          type="button"
                          onClick={() => handleEmployeeBlockClick(key, 'PM')}
                          className={`rounded px-1 py-1 flex flex-col min-h-[36px] justify-center w-full text-left cursor-pointer hover:opacity-90 ${getPmClass()}`}
                        >
                          <div className="text-[9px] font-semibold uppercase tracking-wide opacity-90">PM</div>
                        </button>
                      ) : (
                        <div className={`rounded px-1 py-1 flex flex-col min-h-[36px] justify-center ${getPmClass()}`}>
                          <div className="text-[9px] font-semibold uppercase tracking-wide opacity-90">PM</div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              }

              const avail = availableByDay[key] ?? { am: 0, pm: 0 }
              const sched = scheduledByDay[key] ?? { am: 0, pm: 0 }
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleDayClick(date)}
                  className={`min-h-[120px] p-1 text-left ${dayBg} hover:bg-slate-50 transition-colors flex flex-col gap-1 ${
                    isTodayDate ? 'ring-2 ring-blue-400 ring-inset' : ''
                  } text-slate-800`}
                >
                  <div className="text-xs font-semibold shrink-0">{date.getDate()}</div>
                  <div className="flex-1 flex flex-col gap-1 min-h-0">
                    <div className={`rounded border px-1 py-1 flex flex-col min-h-[36px] ${beyond14 ? 'border-blue-200 bg-blue-50/80' : 'border-slate-200 bg-slate-50/80'}`}>
                      <div className="text-[9px] font-semibold text-slate-500 uppercase tracking-wide">AM</div>
                      {beyond14 ? (
                        <div className="text-base font-semibold text-blue-700">{projection.amTeamSize}</div>
                      ) : (
                        <div className="text-base leading-tight">
                          <span className="text-violet-700 font-semibold">{avail.am}</span>
                          <span className="text-slate-400 mx-0.5">/</span>
                          <span className="text-emerald-700 font-semibold">{sched.am}</span>
                        </div>
                      )}
                    </div>
                    <div className={`rounded border px-1 py-1 flex flex-col min-h-[36px] ${beyond14 ? 'border-blue-200 bg-blue-50/80' : 'border-slate-200 bg-slate-50/80'}`}>
                      <div className="text-[9px] font-semibold text-slate-500 uppercase tracking-wide">PM</div>
                      {beyond14 ? (
                        <div className="text-base font-semibold text-blue-700">{projection.pmTeamSize}</div>
                      ) : (
                        <div className="text-base leading-tight">
                          <span className="text-violet-700 font-semibold">{avail.pm}</span>
                          <span className="text-slate-400 mx-0.5">/</span>
                          <span className="text-emerald-700 font-semibold">{sched.pm}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-600">
        {viewMode === 'employee' ? (
          <>
            <span className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded bg-slate-200 shrink-0" />
              Open
            </span>
            <span className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded bg-violet-600 shrink-0" />
              Available
            </span>
            <span className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded bg-emerald-600 shrink-0" />
              Scheduled
            </span>
            <span className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded bg-amber-500 shrink-0" />
              Unconfirmed
            </span>
            <span className="text-slate-500">Days beyond 14 from today show gray (no data).</span>
            <span className="text-slate-500">Click a Scheduled or Unconfirmed block to open that appointment.</span>
          </>
        ) : (
          <>
            <span className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded bg-blue-100 border border-blue-200" />
              Next 14 days
            </span>
            <span className="flex items-center gap-2">
              In each block: <span className="text-violet-600 font-medium">avail</span> / <span className="text-emerald-600 font-medium">sched</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="text-blue-600 font-medium">Projected</span> = blue (days &gt; 14 out)
            </span>
          </>
        )}
      </div>

      {/* Select employee modal */}
      {showSelectEmployee && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowSelectEmployee(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">Select employee</h3>
              <button
                type="button"
                onClick={() => setShowSelectEmployee(false)}
                className="text-slate-500 hover:text-slate-700"
              >
                ✕
              </button>
            </div>
            <div className="p-3 border-b border-slate-100">
              <input
                type="text"
                value={selectEmployeeSearch}
                onChange={(e) => setSelectEmployeeSearch(e.target.value)}
                placeholder="Search by name or number"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                autoFocus
              />
            </div>
            <ul className="overflow-y-auto flex-1 p-2">
              {selectEmployeeList.map((emp) => (
                <li key={emp.id}>
                  <button
                    type="button"
                    onClick={() => handleSelectEmployee(emp)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 flex flex-col"
                  >
                    <span className="font-medium text-slate-800">{emp.name}</span>
                    <span className="text-sm text-slate-500">{formatPhone(emp.number)}</span>
                  </button>
                </li>
              ))}
              {selectEmployeeList.length === 0 && selectEmployeeDebounced && (
                <li className="px-3 py-4 text-sm text-slate-500">No employees found.</li>
              )}
            </ul>
          </div>
        </div>
      )}

      {/* Schedule policy modal */}
      {showSchedulePolicyModal && schedulePolicy && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowSchedulePolicyModal(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">Set schedule policy</h3>
              <button
                type="button"
                onClick={() => setShowSchedulePolicyModal(false)}
                className="text-slate-500 hover:text-slate-700"
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-4">
              {schedulePolicy && (
                <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
                  <p>
                    <strong>Current policy:</strong> Each employee has a stored <strong>next update due date</strong> (the day by which they must update). When they save their schedule, we set their next due date to the following {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][schedulePolicy.updateDayOfWeek]}. New employees get the next {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][schedulePolicy.updateDayOfWeek]} as their first due date.
                  </p>
                  <p>
                    We send the employee a reminder every day from <strong>day 1</strong> through <strong>day {schedulePolicy.stopRemindingAfterDays}</strong> after their due date (if they haven’t updated). From <strong>day {schedulePolicy.supervisorNotifyAfterDays}</strong> we also notify their supervisor. All reminders stop after day {schedulePolicy.stopRemindingAfterDays}.
                  </p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Update day (employees should update by)</label>
                <select
                  value={schedulePolicy.updateDayOfWeek}
                  onChange={(e) => setSchedulePolicy((p) => p && { ...p, updateDayOfWeek: parseInt(e.target.value, 10) })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value={0}>Sunday</option>
                  <option value={1}>Monday</option>
                  <option value={2}>Tuesday</option>
                  <option value={3}>Wednesday</option>
                  <option value={4}>Thursday</option>
                  <option value={5}>Friday</option>
                  <option value={6}>Saturday</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notify supervisor after (days past update day)</label>
                <input
                  type="number"
                  min={1}
                  max={14}
                  value={schedulePolicy.supervisorNotifyAfterDays}
                  onChange={(e) => setSchedulePolicy((p) => p && { ...p, supervisorNotifyAfterDays: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
                <p className="text-xs text-slate-500 mt-0.5">From this day after the update day, supervisor is also notified (employee is still reminded every day until stop).</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Stop all reminders after (days past update day)</label>
                <input
                  type="number"
                  min={1}
                  max={21}
                  value={schedulePolicy.stopRemindingAfterDays}
                  onChange={(e) => setSchedulePolicy((p) => p && { ...p, stopRemindingAfterDays: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
                <p className="text-xs text-slate-500 mt-0.5">No more messages after this many days past the update day.</p>
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowSchedulePolicyModal(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={schedulePolicySaving}
                onClick={async () => {
                  if (!schedulePolicy) return
                  setSchedulePolicySaving(true)
                  try {
                    const res = await fetch(`${API_BASE_URL}/employees/schedule-policy`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(schedulePolicy),
                    })
                    if (res.ok) setShowSchedulePolicyModal(false)
                  } catch {
                    // keep modal open
                  } finally {
                    setSchedulePolicySaving(false)
                  }
                }}
                className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50"
              >
                {schedulePolicySaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Employee view: appointment modal (details / team-options / edit / reschedule) when clicking a scheduled/unconfirmed block */}
      {viewMode === 'employee' && employeeViewAppointment && selectedEmployee && (
        <DayTimelineModalContainer
          view={employeeModalView}
          appointment={employeeViewAppointment}
          onClose={() => {
            setEmployeeViewAppointment(null)
            if (selectedEmployee) {
              fetchJson<{ futureSchedule: string[]; upcoming: { date: string; block: 'AM' | 'PM'; confirmed?: boolean }[] }>(
                `${API_BASE_URL}/employees/${selectedEmployee.id}/schedule-view`
              )
                .then((data) => setEmployeeScheduleView({ futureSchedule: data.futureSchedule ?? [], upcoming: data.upcoming ?? [] }))
                .catch(() => {})
            }
          }}
          onUpdate={(updated) => {
            setEmployeeViewAppointment(updated)
            if (selectedEmployee) {
              fetchJson<{ futureSchedule: string[]; upcoming: { date: string; block: 'AM' | 'PM'; confirmed?: boolean }[] }>(
                `${API_BASE_URL}/employees/${selectedEmployee.id}/schedule-view`
              )
                .then((data) => setEmployeeScheduleView({ futureSchedule: data.futureSchedule ?? [], upcoming: data.upcoming ?? [] }))
                .catch(() => {})
            }
          }}
          onViewChange={setEmployeeModalView}
          onCreate={() => {
            if (employeeViewAppointment?.id != null) {
              setEmployeeViewAppointment(null)
              navigate(`/dashboard/calendar?date=${employeeViewAppointment.date}&bookAgain=${employeeViewAppointment.id}`)
            }
          }}
          onViewInCalendar={() => {
            if (employeeViewAppointment) {
              setEmployeeViewAppointment(null)
              navigate(`/dashboard/calendar?date=${employeeViewAppointment.date}&appt=${employeeViewAppointment.id}`)
            }
          }}
          onEdit={() => {}}
          onRescheduled={() => {
            setEmployeeViewAppointment(null)
            if (selectedEmployee) {
              fetchJson<{ futureSchedule: string[]; upcoming: { date: string; block: 'AM' | 'PM'; confirmed?: boolean }[] }>(
                `${API_BASE_URL}/employees/${selectedEmployee.id}/schedule-view`
              )
                .then((data) => setEmployeeScheduleView({ futureSchedule: data.futureSchedule ?? [], upcoming: data.upcoming ?? [] }))
                .catch(() => {})
            }
          }}
        />
      )}

      {viewMode === 'all' && selectedDay && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedDay(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[85vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">
                {new Date(selectedDay + 'T12:00:00').toLocaleDateString(undefined, {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedDay(null)}
                className="text-slate-500 hover:text-slate-700"
              >
                ✕
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              {/* AM block */}
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <div className="bg-slate-100 px-3 py-2 border-b border-slate-200">
                  <h4 className="text-sm font-semibold text-slate-800">AM</h4>
                </div>
                <div className="p-3 space-y-3">
                  <div>
                    <h5 className="text-xs font-medium text-violet-700 mb-1">Available ({availableAm.length})</h5>
                    <ul className="text-sm text-slate-700 space-y-0.5">
                      {availableAm.length === 0 ? (
                        <li className="text-slate-500">None</li>
                      ) : (
                        availableAm.map((e) => (
                          <li key={e.id}>
                            {e.name} — {formatPhone(e.number)}
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                  <div>
                    <h5 className="text-xs font-medium text-emerald-700 mb-1">Scheduled ({scheduledAm.length})</h5>
                    <ul className="text-sm text-slate-700 space-y-0.5">
                      {scheduledAm.length === 0 ? (
                        <li className="text-slate-500">None</li>
                      ) : (
                        scheduledAm.map((e) => (
                          <li key={e.id}>
                            {e.name} — {formatPhone(e.number)}
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                </div>
              </div>
              {/* PM block */}
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <div className="bg-slate-100 px-3 py-2 border-b border-slate-200">
                  <h4 className="text-sm font-semibold text-slate-800">PM</h4>
                </div>
                <div className="p-3 space-y-3">
                  <div>
                    <h5 className="text-xs font-medium text-violet-700 mb-1">Available ({availablePm.length})</h5>
                    <ul className="text-sm text-slate-700 space-y-0.5">
                      {availablePm.length === 0 ? (
                        <li className="text-slate-500">None</li>
                      ) : (
                        availablePm.map((e) => (
                          <li key={e.id}>
                            {e.name} — {formatPhone(e.number)}
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                  <div>
                    <h5 className="text-xs font-medium text-emerald-700 mb-1">Scheduled ({scheduledPm.length})</h5>
                    <ul className="text-sm text-slate-700 space-y-0.5">
                      {scheduledPm.length === 0 ? (
                        <li className="text-slate-500">None</li>
                      ) : (
                        scheduledPm.map((e) => (
                          <li key={e.id}>
                            {e.name} — {formatPhone(e.number)}
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

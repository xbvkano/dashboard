import { useEffect, useMemo, useState } from 'react'
import { API_BASE_URL, fetchJson } from '../../../../api'

type DutyEmployee = {
  id: number
  name: string
  phoneNumber: string
  role: string | null
}

type DraftShift = {
  id: string
  dayOfWeek: number
  startTimeLocal: string
  endTimeLocal: string
  employeeId: number
  /** 1 = every week; 2 = every other week */
  intervalWeeks: 1 | 2
  /** Only used when intervalWeeks === 2: 0 = week A, 1 = week B */
  phase: 0 | 1
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const TZ = 'America/Los_Angeles'

function toDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function sundayOf(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  x.setDate(x.getDate() - x.getDay())
  return x
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  x.setDate(x.getDate() + n)
  return x
}

function mondayAfterSunday(sunday: Date): Date {
  return addDays(sunday, 1)
}

function newShiftId(): string {
  return `s-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function hhMmToMinutes(s: string): number {
  const m = /^(\d{2}):(\d{2})$/.exec(s)
  if (!m) return NaN
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return NaN
  return h * 60 + min
}

function localTimeRangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
): boolean {
  let a0 = hhMmToMinutes(aStart)
  let a1 = hhMmToMinutes(aEnd)
  let b0 = hhMmToMinutes(bStart)
  let b1 = hhMmToMinutes(bEnd)
  if (![a0, a1, b0, b1].every((n) => Number.isFinite(n))) return false
  if (a1 <= a0) a1 += 24 * 60
  if (b1 <= b0) b1 += 24 * 60
  return a0 < b1 && b0 < a1
}

function cadencesCanCoOccur(a: DraftShift, b: DraftShift): boolean {
  if (a.intervalWeeks === 1 || b.intervalWeeks === 1) return true
  return a.phase === b.phase
}

/** True if `candidate` would put a second person on the line at the same time as an existing shift. */
function findOverlapWith(
  shifts: DraftShift[],
  candidate: Omit<DraftShift, 'id'> & { id?: string }
): DraftShift | null {
  for (const existing of shifts) {
    if (candidate.id && existing.id === candidate.id) continue
    if (existing.dayOfWeek !== candidate.dayOfWeek) continue
    if (
      !localTimeRangesOverlap(
        existing.startTimeLocal,
        existing.endTimeLocal,
        candidate.startTimeLocal,
        candidate.endTimeLocal
      )
    ) {
      continue
    }
    if (!cadencesCanCoOccur(existing, candidate as DraftShift)) continue
    return existing
  }
  return null
}

function cadenceLabel(s: DraftShift): string {
  if (s.intervalWeeks === 1) return 'Every week'
  return s.phase === 0 ? 'Every other week (A)' : 'Every other week (B)'
}

function shiftActiveThisWeek(s: DraftShift, weekSunday: Date, anchorDate: string): boolean {
  if (s.intervalWeeks === 1) return true
  const monday = mondayAfterSunday(weekSunday)
  const anchorMonday = mondayAfterSunday(sundayOf(new Date(anchorDate + 'T12:00:00')))
  const weekMs = 7 * 24 * 60 * 60 * 1000
  const weeks = Math.floor((monday.getTime() - anchorMonday.getTime()) / weekMs)
  const mod = ((weeks % 2) + 2) % 2
  return mod === s.phase
}

type DraftForm = {
  dayOfWeek: number
  startTimeLocal: string
  endTimeLocal: string
  employeeId: number | ''
  intervalWeeks: 1 | 2
  phase: 0 | 1
  editingId: string | null
}

type Props = {
  open: boolean
  onClose: () => void
}

export default function AdminOnDutyModal({ open, onClose }: Props) {
  const [weekSunday, setWeekSunday] = useState(() => sundayOf(new Date()))
  const [employees, setEmployees] = useState<DutyEmployee[]>([])
  const [shifts, setShifts] = useState<DraftShift[]>([])
  const [anchorDate, setAnchorDate] = useState(() =>
    toDateKey(mondayAfterSunday(sundayOf(new Date())))
  )
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<DraftForm | null>(null)

  const weekStartStr = toDateKey(weekSunday)
  const weekLabel = useMemo(() => {
    const end = addDays(weekSunday, 6)
    const fmt = (d: Date) =>
      d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    return `${fmt(weekSunday)} – ${fmt(end)}`
  }, [weekSunday])

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError(null)
    setForm(null)
    setWeekSunday(sundayOf(new Date()))
    Promise.all([
      fetchJson<{ employees: DutyEmployee[] }>(`${API_BASE_URL}/api/on-duty/assignees`),
      fetchJson<{
        recurrences: {
          employeeId: number
          dayOfWeek: number
          startTimeLocal: string
          endTimeLocal: string
          intervalWeeks: number
          phase: number
          anchorDate: string
          active: boolean
        }[]
      }>(`${API_BASE_URL}/api/on-duty/recurrences`),
    ])
      .then(([assignees, rec]) => {
        setEmployees(assignees.employees)
        const active = (rec.recurrences || []).filter((r) => r.active !== false)
        if (active[0]?.anchorDate) setAnchorDate(active[0].anchorDate)
        setShifts(
          active.map((r) => ({
            id: newShiftId(),
            dayOfWeek: r.dayOfWeek,
            startTimeLocal: r.startTimeLocal,
            endTimeLocal: r.endTimeLocal,
            employeeId: r.employeeId,
            intervalWeeks: r.intervalWeeks === 2 ? 2 : 1,
            phase: r.phase === 1 ? 1 : 0,
          }))
        )
      })
      .catch((e: Error) => setError(e.message || 'Failed to load'))
      .finally(() => setLoading(false))
  }, [open])

  const employeeName = (id: number) => employees.find((e) => e.id === id)?.name ?? `#${id}`

  const openAddForDay = (dayOfWeek: number) => {
    setError(null)
    setForm({
      dayOfWeek,
      startTimeLocal: '09:00',
      endTimeLocal: '17:00',
      employeeId: employees[0]?.id ?? '',
      intervalWeeks: 1,
      phase: 0,
      editingId: null,
    })
  }

  const openEdit = (shift: DraftShift) => {
    setError(null)
    setForm({
      dayOfWeek: shift.dayOfWeek,
      startTimeLocal: shift.startTimeLocal,
      endTimeLocal: shift.endTimeLocal,
      employeeId: shift.employeeId,
      intervalWeeks: shift.intervalWeeks,
      phase: shift.phase,
      editingId: shift.id,
    })
  }

  const commitForm = () => {
    if (!form || form.employeeId === '') return
    const start = hhMmToMinutes(form.startTimeLocal)
    const end = hhMmToMinutes(form.endTimeLocal)
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      setError('Enter valid start and end times.')
      return
    }
    if (start === end) {
      setError('End time must be after start (use overnight only when end is earlier next day).')
      return
    }

    const candidate: DraftShift = {
      id: form.editingId ?? newShiftId(),
      dayOfWeek: form.dayOfWeek,
      startTimeLocal: form.startTimeLocal,
      endTimeLocal: form.endTimeLocal,
      employeeId: Number(form.employeeId),
      intervalWeeks: form.intervalWeeks,
      phase: form.intervalWeeks === 2 ? form.phase : 0,
    }

    const conflict = findOverlapWith(shifts, candidate)
    if (conflict) {
      setError(
        `Overlaps ${employeeName(conflict.employeeId)} on ${DAY_LABELS[conflict.dayOfWeek]} (${conflict.startTimeLocal}–${conflict.endTimeLocal}). Only one person can be on duty at a time.`
      )
      return
    }

    setShifts((prev) => {
      if (form.editingId) {
        return prev.map((s) => (s.id === form.editingId ? candidate : s))
      }
      return [...prev, candidate]
    })
    setForm(null)
    setError(null)
  }

  const removeShift = (id: string) => {
    setShifts((prev) => prev.filter((s) => s.id !== id))
    if (form?.editingId === id) setForm(null)
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    const conflict = shifts.find((s, i) =>
      findOverlapWith(
        shifts.filter((_, j) => j !== i),
        s
      )
    )
    if (conflict) {
      const other = findOverlapWith(
        shifts.filter((s) => s.id !== conflict.id),
        conflict
      )
      setError(
        other
          ? `Overlapping shifts: ${employeeName(conflict.employeeId)} and ${employeeName(other.employeeId)} on ${DAY_LABELS[conflict.dayOfWeek]}.`
          : 'Overlapping shifts found. Fix them before saving.'
      )
      setSaving(false)
      return
    }

    try {
      const rules = shifts.map((s, i) => ({
        employeeId: s.employeeId,
        dayOfWeek: s.dayOfWeek,
        startTimeLocal: s.startTimeLocal,
        endTimeLocal: s.endTimeLocal,
        timeZone: TZ,
        intervalWeeks: s.intervalWeeks,
        phase: s.intervalWeeks === 2 ? s.phase : 0,
        priority: i,
        active: true,
      }))
      await fetchJson(`${API_BASE_URL}/api/on-duty/recurrences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anchorDate, rules }),
      })
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Admin phone on-duty</h3>
            <p className="text-sm text-slate-600 mt-1">
              Click a day to add who covers the admin line. Only one person per overlapping time —
              no double coverage on the same day.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-800 text-sm">
            Close
          </button>
        </div>

        {error && (
          <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <button
                type="button"
                className="px-3 py-1.5 border rounded-lg text-sm hover:bg-slate-50"
                onClick={() => setWeekSunday((d) => addDays(d, -7))}
              >
                ← Prev
              </button>
              <span className="text-sm font-medium text-slate-800 min-w-[160px] text-center">
                {weekLabel}
              </span>
              <button
                type="button"
                className="px-3 py-1.5 border rounded-lg text-sm hover:bg-slate-50"
                onClick={() => setWeekSunday((d) => addDays(d, 7))}
              >
                Next →
              </button>
              <button
                type="button"
                className="px-3 py-1.5 border rounded-lg text-sm hover:bg-slate-50"
                onClick={() => setWeekSunday(sundayOf(new Date()))}
              >
                This week
              </button>
              <p className="text-xs text-slate-500 ml-auto max-w-xs text-right">
                Week nav previews every-other-week rotation. Dimmed cards are off this week.
              </p>
            </div>

            {/* Week grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mb-4">
              {DAY_LABELS.map((label, dayOfWeek) => {
                const date = addDays(weekSunday, dayOfWeek)
                const dayShifts = shifts
                  .filter((s) => s.dayOfWeek === dayOfWeek)
                  .sort((a, b) => a.startTimeLocal.localeCompare(b.startTimeLocal))
                const isToday = toDateKey(date) === toDateKey(new Date())

                return (
                  <div
                    key={label}
                    className={`rounded-lg border min-h-[140px] flex flex-col ${
                      isToday ? 'border-indigo-300 bg-indigo-50/40' : 'border-slate-200 bg-slate-50/50'
                    }`}
                  >
                    <div className="px-2 pt-2 pb-1">
                      <div className="text-xs font-semibold text-slate-800">{label}</div>
                      <div className="text-[11px] text-slate-500">
                        {date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </div>
                    </div>

                    <div className="flex-1 px-1.5 space-y-1.5 pb-1.5">
                      {dayShifts.length === 0 && (
                        <p className="text-[11px] text-slate-400 px-1 py-2">Nobody on duty</p>
                      )}
                      {dayShifts.map((s) => {
                        const active = shiftActiveThisWeek(s, weekSunday, anchorDate)
                        const emp = employees.find((e) => e.id === s.employeeId)
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => openEdit(s)}
                            className={`w-full text-left rounded-md border px-2 py-1.5 transition ${
                              active
                                ? 'bg-white border-indigo-200 shadow-sm hover:border-indigo-400'
                                : 'bg-slate-100/80 border-slate-200 opacity-55 hover:opacity-80'
                            }`}
                          >
                            <div className="text-[11px] font-semibold text-slate-800 truncate">
                              {emp?.name ?? `#${s.employeeId}`}
                            </div>
                            <div className="text-[10px] text-slate-600">
                              {s.startTimeLocal}–{s.endTimeLocal}
                            </div>
                            {s.intervalWeeks === 2 && (
                              <div className="text-[10px] text-slate-500 mt-0.5">
                                {cadenceLabel(s)}
                                {!active ? ' · off' : ''}
                              </div>
                            )}
                          </button>
                        )
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={() => openAddForDay(dayOfWeek)}
                      className="m-1.5 mt-0 rounded-md border border-dashed border-slate-300 py-1 text-[11px] font-medium text-slate-600 hover:border-indigo-400 hover:text-indigo-700 hover:bg-white"
                    >
                      + Add
                    </button>
                  </div>
                )
              })}
            </div>

            {/* Add / edit panel */}
            {form && (
              <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50/50 p-4">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h4 className="text-sm font-semibold text-slate-800">
                    {form.editingId ? 'Edit shift' : 'Add shift'} · {DAY_LABELS[form.dayOfWeek]}
                  </h4>
                  <button
                    type="button"
                    className="text-xs text-slate-500 underline"
                    onClick={() => {
                      setForm(null)
                      setError(null)
                    }}
                  >
                    Cancel
                  </button>
                </div>

                <div className="flex flex-wrap gap-3 items-end">
                  <label className="text-xs flex flex-col gap-1 min-w-[160px]">
                    Person
                    <select
                      value={form.employeeId}
                      onChange={(e) =>
                        setForm((f) =>
                          f
                            ? {
                                ...f,
                                employeeId: e.target.value ? Number(e.target.value) : '',
                              }
                            : f
                        )
                      }
                      className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white"
                    >
                      {employees.length === 0 && <option value="">No eligible people</option>}
                      {employees.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name} ({e.role})
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="text-xs flex flex-col gap-1">
                    Start
                    <input
                      type="time"
                      value={form.startTimeLocal}
                      onChange={(e) =>
                        setForm((f) => (f ? { ...f, startTimeLocal: e.target.value } : f))
                      }
                      className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white"
                    />
                  </label>

                  <label className="text-xs flex flex-col gap-1">
                    End
                    <input
                      type="time"
                      value={form.endTimeLocal}
                      onChange={(e) =>
                        setForm((f) => (f ? { ...f, endTimeLocal: e.target.value } : f))
                      }
                      className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white"
                    />
                  </label>

                  <label className="text-xs flex flex-col gap-1">
                    Repeats
                    <select
                      value={form.intervalWeeks}
                      onChange={(e) =>
                        setForm((f) =>
                          f
                            ? {
                                ...f,
                                intervalWeeks: Number(e.target.value) as 1 | 2,
                                phase: Number(e.target.value) === 1 ? 0 : f.phase,
                              }
                            : f
                        )
                      }
                      className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white"
                    >
                      <option value={1}>Every week</option>
                      <option value={2}>Every other week</option>
                    </select>
                  </label>

                  {form.intervalWeeks === 2 && (
                    <label className="text-xs flex flex-col gap-1">
                      Week set
                      <select
                        value={form.phase}
                        onChange={(e) =>
                          setForm((f) =>
                            f ? { ...f, phase: Number(e.target.value) as 0 | 1 } : f
                          )
                        }
                        className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white"
                      >
                        <option value={0}>Week A (anchor week)</option>
                        <option value={1}>Week B (other week)</option>
                      </select>
                    </label>
                  )}

                  <button
                    type="button"
                    onClick={commitForm}
                    disabled={form.employeeId === '' || employees.length === 0}
                    className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 disabled:bg-slate-300"
                  >
                    {form.editingId ? 'Update' : 'Add to schedule'}
                  </button>

                  {form.editingId && (
                    <button
                      type="button"
                      onClick={() => removeShift(form.editingId!)}
                      className="px-3 py-2 text-sm text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>

                {form.intervalWeeks === 2 && (
                  <p className="text-[11px] text-slate-500 mt-2">
                    Pair Week A and Week B on the same hours to rotate two people — they never
                    overlap. Same hours with “every week” will be blocked.
                  </p>
                )}
              </div>
            )}

            <details className="mb-4 text-sm text-slate-600">
              <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-700">
                Advanced: biweekly anchor
              </summary>
              <label className="mt-2 flex items-center gap-2 text-xs">
                Anchor Monday (starts Week A)
                <input
                  type="date"
                  value={anchorDate}
                  onChange={(e) => setAnchorDate(e.target.value)}
                  className="border rounded px-2 py-1 text-sm"
                />
              </label>
            </details>

            <div className="flex justify-end gap-2 pt-1 border-t border-slate-100">
              <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg text-sm">
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void save()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:bg-gray-400"
              >
                {saving ? 'Saving…' : 'Save schedule'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

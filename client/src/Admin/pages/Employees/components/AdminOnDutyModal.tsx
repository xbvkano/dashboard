import { useEffect, useMemo, useState } from 'react'
import { API_BASE_URL, fetchJson } from '../../../../api'

type DutyEmployee = {
  id: number
  name: string
  phoneNumber: string
  role: string | null
}

type WeekBlock = {
  dayOfWeek: number
  date: string
  startTimeLocal: string
  endTimeLocal: string
  timeZone: string
  assignees: {
    employeeId: number
    name?: string
    role?: string | null
    intervalWeeks: number
    phase: number
    priority: number
  }[]
}

type DraftAssignee = {
  employeeId: number
  intervalWeeks: 1 | 2
  phase: 0 | 1
}

type DraftBlock = {
  key: string
  dayOfWeek: number
  startTimeLocal: string
  endTimeLocal: string
  assignees: DraftAssignee[]
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const TZ = 'America/Los_Angeles'

function toDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Local Sunday for the week containing `d`. */
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

/** Monday on/before Sunday week start (for biweekly anchor). */
function mondayAfterSunday(sunday: Date): Date {
  return addDays(sunday, 1)
}

type Props = {
  open: boolean
  onClose: () => void
}

export default function AdminOnDutyModal({ open, onClose }: Props) {
  const [weekSunday, setWeekSunday] = useState(() => sundayOf(new Date()))
  const [employees, setEmployees] = useState<DutyEmployee[]>([])
  const [blocks, setBlocks] = useState<DraftBlock[]>([])
  const [anchorDate, setAnchorDate] = useState(() => toDateKey(mondayAfterSunday(sundayOf(new Date()))))
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draftDay, setDraftDay] = useState(0)
  const [draftStart, setDraftStart] = useState('09:00')
  const [draftEnd, setDraftEnd] = useState('17:00')
  const [draftEmployeeId, setDraftEmployeeId] = useState<number | ''>('')
  const [draftInterval, setDraftInterval] = useState<1 | 2>(1)
  const [draftPhase, setDraftPhase] = useState<0 | 1>(0)

  const weekStartStr = toDateKey(weekSunday)
  const weekLabel = useMemo(() => {
    const end = addDays(weekSunday, 6)
    return `${weekStartStr} → ${toDateKey(end)}`
  }, [weekSunday, weekStartStr])

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError(null)
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
          priority: number
          anchorDate: string
          active: boolean
        }[]
      }>(`${API_BASE_URL}/api/on-duty/recurrences`),
      fetchJson<{ blocks: WeekBlock[] }>(
        `${API_BASE_URL}/api/on-duty/week?weekStart=${toDateKey(sundayOf(new Date()))}`
      ),
    ])
      .then(([assignees, rec, week]) => {
        setEmployees(assignees.employees)
        if (assignees.employees[0]) setDraftEmployeeId(assignees.employees[0].id)
        const active = (rec.recurrences || []).filter((r) => r.active !== false)
        if (active[0]?.anchorDate) setAnchorDate(active[0].anchorDate)
        // Build drafts from all recurrences (not only this week)
        const map = new Map<string, DraftBlock>()
        for (const r of active) {
          const key = `${r.dayOfWeek}|${r.startTimeLocal}|${r.endTimeLocal}`
          let b = map.get(key)
          if (!b) {
            b = {
              key,
              dayOfWeek: r.dayOfWeek,
              startTimeLocal: r.startTimeLocal,
              endTimeLocal: r.endTimeLocal,
              assignees: [],
            }
            map.set(key, b)
          }
          b.assignees.push({
            employeeId: r.employeeId,
            intervalWeeks: r.intervalWeeks === 2 ? 2 : 1,
            phase: r.phase === 1 ? 1 : 0,
          })
        }
        setBlocks([...map.values()])
        void week
      })
      .catch((e: Error) => setError(e.message || 'Failed to load'))
      .finally(() => setLoading(false))
  }, [open])

  const weekPreview = useMemo(() => {
    // Client-side filter for current week display from drafts + intercalation
    const monday = mondayAfterSunday(weekSunday)
    const anchorMonday = mondayAfterSunday(sundayOf(new Date(anchorDate + 'T12:00:00')))
    const weekMs = 7 * 24 * 60 * 60 * 1000
    const weeks = Math.floor((monday.getTime() - anchorMonday.getTime()) / weekMs)

    const out: { date: string; dayOfWeek: number; start: string; end: string; name: string; cadence: string }[] = []
    for (const b of blocks) {
      for (const a of b.assignees) {
        if (a.intervalWeeks === 2) {
          const mod = ((weeks % 2) + 2) % 2
          if (mod !== a.phase) continue
        }
        const date = toDateKey(addDays(weekSunday, b.dayOfWeek))
        const emp = employees.find((e) => e.id === a.employeeId)
        out.push({
          date,
          dayOfWeek: b.dayOfWeek,
          start: b.startTimeLocal,
          end: b.endTimeLocal,
          name: emp?.name ?? `#${a.employeeId}`,
          cadence:
            a.intervalWeeks === 1
              ? 'Every week'
              : a.phase === 0
                ? 'Every other week (A)'
                : 'Every other week (B)',
        })
      }
    }
    return out.sort((x, y) => x.dayOfWeek - y.dayOfWeek || x.start.localeCompare(y.start))
  }, [blocks, weekSunday, anchorDate, employees])

  const addAssigneeToBlock = () => {
    if (draftEmployeeId === '') return
    const key = `${draftDay}|${draftStart}|${draftEnd}`
    setBlocks((prev) => {
      const copy = [...prev]
      let b = copy.find((x) => x.key === key)
      if (!b) {
        b = {
          key,
          dayOfWeek: draftDay,
          startTimeLocal: draftStart,
          endTimeLocal: draftEnd,
          assignees: [],
        }
        copy.push(b)
      }
      if (b.assignees.some((a) => a.employeeId === draftEmployeeId && a.phase === draftPhase && a.intervalWeeks === draftInterval)) {
        return prev
      }
      b.assignees.push({
        employeeId: Number(draftEmployeeId),
        intervalWeeks: draftInterval,
        phase: draftInterval === 2 ? draftPhase : 0,
      })
      return copy
    })
  }

  const removeAssignee = (blockKey: string, employeeId: number, phase: number, intervalWeeks: number) => {
    setBlocks((prev) =>
      prev
        .map((b) =>
          b.key !== blockKey
            ? b
            : {
                ...b,
                assignees: b.assignees.filter(
                  (a) =>
                    !(a.employeeId === employeeId && a.phase === phase && a.intervalWeeks === intervalWeeks)
                ),
              }
        )
        .filter((b) => b.assignees.length > 0)
    )
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const rules: {
        employeeId: number
        dayOfWeek: number
        startTimeLocal: string
        endTimeLocal: string
        timeZone: string
        intervalWeeks: number
        phase: number
        priority: number
        active: boolean
      }[] = []
      let prio = 0
      for (const b of blocks) {
        for (const a of b.assignees) {
          rules.push({
            employeeId: a.employeeId,
            dayOfWeek: b.dayOfWeek,
            startTimeLocal: b.startTimeLocal,
            endTimeLocal: b.endTimeLocal,
            timeZone: TZ,
            intervalWeeks: a.intervalWeeks,
            phase: a.intervalWeeks === 2 ? a.phase : 0,
            priority: prio++,
            active: true,
          })
        }
      }
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
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Admin phone on-duty</h3>
            <p className="text-sm text-slate-600 mt-1">
              Set who answers the admin Twilio line by weekday time block. Use every-other-week to
              intercalate two people on the same hours.
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
                className="px-3 py-1.5 border rounded-lg text-sm"
                onClick={() => setWeekSunday((d) => addDays(d, -7))}
              >
                ← Prev week
              </button>
              <span className="text-sm font-medium text-slate-800 min-w-[200px] text-center">{weekLabel}</span>
              <button
                type="button"
                className="px-3 py-1.5 border rounded-lg text-sm"
                onClick={() => setWeekSunday((d) => addDays(d, 7))}
              >
                Next week →
              </button>
              <label className="text-xs text-slate-600 ml-auto flex items-center gap-2">
                Biweekly anchor (Monday)
                <input
                  type="date"
                  value={anchorDate}
                  onChange={(e) => setAnchorDate(e.target.value)}
                  className="border rounded px-2 py-1 text-sm"
                />
              </label>
            </div>

            <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <h4 className="text-sm font-semibold text-slate-700 mb-2">This week (preview)</h4>
              {weekPreview.length === 0 ? (
                <p className="text-xs text-slate-500">No one on duty this week with current rules.</p>
              ) : (
                <ul className="text-sm space-y-1">
                  {weekPreview.map((row, i) => (
                    <li key={i} className="flex flex-wrap gap-2">
                      <span className="font-medium">{DAY_LABELS[row.dayOfWeek]} {row.date}</span>
                      <span>
                        {row.start}–{row.end}
                      </span>
                      <span>{row.name}</span>
                      <span className="text-slate-500 text-xs self-center">{row.cadence}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mb-4 p-3 border border-slate-200 rounded-lg space-y-2">
              <h4 className="text-sm font-semibold text-slate-700">Add assignment</h4>
              <div className="flex flex-wrap gap-2 items-end">
                <label className="text-xs flex flex-col gap-1">
                  Day
                  <select
                    value={draftDay}
                    onChange={(e) => setDraftDay(Number(e.target.value))}
                    className="border rounded px-2 py-1 text-sm"
                  >
                    {DAY_LABELS.map((d, i) => (
                      <option key={d} value={i}>
                        {d}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs flex flex-col gap-1">
                  Start
                  <input
                    type="time"
                    value={draftStart}
                    onChange={(e) => setDraftStart(e.target.value)}
                    className="border rounded px-2 py-1 text-sm"
                  />
                </label>
                <label className="text-xs flex flex-col gap-1">
                  End
                  <input
                    type="time"
                    value={draftEnd}
                    onChange={(e) => setDraftEnd(e.target.value)}
                    className="border rounded px-2 py-1 text-sm"
                  />
                </label>
                <label className="text-xs flex flex-col gap-1">
                  Person
                  <select
                    value={draftEmployeeId}
                    onChange={(e) => setDraftEmployeeId(e.target.value ? Number(e.target.value) : '')}
                    className="border rounded px-2 py-1 text-sm min-w-[160px]"
                  >
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name} ({e.role})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs flex flex-col gap-1">
                  Cadence
                  <select
                    value={draftInterval}
                    onChange={(e) => setDraftInterval(Number(e.target.value) as 1 | 2)}
                    className="border rounded px-2 py-1 text-sm"
                  >
                    <option value={1}>Every week</option>
                    <option value={2}>Every other week</option>
                  </select>
                </label>
                {draftInterval === 2 && (
                  <label className="text-xs flex flex-col gap-1">
                    Week set
                    <select
                      value={draftPhase}
                      onChange={(e) => setDraftPhase(Number(e.target.value) as 0 | 1)}
                      className="border rounded px-2 py-1 text-sm"
                    >
                      <option value={0}>Set A (anchor week)</option>
                      <option value={1}>Set B (other week)</option>
                    </select>
                  </label>
                )}
                <button
                  type="button"
                  onClick={addAssigneeToBlock}
                  className="px-3 py-2 bg-slate-800 text-white rounded-lg text-sm hover:bg-slate-900"
                >
                  Add
                </button>
              </div>
            </div>

            <div className="mb-4 space-y-2">
              <h4 className="text-sm font-semibold text-slate-700">Saved rules (all weeks)</h4>
              {blocks.length === 0 ? (
                <p className="text-xs text-slate-500">No rules yet.</p>
              ) : (
                blocks.map((b) => (
                  <div key={b.key} className="border rounded-lg p-3 text-sm">
                    <div className="font-medium text-slate-800 mb-1">
                      {DAY_LABELS[b.dayOfWeek]} {b.startTimeLocal}–{b.endTimeLocal}
                    </div>
                    <ul className="space-y-1">
                      {b.assignees.map((a) => {
                        const emp = employees.find((e) => e.id === a.employeeId)
                        return (
                          <li key={`${a.employeeId}-${a.intervalWeeks}-${a.phase}`} className="flex justify-between gap-2">
                            <span>
                              {emp?.name ?? a.employeeId} ·{' '}
                              {a.intervalWeeks === 1
                                ? 'every week'
                                : a.phase === 0
                                  ? 'every other (A)'
                                  : 'every other (B)'}
                            </span>
                            <button
                              type="button"
                              className="text-red-600 text-xs underline"
                              onClick={() =>
                                removeAssignee(b.key, a.employeeId, a.phase, a.intervalWeeks)
                              }
                            >
                              Remove
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg text-sm">
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void save()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:bg-gray-400"
              >
                {saving ? 'Saving…' : 'Save & rematerialize'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

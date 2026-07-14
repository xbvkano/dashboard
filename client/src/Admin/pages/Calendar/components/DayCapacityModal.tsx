import { useEffect, useState } from 'react'
import { API_BASE_URL, fetchJson } from '../../../../api'
import type { Appointment } from '../types'
import {
  buildDayCapacity,
  type DayCapacityShiftSummary,
  type DeclaredAvailableEmployee,
} from '../utils/dayCapacity'

type Props = {
  date: Date
  appointments: Appointment[]
  onClose: () => void
}

function formatSelectedDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatTitle(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function ShiftCard({
  summary,
  availabilityError,
}: {
  summary: DayCapacityShiftSummary
  availabilityError: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const label = summary.slot === 'AM' ? 'Morning' : 'Afternoon'

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
      <div className="bg-slate-100 px-3 py-2 border-b border-slate-200 flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-slate-800">{label}</h4>
        <button
          type="button"
          className="text-xs font-medium text-blue-600 hover:text-blue-800"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded ? 'Hide details' : 'More details'}
        </button>
      </div>
      <div className="p-3 space-y-2 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-violet-50 px-2.5 py-2">
            <div className="text-[11px] uppercase tracking-wide text-violet-700 font-medium">
              Available
            </div>
            <div className="text-lg font-semibold text-violet-900">
              {availabilityError ? '—' : summary.availableCount}
            </div>
          </div>
          <div className="rounded-lg bg-emerald-50 px-2.5 py-2">
            <div className="text-[11px] uppercase tracking-wide text-emerald-700 font-medium">
              Scheduled
            </div>
            <div className="text-lg font-semibold text-emerald-900">{summary.scheduledCount}</div>
          </div>
          <div className="rounded-lg bg-amber-50 px-2.5 py-2">
            <div className="text-[11px] uppercase tracking-wide text-amber-700 font-medium">
              Team required
            </div>
            <div className="text-lg font-semibold text-amber-900">{summary.teamRequired}</div>
          </div>
          <div className="rounded-lg bg-slate-50 px-2.5 py-2">
            <div className="text-[11px] uppercase tracking-wide text-slate-600 font-medium">
              Appointments
            </div>
            <div className="text-lg font-semibold text-slate-900">{summary.appointmentCount}</div>
          </div>
        </div>
        {summary.shortfall > 0 && (
          <p className="text-xs text-red-700">
            Shortfall: {summary.shortfall} (required seats vs unique scheduled staff)
          </p>
        )}
        {availabilityError && (
          <p className="text-xs text-amber-700">Could not load availability for this shift.</p>
        )}
        {summary.malformedTimeCount > 0 && (
          <p className="text-xs text-amber-700">
            {summary.malformedTimeCount} appointment(s) skipped (invalid time).
          </p>
        )}
        {summary.missingTeamSizeCount > 0 && (
          <p className="text-xs text-amber-700">
            {summary.missingTeamSizeCount} appointment(s) missing team size.
          </p>
        )}

        {expanded && (
          <div className="pt-2 border-t border-slate-100 space-y-3">
            <div>
              <h5 className="text-xs font-semibold text-violet-700 mb-1">
                Available ({summary.availableEmployees.length})
              </h5>
              {summary.availableEmployees.length === 0 ? (
                <p className="text-xs text-slate-500">None</p>
              ) : (
                <ul className="text-xs text-slate-700 space-y-1">
                  {summary.availableEmployees.map((e) => (
                    <li key={e.id}>{e.name}</li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h5 className="text-xs font-semibold text-emerald-700 mb-1">
                Scheduled ({summary.scheduledEmployees.length})
              </h5>
              {summary.scheduledEmployees.length === 0 ? (
                <p className="text-xs text-slate-500">None</p>
              ) : (
                <ul className="text-xs text-slate-700 space-y-1.5">
                  {summary.scheduledEmployees.map((e) => (
                    <li key={e.id}>
                      <span className="font-medium">{e.name}</span>
                      <span className="text-slate-500"> — {e.clients.join(', ')}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h5 className="text-xs font-semibold text-amber-700 mb-1">
                Team required ({summary.teamRequired})
              </h5>
              {summary.demand.length === 0 ? (
                <p className="text-xs text-slate-500">None</p>
              ) : (
                <ul className="text-xs text-slate-700 space-y-1">
                  {summary.demand.map((d) => (
                    <li key={`${d.appointmentId ?? d.clientName}-${d.time}`}>
                      <span className="font-medium">{d.clientName}</span>
                      <span className="text-slate-500">
                        {' '}
                        — team {d.teamSize} ({d.time})
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function DayCapacityModal({ date, appointments, onClose }: Props) {
  const dateStr = formatSelectedDate(date)
  const [loading, setLoading] = useState(true)
  const [amRows, setAmRows] = useState<DeclaredAvailableEmployee[]>([])
  const [pmRows, setPmRows] = useState<DeclaredAvailableEmployee[]>([])
  const [amError, setAmError] = useState(false)
  const [pmError, setPmError] = useState(false)

  useEffect(() => {
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setAmError(false)
    setPmError(false)

    const load = async () => {
      const [amResult, pmResult] = await Promise.allSettled([
        fetchJson(
          `${API_BASE_URL}/employees/available?date=${dateStr}&time=09:00`,
        ) as Promise<DeclaredAvailableEmployee[]>,
        fetchJson(
          `${API_BASE_URL}/employees/available?date=${dateStr}&time=14:00`,
        ) as Promise<DeclaredAvailableEmployee[]>,
      ])
      if (cancelled) return
      if (amResult.status === 'fulfilled') {
        setAmRows((amResult.value ?? []).filter((e: DeclaredAvailableEmployee) => e.available))
      } else {
        setAmRows([])
        setAmError(true)
      }
      if (pmResult.status === 'fulfilled') {
        setPmRows((pmResult.value ?? []).filter((e: DeclaredAvailableEmployee) => e.available))
      } else {
        setPmRows([])
        setPmError(true)
      }
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [dateStr])

  const capacity = buildDayCapacity(appointments, amRows, pmRows)

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-3"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="day-capacity-title"
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
          <div>
            <h2 id="day-capacity-title" className="text-lg font-semibold text-slate-800">
              Day overview
            </h2>
            <p className="text-sm text-slate-500">{formatTitle(date)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          {loading ? (
            <p className="text-sm text-slate-500 text-center py-8" aria-busy="true">
              Loading staffing…
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ShiftCard summary={capacity.am} availabilityError={amError} />
              <ShiftCard summary={capacity.pm} availabilityError={pmError} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

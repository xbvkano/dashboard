import { useEffect, useMemo, useState } from 'react'
import { API_BASE_URL, fetchJson } from '../../../../api'
import {
  sortClientAppointmentsNewestFirst,
} from '../../Messages/Inbox/bookAgainSort'
import type { ClientAppointment } from '../../Messages/Inbox/messagingApi'

export type BookAgainSource = ClientAppointment & {
  templateId?: number | null
}

type Props = {
  clientId: number
  selectedSourceId?: number | null
  onPick: (appt: BookAgainSource) => void
  /** Inline sidebar vs compact list for mobile drawer */
  variant?: 'sidebar' | 'panel'
}

function formatDay(a: BookAgainSource): string {
  try {
    return (a.localDate || a.date).slice(0, 10)
  } catch {
    return String(a.date)
  }
}

export default function BookAgainHistory({
  clientId,
  selectedSourceId,
  onPick,
  variant = 'sidebar',
}: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<BookAgainSource[]>([])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchJson(
      `${API_BASE_URL}/clients/${clientId}/appointments?take=25`,
    )
      .then((rows: BookAgainSource[]) => {
        if (!cancelled) setItems(sortClientAppointmentsNewestFirst(rows))
      })
      .catch((e: unknown) => {
        console.error(e)
        if (!cancelled) setError('Could not load past appointments')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [clientId])

  const body = useMemo(() => {
    if (loading) {
      return <p className="text-sm text-slate-500 py-6 text-center">Loading…</p>
    }
    if (error) {
      return <p className="text-sm text-red-700 py-6 text-center">{error}</p>
    }
    if (!items.length) {
      return (
        <p className="text-sm text-slate-500 py-6 text-center">
          No previous appointments found.
        </p>
      )
    }
    return (
      <div
        className={
          variant === 'sidebar'
            ? 'overflow-y-auto divide-y divide-slate-100 max-h-[calc(100dvh-12rem)]'
            : 'max-h-[50vh] overflow-y-auto divide-y divide-slate-100'
        }
      >
        {items.map((a) => {
          const selected = selectedSourceId === a.id
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => onPick(a)}
              className={`w-full text-left px-4 py-3 hover:bg-slate-50 active:bg-slate-100 ${
                selected ? 'bg-blue-50' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {formatDay(a)} {a.time}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {a.type} • {a.size ?? '—'} • ${Number(a.price ?? 0).toFixed(0)}
                  </p>
                  <p className="text-xs text-slate-600 truncate mt-0.5">
                    {a.address ?? '—'}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-blue-600 font-medium">
                  {selected ? 'Selected' : 'Use'}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    )
  }, [loading, error, items, onPick, selectedSourceId, variant])

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
        <h3 className="text-sm font-semibold text-slate-900">Book again</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Copy a prior visit’s template. Choose a new date and time.
        </p>
      </div>
      {body}
    </div>
  )
}

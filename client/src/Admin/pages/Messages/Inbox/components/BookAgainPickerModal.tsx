import { useEffect, useMemo, useState } from 'react'
import { fetchClientAppointments, type ClientAppointment } from '../messagingApi'

type Props = {
  open: boolean
  clientId: number
  onClose: () => void
  onPick: (appt: ClientAppointment) => void
}

function formatDay(iso: string): string {
  try {
    return iso.slice(0, 10)
  } catch {
    return iso
  }
}

export default function BookAgainPickerModal({ open, clientId, onClose, onPick }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<ClientAppointment[]>([])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchClientAppointments(clientId, 25)
      .then((rows) => {
        if (!cancelled) setItems(rows)
      })
      .catch((e) => {
        console.error(e)
        if (!cancelled) setError('Could not load past appointments')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, clientId])

  const body = useMemo(() => {
    if (loading) {
      return <p className="text-sm text-slate-500 py-6 text-center">Loading…</p>
    }
    if (error) {
      return <p className="text-sm text-red-700 py-6 text-center">{error}</p>
    }
    if (!items.length) {
      return <p className="text-sm text-slate-500 py-6 text-center">No previous appointments found.</p>
    }
    return (
      <div className="max-h-[50vh] overflow-y-auto divide-y divide-slate-100">
        {items.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => onPick(a)}
            className="w-full text-left px-4 py-3 hover:bg-slate-50 active:bg-slate-100"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">
                  {formatDay(a.date)} {a.time}
                </p>
                <p className="text-xs text-slate-500 truncate">
                  {a.type} • {a.size ?? '—'} • ${Number(a.price ?? 0).toFixed(0)}
                </p>
                <p className="text-xs text-slate-600 truncate mt-0.5">{a.address ?? '—'}</p>
              </div>
              <span className="shrink-0 text-xs text-slate-400">Copy</span>
            </div>
          </button>
        ))}
      </div>
    )
  }, [loading, error, items, onPick])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-900">Book again</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-100 active:bg-slate-200 text-slate-600"
            aria-label="Close"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7A1 1 0 0 0 5.7 7.11L10.59 12l-4.9 4.89a1 1 0 1 0 1.41 1.42L12 13.41l4.89 4.9a1 1 0 0 0 1.42-1.41L13.41 12l4.9-4.89a1 1 0 0 0-.01-1.4z" />
            </svg>
          </button>
        </div>
        {body}
      </div>
    </div>
  )
}


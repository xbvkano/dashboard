import { useState, useEffect } from 'react'
import { API_BASE_URL } from '../../../api'

export type UpcomingAppointment = {
  id: number
  date: string
  time: string
  address: string
  instructions: string | null
  block: 'AM' | 'PM'
  pay?: number
  confirmed?: boolean
}

function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hh = ((h + 11) % 12) + 1
  return `${hh}:${String(m).padStart(2, '0')} ${ampm}`
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

// Group appointments by date, then by AM/PM block
function groupAppointments(list: UpcomingAppointment[]): Array<{
  dateStr: string
  dateLabel: string
  blocks: Array<{ block: 'AM' | 'PM'; label: string; appointments: UpcomingAppointment[] }>
}> {
  const byDate = new Map<string, UpcomingAppointment[]>()
  list.forEach((a) => {
    if (!byDate.has(a.date)) byDate.set(a.date, [])
    byDate.get(a.date)!.push(a)
  })

  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateStr, appointments]) => {
      const am = appointments.filter((a) => a.block === 'AM')
      const pm = appointments.filter((a) => a.block === 'PM')
      const blocks: Array<{ block: 'AM' | 'PM'; label: string; appointments: UpcomingAppointment[] }> = []
      if (am.length) blocks.push({ block: 'AM', label: 'AM', appointments: am })
      if (pm.length) blocks.push({ block: 'PM', label: 'PM', appointments: pm })
      return {
        dateStr,
        dateLabel: formatDate(dateStr),
        blocks,
      }
    })
}

function getHeaders(): HeadersInit {
  const h: HeadersInit = { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' }
  const userName = localStorage.getItem('userName')
  if (userName) (h as Record<string, string>)['x-user-name'] = userName
  return h
}

export default function UpcomingJobs() {
  const [list, setList] = useState<UpcomingAppointment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [confirmingId, setConfirmingId] = useState<number | null>(null)

  function loadList() {
    fetch(`${API_BASE_URL}/employee/upcoming-appointments`, { headers: getHeaders() })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load upcoming jobs')
        return res.json()
      })
      .then((data) => setList(Array.isArray(data) ? data : []))
      .catch((err) => setError(err.message || 'Failed to load'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    fetch(`${API_BASE_URL}/employee/upcoming-appointments`, { headers: getHeaders() })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load upcoming jobs')
        return res.json()
      })
      .then((data) => {
        if (!cancelled) setList(Array.isArray(data) ? data : [])
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  async function confirmJob(appointmentId: number) {
    setConfirmingId(appointmentId)
    setError('')
    try {
      const res = await fetch(`${API_BASE_URL}/employee/confirm-job`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ appointmentId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to confirm job')
      loadList()
    } catch (err: any) {
      setError(err.message || 'Failed to confirm job')
    } finally {
      setConfirmingId(null)
    }
  }

  const grouped = groupAppointments(list)

  if (loading) {
    return (
      <div className="py-4">
        <h1 className="text-xl md:text-2xl font-semibold text-slate-800 mb-4">Upcoming Jobs</h1>
        <p className="text-slate-500">Loading…</p>
      </div>
    )
  }

  return (
    <div className="pb-4">
      <h1 className="text-xl md:text-2xl font-semibold text-slate-800 mb-1 tracking-tight">Upcoming Jobs</h1>
      <p className="text-sm text-slate-500 mb-6">Your scheduled appointments for the next 14 days</p>

      {error && (
        <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">
          {error}
        </div>
      )}

      {grouped.length === 0 && !error && (
        <p className="text-slate-500">No upcoming jobs scheduled.</p>
      )}

      <div className="space-y-6">
        {grouped.map(({ dateStr, dateLabel, blocks }) => {
          const dayTotal = blocks.reduce(
            (sum, b) =>
              sum +
              b.appointments.reduce((s, a) => (a.confirmed ? s + (a.pay ?? 0) : s), 0),
            0
          )
          return (
            <div key={dateStr} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 bg-blue-600 border-b border-blue-700 flex items-center justify-between">
                <h2 className="font-semibold text-white">{dateLabel}</h2>
                <span className="text-white font-semibold">
                  Day total: ${dayTotal.toFixed(2)}
                </span>
              </div>
              <div className="divide-y divide-slate-100">
                {blocks.map(({ block, label, appointments }) => (
                  <div key={block} className="px-4 py-3">
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                      {label} block
                    </h3>
                    <ul className="space-y-3">
                      {appointments.map((a) => (
                        <li key={a.id} className="text-sm">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-medium text-slate-800">{a.address}</div>
                              <div className="text-slate-600">{formatTime(a.time)}</div>
                              {a.instructions && (
                                <div className="mt-1 text-slate-600 text-xs whitespace-pre-wrap border-l-2 border-slate-200 pl-2">
                                  {a.instructions}
                                </div>
                              )}
                            </div>
                            {a.pay != null && (
                              <span className="shrink-0 font-semibold text-slate-800">
                                ${a.pay.toFixed(2)}
                              </span>
                            )}
                          </div>
                          {a.confirmed === false && (
                            <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                              <p className="text-xs text-amber-800 mb-2">
                                If this job is not confirmed within 24 hours it may be offered to someone else.
                              </p>
                              <button
                                type="button"
                                onClick={() => confirmJob(a.id)}
                                disabled={confirmingId === a.id}
                                className="px-3 py-1.5 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50"
                              >
                                {confirmingId === a.id ? 'Confirming…' : 'Confirm Job'}
                              </button>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  appointmentCalendarDateKey,
  type Appointment,
} from '../pages/Calendar/types'
import { fetchJson } from "../../api"

interface Props {
  url: string
}

export default function AppointmentsSection({ url }: Props) {
  const [items, setItems] = useState<Appointment[]>([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const loader = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setItems([])
    setPage(0)
    setHasMore(true)
  }, [url])

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, url])

  function load() {
    fetchJson(`${url}?skip=${page * 25}&take=25`)
      .then((data: Appointment[]) => {
        setItems((prev) => (page === 0 ? data : [...prev, ...data]))
        if (data.length < 25) setHasMore(false)
      })
      .catch(() => setHasMore(false))
  }

  useEffect(() => {
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore) {
        setPage((p) => p + 1)
      }
    })
    const node = loader.current
    if (node) obs.observe(node)
    return () => {
      if (node) obs.unobserve(node)
    }
  }, [hasMore])

  const formatTime = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const hh = ((h + 11) % 12) + 1
    return `${hh}:${m.toString().padStart(2, '0')} ${ampm}`
  }

  const newestFirstAppointments = useMemo(
    () =>
      [...items].sort((a, b) => {
        const dateCompare = appointmentCalendarDateKey(b).localeCompare(appointmentCalendarDateKey(a))
        if (dateCompare !== 0) return dateCompare
        const timeCompare = String(b.time || '').localeCompare(String(a.time || ''))
        if (timeCompare !== 0) return timeCompare
        return Number(b.id || 0) - Number(a.id || 0)
      }),
    [items]
  )

  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold mb-2">Appointments</h3>
      {newestFirstAppointments.length > 0 ? (
        <ul className="space-y-2">
          {newestFirstAppointments.map((a) => (
            <li key={a.id} className="border rounded bg-white shadow">
              <Link
                to={`/dashboard/calendar?date=${appointmentCalendarDateKey(a)}&appt=${a.id}`}
                className="block p-2"
              >
                <div className="font-medium">
                  {appointmentCalendarDateKey(a)} {formatTime(a.time)} - {a.type}
                </div>
                <div className="text-sm text-gray-600">
                  {a.client?.name || ''} {a.address}
                </div>
                {a.employees && a.employees.length > 0 && (
                  <div className="text-sm text-gray-600">
                    {a.employees.map((e) => e.name).join(', ')}
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-600">No appointments found.</p>
      )}
      
      <div ref={loader} className="h-5" />
    </div>
  )
}

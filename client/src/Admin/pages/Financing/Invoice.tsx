import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { API_BASE_URL, fetchJson } from '../../../api'
import type { Appointment } from '../Calendar/types'
import CreateInvoiceModal from './components/CreateInvoiceModal'
import { formatPhone } from '../../../formatPhone'
import { clearFormPersistence } from '../../../useFormPersistence'

export default function Invoice() {
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const [date, setDate] = useState(() =>
    params.get('date') || localStorage.getItem('createInvoiceDate') || new Date().toISOString().slice(0, 10),
  )
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [selected, setSelected] = useState<Appointment | null>(null)
  const initialAppt = params.get('appt')

  useEffect(() => {
    localStorage.setItem('createInvoiceDate', date)
    fetchJson(`${API_BASE_URL}/appointments?date=${date}`)
      .then((d) => setAppointments(d))
      .catch(() => setAppointments([]))
  }, [date])

  useEffect(() => {
    if (initialAppt && appointments.length) {
      const match = appointments.find((a) => String(a.id) === initialAppt)
      if (match) {
        setSelected(match)
        return
      }
    }
    if (!selected && appointments.length) {
      const stored = localStorage.getItem('createInvoiceSelected')
      if (stored) {
        const match = appointments.find((a) => String(a.id) === stored)
        if (match) setSelected(match)
      }
    }
  }, [initialAppt, appointments, selected])

  useEffect(() => {
    if (selected) {
      localStorage.setItem('createInvoiceSelected', String(selected.id))
    } else {
      localStorage.removeItem('createInvoiceSelected')
      clearFormPersistence('createInvoiceState')
    }
  }, [selected])

  return (
    <div className="p-4 pb-16">
      <Link to=".." className="text-blue-500 text-sm">&larr; Back</Link>
      <h2 className="text-xl font-semibold mb-2">Invoice</h2>
      <div className="mb-4">
        <input type="date" className="border p-2 rounded" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className="space-y-3">
        {appointments.map((a) => (
          <div
            key={a.id}
            className="bg-white shadow rounded p-3 cursor-pointer"
            onClick={() => setSelected(a)}
          >
            <div className="font-medium">{a.client?.name}</div>
            <div className="text-sm">{formatPhone(a.client?.number || '')}</div>
            <div className="text-sm">{a.address}</div>
            {a.carpetRooms && (
              <div className="text-sm">Carpet Rooms: {a.carpetRooms}</div>
            )}
          </div>
        ))}
      </div>
      {selected && (
        <CreateInvoiceModal appointment={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}

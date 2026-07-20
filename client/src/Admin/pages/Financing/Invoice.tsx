import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
  const [estimateOpen, setEstimateOpen] = useState(false)
  const initialAppt = params.get('appt')
  const dateFromUrl = params.get('date')

  // When navigating with ?date=...&appt=..., use the URL date so we fetch the right day and can open the modal
  useEffect(() => {
    if (dateFromUrl && dateFromUrl !== date) setDate(dateFromUrl)
  }, [dateFromUrl])

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAppt, appointments])

  const initialized = useRef(false)
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true
      return
    }
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
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h2 className="text-xl font-semibold">Invoice</h2>
        <button
          type="button"
          className="px-3 py-1.5 bg-amber-600 text-white text-sm rounded hover:bg-amber-700"
          onClick={() => {
            setSelected(null)
            setEstimateOpen(true)
          }}
        >
          Create Estimate
        </button>
      </div>
      <p className="text-sm text-slate-600 mb-3">
        Pick a booking for a service invoice, or create an estimate quote without a booking.
      </p>
      <div className="mb-4">
        <input type="date" className="border p-2 rounded" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className="space-y-3">
        {appointments.map((a) => (
          <div
            key={a.id}
            className="bg-white shadow rounded p-3 cursor-pointer"
            onClick={() => {
              setEstimateOpen(false)
              setSelected(a)
            }}
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
      {selected &&
        createPortal(
          <CreateInvoiceModal
            mode="service"
            appointment={selected}
            onClose={() => setSelected(null)}
          />,
          document.body
        )}
      {estimateOpen &&
        createPortal(
          <CreateInvoiceModal
            mode="estimate"
            onClose={() => setEstimateOpen(false)}
          />,
          document.body
        )}
    </div>
  )
}

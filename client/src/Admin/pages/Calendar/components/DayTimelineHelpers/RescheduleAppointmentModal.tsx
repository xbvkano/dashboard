import { useState, useEffect } from 'react'
import { API_BASE_URL, fetchJson } from '../../../../../api'
import { useModal } from '../../../../../ModalProvider'
import type { Appointment } from '../../types'

interface RescheduleAppointmentModalProps {
  appointment: Appointment
  onClose: () => void
  onRescheduled: (newAppointment: Appointment) => void
}

function getDateStr(appointment: Appointment): string {
  const apptDate = typeof appointment.date === 'string' ? new Date(appointment.date) : appointment.date
  const year = apptDate.getFullYear()
  const month = String(apptDate.getMonth() + 1).padStart(2, '0')
  const day = String(apptDate.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function RescheduleAppointmentModal({
  appointment,
  onClose,
  onRescheduled,
}: RescheduleAppointmentModalProps) {
  const { alert } = useModal()
  const [date, setDate] = useState(() => getDateStr(appointment))
  const [time, setTime] = useState(appointment.time || '')
  const [adminId, setAdminId] = useState<number | ''>(appointment.adminId ?? '')
  const [admins, setAdmins] = useState<{ id: number; name: string | null; email: string }[]>([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchJson(`${API_BASE_URL}/admins`)
      .then((d) => setAdmins(d))
      .catch(() => setAdmins([]))
  }, [])

  const handleSubmit = async () => {
    if (!date || !time || !adminId) {
      await alert('Please provide date, time, and admin.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`${API_BASE_URL}/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' },
        body: JSON.stringify({
          clientId: appointment.clientId,
          templateId: appointment.templateId ?? undefined,
          date,
          time,
          adminId: Number(adminId),
          status: 'APPOINTED',
          employeeIds: [],
          noTeam: false,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        await alert(err.error || 'Failed to create appointment')
        return
      }
      const newAppointment = (await res.json()) as Appointment
      if (appointment.id) {
        await fetch(`${API_BASE_URL}/appointments/${appointment.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' },
          body: JSON.stringify({ status: 'RESCHEDULE_OLD' }),
        })
      }
      onRescheduled(newAppointment)
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  const blockClass = 'rounded-xl border-2 border-slate-200 bg-white p-4 shadow-sm'
  const sectionTitleClass = 'text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3'
  const btnPrimary = 'px-4 py-2 text-sm font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
  const btnCancel = 'px-4 py-2 text-sm font-medium bg-slate-200 text-slate-800 rounded-lg hover:bg-slate-300 transition-colors'
  const btnClose = 'text-slate-500 hover:text-slate-700 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-200 transition-colors'

  return (
    <div className="bg-white rounded-xl shadow-lg w-full max-w-xl overflow-hidden max-h-[90vh] flex flex-col">
      <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center gap-2 shrink-0">
        <h2 className="text-lg font-semibold text-slate-800">Reschedule Appointment</h2>
        <button type="button" onClick={onClose} className={btnClose}>
          ×
        </button>
      </div>

      <div className="p-4 space-y-4 overflow-y-auto overflow-x-hidden min-h-0 flex-1">
        <div className={blockClass}>
          <h4 className={sectionTitleClass}>Client & template</h4>
          <p className="font-medium text-slate-900">{appointment.client?.name}</p>
          <p className="text-sm text-slate-600 mt-1">
            {appointment.address} · {appointment.type?.replace(/_/g, ' ')} · {appointment.size ?? '—'}
          </p>
        </div>

        <div className={blockClass}>
          <h4 className={sectionTitleClass}>Date & time</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-slate-600 mb-1">Date</label>
              <input
                type="date"
                className="w-full border border-slate-200 p-2 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Time</label>
              <input
                type="time"
                className="w-full border border-slate-200 p-2 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setTime('09:00')}
                  className="flex-1 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
                >
                  9:00 AM
                </button>
                <button
                  type="button"
                  onClick={() => setTime('14:00')}
                  className="flex-1 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
                >
                  2:00 PM
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className={blockClass}>
          <h4 className={sectionTitleClass}>Admin</h4>
          <label className="block text-sm text-slate-600 mb-1">Admin</label>
          <select
            className="w-full border border-slate-200 p-2 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={adminId}
            onChange={(e) => setAdminId(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">Select admin</option>
            {admins.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name || a.email}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 justify-end pt-2 border-t border-slate-200">
          <button type="button" className={btnCancel} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={btnPrimary}
            disabled={submitting || !date || !time || !adminId}
            onClick={handleSubmit}
          >
            {submitting ? 'Rescheduling…' : 'Reschedule'}
          </button>
        </div>
      </div>
    </div>
  )
}

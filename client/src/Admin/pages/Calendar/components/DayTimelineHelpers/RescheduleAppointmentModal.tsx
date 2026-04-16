import { useState, useEffect } from 'react'
import {
  API_BASE_URL,
  attachApiAuthHeaders,
  attachDashboardUserHeaders,
  fetchJson,
} from '../../../../../api'
import { useModal } from '../../../../../ModalProvider'
import { appointmentCalendarDateKey, type Appointment } from '../../types'

const skipNgrokWarning =
  import.meta.env.VITE_NGROK === 'true' || import.meta.env.VITE_NGROK === '1'

async function dashboardFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  attachApiAuthHeaders(headers)
  attachDashboardUserHeaders(headers)
  if (skipNgrokWarning) headers.set('ngrok-skip-browser-warning', '1')
  return fetch(input, { ...init, headers })
}

async function resolveTemplateId(appointment: Appointment): Promise<number | null> {
  if (appointment.templateId) return appointment.templateId
  if (!appointment.clientId) return null
  const templates = (await fetchJson(
    `${API_BASE_URL}/appointment-templates?clientId=${appointment.clientId}`,
  )) as Array<{ id: number; address?: string; type?: string; size?: string | null }>
  const match = templates.find(
    (t) =>
      t.address === appointment.address &&
      t.type === appointment.type &&
      (t.size || '') === (appointment.size || ''),
  )
  return match?.id ?? null
}

function rescheduleDraftKey(appointmentId?: number) {
  return appointmentId ? `calendarRescheduleDraft:${appointmentId}` : 'calendarRescheduleDraft:unknown'
}

interface RescheduleAppointmentModalProps {
  appointment: Appointment
  onClose: () => void
  onRescheduled: (newAppointment: Appointment) => void
}

/** Format appointment date as YYYY-MM-DD for the date input (business local calendar day). */
function getDateStr(appointment: Appointment): string {
  return appointmentCalendarDateKey(appointment)
}

export default function RescheduleAppointmentModal({
  appointment,
  onClose,
  onRescheduled,
}: RescheduleAppointmentModalProps) {
  const { alert } = useModal()
  const [date, setDate] = useState(() => getDateStr(appointment))
  const [time, setTime] = useState(appointment.time || '')
  const [submitting, setSubmitting] = useState(false)

  // Restore draft (date/time) after refresh while modal was open.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(rescheduleDraftKey(appointment.id))
      if (!raw) return
      const parsed = JSON.parse(raw) as { date?: string; time?: string }
      if (parsed?.date) setDate(parsed.date)
      if (parsed?.time) setTime(parsed.time)
    } catch {
      /* ignore */
    }
    // Only restore once per appointment id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointment.id])

  // Persist draft while typing.
  useEffect(() => {
    try {
      localStorage.setItem(rescheduleDraftKey(appointment.id), JSON.stringify({ date, time }))
    } catch {
      /* ignore */
    }
  }, [appointment.id, date, time])

  const handleSubmit = async () => {
    if (!date || !time) {
      await alert('Please provide date and time.')
      return
    }
    const templateId = await resolveTemplateId(appointment)
    const payload = {
      clientId: appointment.clientId,
      templateId,
      date,
      time,
      status: 'APPOINTED' as const,
      employeeIds: [] as number[],
      noTeam: false,
    }
    console.log('[RescheduleAppointmentModal] submit', {
      appointmentId: appointment.id,
      hadTemplateIdOnAppt: appointment.templateId,
      resolvedTemplateId: templateId,
      clientId: appointment.clientId,
      date,
      time,
      userIdHeader: (() => {
        try {
          return localStorage.getItem('userId')
        } catch {
          return null
        }
      })(),
    })
    if (!templateId) {
      await alert(
        'Could not find an appointment template for this job. Add or link a template for the client, then try again.',
      )
      return
    }
    setSubmitting(true)
    try {
      const res = await dashboardFetch(`${API_BASE_URL}/appointments`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.warn('[RescheduleAppointmentModal] POST /appointments failed', res.status, err)
        await alert(err.error || 'Failed to create appointment')
        return
      }
      const newAppointment = (await res.json()) as Appointment
      if (appointment.id) {
        const putRes = await dashboardFetch(`${API_BASE_URL}/appointments/${appointment.id}`, {
          method: 'PUT',
          body: JSON.stringify({ status: 'RESCHEDULE_OLD' }),
        })
        if (!putRes.ok) {
          const putErr = await putRes.json().catch(() => ({}))
          console.warn('[RescheduleAppointmentModal] PUT mark RESCHEDULE_OLD failed', putRes.status, putErr)
        }
      }
      try {
        localStorage.removeItem(rescheduleDraftKey(appointment.id))
      } catch {
        /* ignore */
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
        <button
          type="button"
          onClick={() => {
            try {
              localStorage.removeItem(rescheduleDraftKey(appointment.id))
            } catch {
              /* ignore */
            }
            onClose()
          }}
          className={btnClose}
        >
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

        <div className="flex gap-2 justify-end pt-2 border-t border-slate-200">
          <button
            type="button"
            className={btnCancel}
            onClick={() => {
              try {
                localStorage.removeItem(rescheduleDraftKey(appointment.id))
              } catch {
                /* ignore */
              }
              onClose()
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            className={btnPrimary}
            disabled={submitting || !date || !time}
            onClick={handleSubmit}
          >
            {submitting ? 'Rescheduling…' : 'Reschedule'}
          </button>
        </div>
      </div>
    </div>
  )
}

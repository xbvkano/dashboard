import type { CSSProperties } from 'react'
import { formatPhone } from '../../../../../formatPhone'
import type { Appointment } from '../../types'

type StatusTone = {
  bg: string
  border: string
  accent: string
}

function appointmentTone(appt: Appointment): StatusTone {
  if (appt.status === 'RECURRING_UNCONFIRMED') {
    return {
      bg: 'bg-blue-100',
      border: 'border-blue-300',
      accent: 'bg-blue-500',
    }
  }
  if (appt.paid) {
    return {
      bg: 'bg-green-100',
      border: 'border-green-300',
      accent: 'bg-green-500',
    }
  }
  if (appt.status === 'CANCEL') {
    return {
      bg: 'bg-gray-100',
      border: 'border-gray-300',
      accent: 'bg-gray-500',
    }
  }
  if (appt.observe) {
    return {
      bg: 'bg-yellow-100',
      border: 'border-yellow-300',
      accent: 'bg-yellow-500',
    }
  }
  return {
    bg: 'bg-red-100',
    border: 'border-red-300',
    accent: 'bg-red-500',
  }
}

function serviceLabel(type: Appointment['type']): string {
  switch (type) {
    case 'DEEP':
      return 'Deep Clean'
    case 'MOVE_IN_OUT':
      return 'Move In/Out'
    default:
      return 'Standard'
  }
}

function teamStatus(appt: Appointment): { label: string; dot: string } {
  if (appt.noTeam) return { label: 'No team assigned', dot: 'bg-purple-500' }
  if (appt.infoSent) return { label: 'Info sent', dot: 'bg-green-500' }
  return { label: 'Info not sent', dot: 'bg-red-500' }
}

interface AppointmentCardProps {
  appointment: Appointment
  style: CSSProperties
  onClick: () => void
}

export default function AppointmentCard({ appointment, style, onClick }: AppointmentCardProps) {
  const tone = appointmentTone(appointment)
  const status = teamStatus(appointment)
  const employees = appointment.employees ?? []
  const phone = appointment.client?.number ? formatPhone(appointment.client.number) : null

  return (
    <button
      type="button"
      onClick={onClick}
      className={`absolute overflow-hidden rounded-lg border text-left shadow-sm hover:shadow-md transition-shadow cursor-pointer ${tone.bg} ${tone.border}`}
      style={{ ...style, zIndex: 10 }}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${tone.accent}`} aria-hidden />
      <div className="pl-2.5 pr-1.5 py-1 h-full flex flex-col gap-1 min-h-0 overflow-hidden">
        {/* Client */}
        <section className="min-w-0">
          <div className="text-[9px] font-semibold uppercase tracking-wide text-slate-500 leading-none mb-0.5">
            Client
          </div>
          <div className="flex items-start justify-between gap-1 min-w-0">
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-semibold text-slate-900 truncate leading-tight">
                {appointment.client?.name || 'Client'}
              </div>
              {phone ? (
                <div className="text-[10px] text-slate-600 truncate leading-tight">{phone}</div>
              ) : null}
            </div>
            <span
              className={`mt-0.5 shrink-0 w-2.5 h-2.5 rounded-sm ${status.dot}`}
              title={status.label}
              aria-label={status.label}
            />
          </div>
        </section>

        {/* Service */}
        <section className="min-w-0">
          <div className="text-[9px] font-semibold uppercase tracking-wide text-slate-500 leading-none mb-0.5">
            Service
          </div>
          <div className="text-[11px] font-medium text-slate-800 truncate leading-tight">
            {serviceLabel(appointment.type)}
            {appointment.size ? ` · ${appointment.size}` : ''}
          </div>
          {appointment.status === 'RECURRING_UNCONFIRMED' ? (
            <div className="text-[10px] font-medium text-blue-700 truncate">Needs confirmation</div>
          ) : null}
          {appointment.paid ? (
            <div className="text-[10px] font-medium text-green-700 truncate">Paid</div>
          ) : null}
        </section>

        {/* Team */}
        <section className="min-w-0 flex-1 min-h-0 overflow-hidden">
          <div className="text-[9px] font-semibold uppercase tracking-wide text-slate-500 leading-none mb-0.5">
            Team
          </div>
          <div className="text-[10px] text-slate-700 leading-tight">
            {employees.length > 0 ? (
              employees.map((e) => (
                <div key={e.id} className="truncate">
                  {e.name}
                </div>
              ))
            ) : (
              <div className="italic text-slate-500">{status.label}</div>
            )}
          </div>
          {employees.length > 0 ? (
            <div className="text-[9px] text-slate-500 truncate mt-0.5">{status.label}</div>
          ) : null}
        </section>
      </div>
    </button>
  )
}

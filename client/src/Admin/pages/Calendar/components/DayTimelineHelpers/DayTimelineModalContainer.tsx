import { useState, useEffect } from 'react'
import { API_BASE_URL, fetchJson } from '../../../../../api'
import type { Appointment } from '../../types'
import AppointmentDetails from './AppointmentDetails'
import TeamOptionsModal from './TeamOptionsModal'
import RescheduleAppointmentModal from './RescheduleAppointmentModal'
import { MODAL_Z } from '../../../../../modalLayers'

export type DayTimelineModalView = 'details' | 'team-options' | 'reschedule'

interface DayTimelineModalContainerProps {
  view: DayTimelineModalView
  appointment: Appointment
  onClose: () => void
  onUpdate: (appointment: Appointment) => void
  onViewChange: (view: DayTimelineModalView) => void
  onCreate: (appt: Appointment, status: Appointment['status']) => void
  onEdit: (appt: Appointment) => void
  onRescheduled?: (newAppointment: Appointment) => void
  onNavigateToDate?: (date: Date) => void
  onRefresh?: () => void
  onRequestSkip?: () => void
  onRequestConfirm?: () => void
  /** When provided, show "View in Calendar" button (e.g. when modal is open from Schedule page). */
  onViewInCalendar?: () => void
}

/**
 * Single container for appointment-related modals. Renders one overlay and switches
 * content by view (details vs team-options). Each modal lives in its own file under DayTimelineHelpers.
 */
export default function DayTimelineModalContainer({
  view,
  appointment,
  onClose,
  onUpdate,
  onViewChange,
  onCreate,
  onEdit,
  onRescheduled,
  onNavigateToDate,
  onRefresh,
  onRequestSkip,
  onRequestConfirm,
  onViewInCalendar,
}: DayTimelineModalContainerProps) {
  const [template, setTemplate] = useState<{ teamSize?: number } | null>(null)

  useEffect(() => {
    if (!appointment.clientId) return
    fetchJson(`${API_BASE_URL}/appointment-templates?clientId=${appointment.clientId}`)
      .then((templates: any[]) => {
        let match: any = null
        if (appointment.templateId) {
          match = templates.find((t: any) => t.id === appointment.templateId)
        }
        if (!match) {
          match = templates.find(
            (t: any) =>
              t.address === appointment.address &&
              t.type === appointment.type &&
              (t.size || '') === (appointment.size || '')
          )
        }
        if (match) setTemplate(match)
      })
      .catch(() => {})
  }, [appointment.clientId, appointment.templateId, appointment.address, appointment.type, appointment.size])

  const templateTeamSize = template?.teamSize

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 overflow-hidden overscroll-none"
      style={{ zIndex: MODAL_Z }}
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      onWheel={(e) => e.preventDefault()}
      onTouchMove={(e) => e.preventDefault()}
    >
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" />
      <div
        className={`relative z-[1] w-full max-w-xl max-h-[90vh] min-h-0 overflow-y-auto overflow-x-hidden flex flex-col items-center overscroll-contain ${view === 'team-options' || view === 'reschedule' ? 'justify-center' : 'justify-start'}`}
        onClick={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        {view === 'details' && (
          <AppointmentDetails
            appointment={appointment}
            onUpdate={onUpdate}
            onClose={onClose}
            onCreate={onCreate}
            onEdit={onEdit}
            onNavigateToDate={onNavigateToDate}
            onRefresh={onRefresh}
            onRequestSkip={onRequestSkip}
            onRequestConfirm={onRequestConfirm}
            onOpenTeamOptions={() => onViewChange('team-options')}
            onOpenReschedule={() => onViewChange('reschedule')}
            onViewInCalendar={onViewInCalendar}
          />
        )}
        {view === 'team-options' && (
          <TeamOptionsModal
            appointment={appointment}
            onClose={() => onViewChange('details')}
            onSave={(updated) => {
              onUpdate(updated)
              onViewChange('details')
            }}
            templateTeamSize={templateTeamSize}
            embed
          />
        )}
        {view === 'reschedule' && onRescheduled && (
          <RescheduleAppointmentModal
            appointment={appointment}
            onClose={() => onViewChange('details')}
            onRescheduled={onRescheduled}
          />
        )}
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { API_BASE_URL, fetchJson } from '../../../../../api'
import type { Appointment } from '../../types'
import AppointmentDetails from './AppointmentDetails'
import TeamOptionsModal from './TeamOptionsModal'
import EditAppointmentModal from './EditAppointmentModal'

export type DayTimelineModalView = 'details' | 'team-options' | 'edit'

interface DayTimelineModalContainerProps {
  view: DayTimelineModalView
  appointment: Appointment
  onClose: () => void
  onUpdate: (appointment: Appointment) => void
  onViewChange: (view: DayTimelineModalView) => void
  onCreate: (appt: Appointment, status: Appointment['status']) => void
  onEdit: (appt: Appointment) => void
  onNavigateToDate?: (date: Date) => void
  onRefresh?: () => void
  onRequestSkip?: () => void
  onRequestConfirm?: () => void
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
  onNavigateToDate,
  onRefresh,
  onRequestSkip,
  onRequestConfirm,
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
    <>
      {/* When editing, CreateAppointmentModal has its own overlay; hide ours so we don't get double gray */}
      {view !== 'edit' && (
        <div
          className="fixed inset-0 bg-black/50"
          style={{ zIndex: 9999 }}
          onClick={onClose}
        />
      )}
      <div
        className="fixed inset-0 flex items-center justify-center p-4"
        style={{ zIndex: 10000 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`w-full max-w-xl max-h-[90vh] min-h-0 overflow-y-auto overflow-x-hidden flex flex-col items-center ${view === 'team-options' || view === 'edit' ? 'justify-center' : 'justify-start'}`}
          onClick={(e) => e.stopPropagation()}
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
              onOpenEdit={() => onViewChange('edit')}
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
          {view === 'edit' && (
            <EditAppointmentModal
              appointment={appointment}
              onClose={() => onViewChange('details')}
              onSaved={(updated) => {
                onUpdate(updated)
                onViewChange('details')
              }}
            />
          )}
        </div>
      </div>
    </>
  )
}

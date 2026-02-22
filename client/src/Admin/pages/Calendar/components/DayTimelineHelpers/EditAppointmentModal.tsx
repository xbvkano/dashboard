import CreateAppointmentModal from '../CreateAppointmentModal'
import type { Appointment } from '../../types'

interface EditAppointmentModalProps {
  appointment: Appointment
  onClose: () => void
  onSaved: (appointment: Appointment) => void
}

/**
 * Edit appointment modal: wraps CreateAppointmentModal in edit mode.
 * Shown inside DayTimelineModalContainer when view is 'edit' so appointment details
 * go away and only this modal is visible.
 * Passes client and template ids so template, date, and time are pre-selected.
 */
export default function EditAppointmentModal({
  appointment,
  onClose,
  onSaved,
}: EditAppointmentModalProps) {
  return (
    <CreateAppointmentModal
      initialClientId={appointment.clientId}
      initialTemplateId={appointment.templateId ?? undefined}
      initialAppointment={appointment}
      onClose={onClose}
      onCreated={onSaved}
    />
  )
}

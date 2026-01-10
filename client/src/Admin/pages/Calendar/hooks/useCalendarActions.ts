import { API_BASE_URL, fetchJson } from '../../../../api'
import type { Appointment } from '../types'

export function useCalendarActions(
  setCreateParams: (params: {
    clientId?: number
    templateId?: number | null
    status?: Appointment['status']
    appointment?: Appointment
  } | null) => void,
  setRescheduleOldId: (id: number | null) => void,
  setDeleteOldId: (id: number | null) => void,
  refresh: () => void,
  refreshMonthCounts: (date?: Date) => void,
  refreshWeekCounts: (date?: Date) => void,
  setSelected: (date: Date) => void
) {
  const handleUpdate = (updated: Appointment) => {
    // keep data in sync
    refresh()
    // Extract UTC date components to create local date with same calendar day
    const apptDate = typeof updated.date === 'string' ? new Date(updated.date) : updated.date
    const localDate = new Date(
      apptDate.getUTCFullYear(),
      apptDate.getUTCMonth(),
      apptDate.getUTCDate()
    )
    refreshMonthCounts(localDate)
    refreshWeekCounts(localDate)
  }

  const handleCreateFrom = async (appt: Appointment, status: Appointment['status']) => {
    if (status === 'RESCHEDULE_NEW') {
      setRescheduleOldId(appt.id!)
    } else {
      setRescheduleOldId(null)
    }
    try {
      const templates = await fetchJson(
        `${API_BASE_URL}/appointment-templates?clientId=${appt.clientId}`
      )
      const match = templates.find(
        (t: any) => t.address === appt.address && t.type === appt.type && t.size === appt.size
      )
      setCreateParams({ clientId: appt.clientId, templateId: match?.id ?? null, status })
    } catch {
      setCreateParams({ clientId: appt.clientId, status })
    }
  }

  const handleEdit = async (appt: Appointment) => {
    localStorage.removeItem('createAppointmentState')
    setDeleteOldId(null)
    setRescheduleOldId(null)
    try {
      const templates = await fetchJson(
        `${API_BASE_URL}/appointment-templates?clientId=${appt.clientId}`
      )
      const match = templates.find(
        (t: any) => t.address === appt.address && t.type === appt.type && t.size === appt.size
      )
      setCreateParams({
        clientId: appt.clientId,
        templateId: match?.id ?? null,
        status: appt.status,
        appointment: appt,
      })
    } catch {
      setCreateParams({ clientId: appt.clientId, status: appt.status, appointment: appt })
    }
  }

  const markOldReschedule = async (id: number) => {
    try {
      await fetchJson(`${API_BASE_URL}/appointments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'RESCHEDULE_OLD' }),
      })
    } catch {}
  }

  const markOldDelete = async (id: number) => {
    try {
      await fetchJson(`${API_BASE_URL}/appointments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'DELETED' }),
      })
    } catch {}
  }

  const handleCreated = async (appt: Appointment, rescheduleOldId: number | null, deleteOldId: number | null) => {
    if (rescheduleOldId) {
      await markOldReschedule(rescheduleOldId)
    }
    if (deleteOldId) {
      await markOldDelete(deleteOldId)
    }
    // Navigate to the appointment date
    // Server sends UTC dates, we need to extract UTC date components and create a local date
    // with the same calendar day (e.g., Jan 18 UTC -> Jan 18 local)
    const apptDate = typeof appt.date === 'string' ? new Date(appt.date) : appt.date
    const appointmentDate = new Date(
      apptDate.getUTCFullYear(),  // Use UTC methods to get the calendar day
      apptDate.getUTCMonth(),
      apptDate.getUTCDate()
    )
    
    setSelected(appointmentDate)
    refresh()
    refreshMonthCounts(appointmentDate)
    refreshWeekCounts(appointmentDate)
    // Return the appointment ID so it can be scrolled to
    return appt.id
  }

  return {
    handleUpdate,
    handleCreateFrom,
    handleEdit,
    handleCreated,
  }
}

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
  refreshWeekCounts: (date?: Date) => void
) {
  const handleUpdate = (updated: Appointment) => {
    // keep data in sync
    refresh()
    refreshMonthCounts(new Date(updated.date))
    refreshWeekCounts(new Date(updated.date))
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
    refresh()
    refreshMonthCounts(new Date(appt.date))
    refreshWeekCounts(new Date(appt.date))
  }

  return {
    handleUpdate,
    handleCreateFrom,
    handleEdit,
    handleCreated,
  }
}

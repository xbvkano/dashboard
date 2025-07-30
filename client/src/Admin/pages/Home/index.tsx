import React, { useEffect, useState } from 'react'
import { API_BASE_URL, fetchJson } from '../../../api'
import type { Appointment } from '../Calendar/types'
import CreateAppointmentModal from '../Calendar/components/CreateAppointmentModal'
import HomePanel, { HomePanelCard } from './HomePanel'

export default function Home() {
  const [items, setItems] = useState<Appointment[]>([])
  const [editParams, setEditParams] = useState<{
    clientId?: number
    templateId?: number | null
    status?: Appointment['status']
    appointment?: Appointment
  } | null>(null)

  const load = () => {
    fetchJson(`${API_BASE_URL}/appointments/no-team`)
      .then((d) => setItems(d))
      .catch(() => setItems([]))
  }

  useEffect(() => {
    load()
  }, [])

  const handleEdit = async (appt: Appointment) => {
    localStorage.removeItem('createAppointmentState')
    try {
      const templates = await fetchJson(
        `${API_BASE_URL}/appointment-templates?clientId=${appt.clientId}`,
      )
      const match = templates.find(
        (t: any) => t.address === appt.address && t.type === appt.type && t.size === appt.size,
      )
      setEditParams({
        clientId: appt.clientId,
        templateId: match?.id ?? null,
        status: appt.status,
        appointment: appt,
      })
    } catch {
      setEditParams({ clientId: appt.clientId, status: appt.status, appointment: appt })
    }
  }

  const formatTime = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const hh = ((h + 11) % 12) + 1
    return `${hh}:${m.toString().padStart(2, '0')} ${ampm}`
  }

  const cards: HomePanelCard[] = items.map((a) => ({
    key: a.id!,
    content: (
      <div>
        <div className="font-medium">{a.client?.name}</div>
        <div className="text-sm text-gray-600">
          {a.date.slice(0, 10)} {formatTime(a.time)}
        </div>
      </div>
    ),
    actionLabel: 'View',
    onAction: () => handleEdit(a),
  }))

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-semibold">Home</h2>
      <HomePanel title="Appointments with no teams" cards={cards} />
      {editParams && (
        <CreateAppointmentModal
          onClose={() => setEditParams(null)}
          onCreated={load}
          initialClientId={editParams.clientId}
          initialTemplateId={editParams.templateId ?? undefined}
          newStatus={editParams.status}
          initialAppointment={editParams.appointment}
        />
      )}
    </div>
  )
}

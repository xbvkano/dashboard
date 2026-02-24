import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_BASE_URL, fetchJson } from '../../../api'
import { isDevToolsEnabled } from '../../../devTools'
import { useModal } from '../../../ModalProvider'
import type { Appointment } from '../Calendar/types'
import CreateAppointmentModal from '../Calendar/components/CreateAppointmentModal'
import HomePanel, { HomePanelCard } from './HomePanel'

export default function Home() {
  const { confirm } = useModal()
  const navigate = useNavigate()
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
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Home</h2>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/dashboard/recurring')}
            className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
          >
            Recurring Appointments
          </button>
          {isDevToolsEnabled && (
            <button
              onClick={() => navigate('/dashboard/devtools')}
              className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
            >
              Dev Tools
            </button>
          )}
        </div>
      </div>
      <HomePanel title="Appointments with no teams" cards={cards} />
      {editParams && (
        <CreateAppointmentModal
          onClose={() => setEditParams(null)}
          onCreated={async (appt) => {
            load()
          }}
          initialClientId={editParams.clientId}
          initialTemplateId={editParams.templateId ?? undefined}
          newStatus={editParams.status}
          initialAppointment={editParams.appointment}
        />
      )}
    </div>
  )
}

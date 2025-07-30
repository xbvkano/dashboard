import React, { useEffect, useState } from 'react'
import { API_BASE_URL, fetchJson } from '../../../api'
import type { Appointment } from '../Calendar/types'
import CreateAppointmentModal from '../Calendar/components/CreateAppointmentModal'
import HomePanel, { HomePanelCard } from './HomePanel'

export default function Home() {
  const [items, setItems] = useState<Appointment[]>([])
  const [upcoming, setUpcoming] = useState<(Appointment & { daysLeft: number })[]>([])
  const [doneUpcoming, setDoneUpcoming] = useState<number[]>([])
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
    fetchJson(`${API_BASE_URL}/appointments/upcoming-recurring`)
      .then((d) => {
        setUpcoming(d)
        setDoneUpcoming(d.filter((a: any) => a.recurringDone).map((a: any) => a.id))
      })
      .catch(() => {
        setUpcoming([])
        setDoneUpcoming([])
      })
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

  const upcomingCards: HomePanelCard[] = upcoming
    .slice()
    .sort((a1, a2) => {
      const d1 = doneUpcoming.includes(a1.id!)
      const d2 = doneUpcoming.includes(a2.id!)
      if (d1 === d2) return 0
      return d1 ? 1 : -1
    })
    .map((a) => {
      const nextAppt = { ...a, date: a.reocuringDate }
      const done = doneUpcoming.includes(a.id!)
      return {
        key: a.id!,
        content: (
          <div>
            <div className="font-medium">{a.client?.name}</div>
            <div className="text-sm text-gray-600">In {a.daysLeft} days</div>
          </div>
        ),
        actionLabel: 'View',
        onAction: () => handleEdit(nextAppt),
        done,
        onToggleDone: async (checked: boolean) => {
          try {
            await fetchJson(`${API_BASE_URL}/appointments/${a.id}/recurring-done`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ done: checked }),
            })
            setDoneUpcoming((prev) =>
              checked ? [...prev, a.id!] : prev.filter((id) => id !== a.id!)
            )
          } catch (err) {
            console.error('Failed to update recurring done state', err)
          }
        },
      }
    })

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-semibold">Home</h2>
      <HomePanel title="Upcoming Reocurring" cards={upcomingCards} />
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

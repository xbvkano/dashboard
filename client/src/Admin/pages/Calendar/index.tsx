import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { API_BASE_URL, fetchJson } from '../../../api'
import MonthSelector from './components/MonthSelector'
import WeekSelector from './components/WeekSelector'
import DayTimeline from './components/DayTimeline'
import CreateAppointmentModal from './components/CreateAppointmentModal'
import type { Appointment } from './types'

function startOfWeek(date: Date) {
  const day = date.getDay()
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - day)
}

function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, date.getDate())
}

export default function Calendar() {
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const queryDate = params.get('date')
  const queryAppt = params.get('appt')

  const [selected, setSelected] = useState(() => {
    if (queryDate) {
      const d = new Date(queryDate)
      if (!isNaN(d.getTime())) return d
    }
    const stored = localStorage.getItem('calendarSelectedDate')
    if (stored) {
      try {
        const { value, savedAt } = JSON.parse(stored) as {
          value: string
          savedAt: string
        }
        const saved = new Date(savedAt)
        const now = new Date()
        if (
          saved.getFullYear() === now.getFullYear() &&
          saved.getMonth() === now.getMonth() &&
          saved.getDate() === now.getDate()
        ) {
          return new Date(value)
        }
      } catch {
        // ignore parse errors and fall back to today
      }
    }
    return new Date()
  })
  const [showMonth, setShowMonth] = useState(false)
  const [nowOffset, setNowOffset] = useState<number | null>(null)
  const [monthInfo, setMonthInfo] = useState<{ startDay: number; endDay: number; daysInMonth: number } | null>(null)
  const [monthCounts, setMonthCounts] = useState<Record<string, number>>({})
  const [weekCounts, setWeekCounts] = useState<Record<string, number>>({})
  const [appointments, setAppointments] = useState<{
    prev: Appointment[]
    current: Appointment[]
    next: Appointment[]
  }>({ prev: [], current: [], next: [] })
  const [createParams, setCreateParams] = useState<{
    clientId?: number
    templateId?: number | null
    status?: Appointment['status']
    appointment?: Appointment
  } | null>(() => {
    const stored = localStorage.getItem('createParams')
    if (stored) {
      try {
        return JSON.parse(stored)
      } catch {}
    }
    return null
  })
  const [rescheduleOldId, setRescheduleOldId] = useState<number | null>(() => {
    const stored = localStorage.getItem('rescheduleOldId')
    return stored ? Number(stored) : null
  })
  const [deleteOldId, setDeleteOldId] = useState<number | null>(null)

  const refreshMonthCounts = (d = selected) => {
    const year = d.getFullYear()
    const month = d.getMonth() + 1
    fetchJson(`${API_BASE_URL}/appointments/month-counts?year=${year}&month=${month}`)
      .then((data) => setMonthCounts(data as Record<string, number>))
      .catch(() => {})
  }

  const refreshWeekCounts = (d = selected) => {
    const start = startOfWeek(d)
    const end = addDays(start, 7)
    const startStr = start.toISOString().slice(0, 10)
    const endStr = end.toISOString().slice(0, 10)
    fetchJson(
      `${API_BASE_URL}/appointments/range-counts?start=${startStr}&end=${endStr}`,
    )
      .then((data) => setWeekCounts(data as Record<string, number>))
      .catch(() => {})
  }

  const handleUpdate = (updated: Appointment) => {
    setAppointments((appts) => {
      const replace = (list: Appointment[]) =>
        list.map((a) => (a.id === updated.id ? updated : a))
      return {
        prev: replace(appts.prev),
        current: replace(appts.current),
        next: replace(appts.next),
      }
    })
    // keep data in sync
    refresh(selected)
    refreshMonthCounts(new Date(updated.date))
    refreshWeekCounts(new Date(updated.date))
  }

  useEffect(() => {
    const data = {
      value: selected.toISOString(),
      savedAt: new Date().toISOString(),
    }
    localStorage.setItem('calendarSelectedDate', JSON.stringify(data))
  }, [selected])

  useEffect(() => {
    if (createParams) {
      localStorage.setItem('createParams', JSON.stringify(createParams))
    } else {
      localStorage.removeItem('createParams')
    }
  }, [createParams])

  useEffect(() => {
    if (rescheduleOldId === null) {
      localStorage.removeItem('rescheduleOldId')
    } else {
      localStorage.setItem('rescheduleOldId', String(rescheduleOldId))
    }
  }, [rescheduleOldId])

  const refresh = (d = selected) => {
    const fetchDay = (day: Date) =>
      fetchJson(`${API_BASE_URL}/appointments?date=${day.toISOString().slice(0, 10)}`)
        .then((res) => res as Appointment[])
        .catch(() => [])
    Promise.all([
      fetchDay(addDays(d, -1)),
      fetchDay(d),
      fetchDay(addDays(d, 1)),
    ]).then(([prev, current, next]) => setAppointments({ prev, current, next }))
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

  useEffect(() => {
    const year = selected.getFullYear()
    const month = selected.getMonth() + 1
    fetchJson(`${API_BASE_URL}/month-info?year=${year}&month=${month}`)
      .then((data) => setMonthInfo(data))
      .catch(() => setMonthInfo(null))
    refreshMonthCounts(new Date(year, month - 1, 1))
  }, [selected.getFullYear(), selected.getMonth()])

  useEffect(() => {
    refreshWeekCounts(selected)
  }, [selected])

  useEffect(() => {
    refresh(selected)
  }, [selected])

  const weekStart = startOfWeek(selected)
  const days = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i))

  const prevMonth = () => setSelected((d) => addMonths(d, -1))
  const nextMonth = () => setSelected((d) => addMonths(d, 1))
  const prevWeek = () => setSelected((d) => addDays(d, -7))
  const nextWeek = () => setSelected((d) => addDays(d, 7))
  const prevDay = () => setSelected((d) => addDays(d, -1))
  const nextDay = () => setSelected((d) => addDays(d, 1))

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

  useEffect(() => {
    const update = () => {
      const now = new Date()
      const offset = now.getHours() * 84 + (now.getMinutes() / 60) * 84
      setNowOffset(offset)
    }
    update()
    const id = setInterval(update, 60000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10 bg-white">
        <MonthSelector
          selected={selected}
          setSelected={setSelected}
          show={showMonth}
          setShow={setShowMonth}
          monthInfo={monthInfo}
          counts={monthCounts}
        />
        <WeekSelector
          days={days}
          selected={selected}
          setSelected={setSelected}
          showMonth={showMonth}
          prevWeek={prevWeek}
          nextWeek={nextWeek}
          counts={weekCounts}
        />
      </div>
        <DayTimeline
          nowOffset={nowOffset}
          prevDay={prevDay}
          nextDay={nextDay}
          appointments={appointments.current}
          prevAppointments={appointments.prev}
          nextAppointments={appointments.next}
          initialApptId={queryAppt ? Number(queryAppt) : undefined}
          onUpdate={handleUpdate}
          onCreate={(appt, status) => handleCreateFrom(appt, status)}
          onEdit={handleEdit}
        />
      <button
        className="fixed bottom-20 right-6 w-12 h-12 rounded-full bg-black text-white text-2xl flex items-center justify-center"
        onClick={() => setCreateParams({})}
      >
        +
      </button>
        {createParams && (
          <CreateAppointmentModal
            onClose={() => {
              setCreateParams(null)
              setRescheduleOldId(null)
              setDeleteOldId(null)
            }}
            onCreated={async (appt) => {
              if (rescheduleOldId) {
                await markOldReschedule(rescheduleOldId)
                setRescheduleOldId(null)
              }
              if (deleteOldId) {
                await markOldDelete(deleteOldId)
                setDeleteOldId(null)
              }
              refresh()
              refreshMonthCounts(new Date(appt.date))
              refreshWeekCounts(new Date(appt.date))
            }}
            initialClientId={createParams.clientId}
            initialTemplateId={createParams.templateId ?? undefined}
            newStatus={createParams.status}
            initialAppointment={createParams.appointment}
          />
        )}
    </div>
  )
}

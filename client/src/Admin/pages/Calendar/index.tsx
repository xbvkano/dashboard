import { useEffect, useState } from 'react'
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
  const [selected, setSelected] = useState(() => {
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
  const [appointments, setAppointments] = useState<{
    prev: Appointment[]
    current: Appointment[]
    next: Appointment[]
  }>({ prev: [], current: [], next: [] })
  const [showCreate, setShowCreate] = useState(false)

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
  }

  useEffect(() => {
    const data = {
      value: selected.toISOString(),
      savedAt: new Date().toISOString(),
    }
    localStorage.setItem('calendarSelectedDate', JSON.stringify(data))
  }, [selected])

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

  useEffect(() => {
    const year = selected.getFullYear()
    const month = selected.getMonth() + 1
    fetchJson(`${API_BASE_URL}/month-info?year=${year}&month=${month}`)
      .then((data) => setMonthInfo(data))
      .catch(() => setMonthInfo(null))
  }, [selected.getFullYear(), selected.getMonth()])

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
        />
        <WeekSelector
          days={days}
          selected={selected}
          setSelected={setSelected}
          showMonth={showMonth}
          prevWeek={prevWeek}
          nextWeek={nextWeek}
        />
      </div>
      <DayTimeline
        nowOffset={nowOffset}
        prevDay={prevDay}
        nextDay={nextDay}
        appointments={appointments.current}
        prevAppointments={appointments.prev}
        nextAppointments={appointments.next}
        onUpdate={handleUpdate}
      />
      <button
        className="fixed bottom-20 right-6 w-12 h-12 rounded-full bg-black text-white text-2xl flex items-center justify-center"
        onClick={() => setShowCreate(true)}
      >
        +
      </button>
      {showCreate && (
        <CreateAppointmentModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            refresh()
          }}
        />
      )}
    </div>
  )
}

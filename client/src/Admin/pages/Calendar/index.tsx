import { useEffect, useState } from 'react'
import MonthSelector from './components/MonthSelector'
import WeekSelector from './components/WeekSelector'
import DayTimeline from './components/DayTimeline'

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
  const [selected, setSelected] = useState(new Date())
  const [showMonth, setShowMonth] = useState(false)
  const [nowOffset, setNowOffset] = useState<number | null>(null)
  const [monthInfo, setMonthInfo] = useState<{ startDay: number; endDay: number; daysInMonth: number } | null>(null)

  useEffect(() => {
    const year = selected.getFullYear()
    const month = selected.getMonth() + 1
    fetch(`http://localhost:3000/month-info?year=${year}&month=${month}`)
      .then((r) => r.json())
      .then((data) => setMonthInfo(data))
      .catch(() => setMonthInfo(null))
  }, [selected.getFullYear(), selected.getMonth()])

  const weekStart = startOfWeek(selected)
  const days = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i))

  const prevMonth = () => setSelected((d) => addMonths(d, -1))
  const nextMonth = () => setSelected((d) => addMonths(d, 1))
  const prevWeek = () => setSelected((d) => addDays(d, -7))
  const nextWeek = () => setSelected((d) => addDays(d, 7))
  const prevDay = () => setSelected((d) => addDays(d, -1))
  const nextDay = () => setSelected((d) => addDays(d, 1))

  useEffect(() => {
    const now = new Date()
    const offset = now.getHours() * 84 + (now.getMinutes() / 60) * 84
    setNowOffset(offset)
  }, [])

  return (
    <div className="flex flex-col h-full">
      <MonthSelector
        selected={selected}
        setSelected={setSelected}
        show={showMonth}
        setShow={setShowMonth}
        monthInfo={monthInfo}
        prevMonth={prevMonth}
        nextMonth={nextMonth}
      />
      <WeekSelector
        days={days}
        selected={selected}
        setSelected={setSelected}
        showMonth={showMonth}
        prevWeek={prevWeek}
        nextWeek={nextWeek}
      />
      <DayTimeline nowOffset={nowOffset} prevDay={prevDay} nextDay={nextDay} />
    </div>
  )
}

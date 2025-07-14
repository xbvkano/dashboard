import { useEffect, useState } from 'react'

function startOfWeek(date: Date) {
  const day = date.getDay()
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - day)
}

function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
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

  const monthStart = new Date(selected.getFullYear(), selected.getMonth(), 1)
  const monthEnd = new Date(selected.getFullYear(), selected.getMonth() + 1, 0)
  const monthDays = Array.from({ length: monthEnd.getDate() }).map((_, i) =>
    new Date(selected.getFullYear(), selected.getMonth(), i + 1)
  )

  const paddedMonthDays = (() => {
    const startPad = monthInfo ? monthInfo.startDay : monthStart.getDay()
    const endPad = monthInfo ? 6 - monthInfo.endDay : 6 - monthEnd.getDay()
    return [
      ...Array.from({ length: startPad }).map(() => null as Date | null),
      ...monthDays,
      ...Array.from({ length: endPad }).map(() => null as Date | null),
    ]
  })()

  useEffect(() => {
    const now = new Date()
    const offset = now.getHours() * 84 + (now.getMinutes() / 60) * 84
    setNowOffset(offset)
  }, [])
  return (
    <div className="flex flex-col h-full">
      <div
        className="p-2 text-center font-semibold border-b cursor-pointer flex items-center justify-center gap-1"
        onClick={() => setShowMonth((v) => !v)}
      >
        {selected.toLocaleString('default', { month: 'long', year: 'numeric' })}
        <svg
          className={`w-4 h-4 transition-transform ${showMonth ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 10.939l3.71-3.71a.75.75 0 111.06 1.061l-4.24 4.25a.75.75 0 01-1.06 0l-4.24-4.25a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </div>
      <div
        className={`border-b overflow-hidden transition-[max-height] duration-300 ${showMonth ? 'max-h-96' : 'max-h-0'}`}
      >
        <div className="grid grid-cols-7 text-center">
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d) => (
            <div key={d} className="p-1 text-xs font-medium">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 text-center">
          {paddedMonthDays.map((day, idx) =>
            day ? (
              <button
                key={day.toDateString()}
                onClick={() => {
                  setSelected(day)
                  setShowMonth(false)
                }}
                className={`p-1 ${day.toDateString() === selected.toDateString() ? 'bg-blue-500 text-white' : 'hover:bg-gray-200'}`}
              >
                {day.getDate()}
              </button>
            ) : (
              <div key={idx} className="p-1" />
            )
          )}
        </div>
      </div>
      <div className={`grid grid-cols-7 text-center border-b ${showMonth ? 'hidden' : ''}`}>
        {days.map((day) => {
          const isSelected = day.toDateString() === selected.toDateString()
          return (
            <button
              key={day.toDateString()}
              onClick={() => setSelected(day)}
              className={`p-1 ${isSelected ? 'bg-blue-500 text-white' : 'hover:bg-gray-200'}`}
            >
              <div className="text-xs">
                {day.toLocaleDateString('default', { weekday: 'short' })}
              </div>
              <div className="text-sm font-medium">{day.getDate()}</div>
            </button>
          )
        })}
      </div>
      <div className="flex-1 overflow-y-auto relative divide-y">
        {nowOffset !== null && (
          <div
            className="absolute left-0 right-0 h-px bg-red-500"
            style={{ top: nowOffset }}
          />
        )}
        {Array.from({ length: 24 }).map((_, i) => (
          <div key={i} className="h-[84px] grid grid-cols-[4rem_1fr] px-2">
            <div className="text-xs text-gray-500 pr-2 border-r flex items-start justify-end">
              {new Date(0, 0, 0, i)
                .toLocaleString('en-US', { hour: 'numeric', hour12: true })}
            </div>
            <div className="" />
          </div>
        ))}
      </div>
    </div>
  )
}

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

  const weekStart = startOfWeek(selected)
  const days = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i))

  const monthStart = new Date(selected.getFullYear(), selected.getMonth(), 1)
  const monthEnd = new Date(selected.getFullYear(), selected.getMonth() + 1, 0)
  const monthDays = Array.from({ length: monthEnd.getDate() }).map((_, i) =>
    new Date(selected.getFullYear(), selected.getMonth(), i + 1)
  )

  useEffect(() => {
    const now = new Date()
    const offset = now.getHours() * 84 + (now.getMinutes() / 60) * 84
    setNowOffset(offset)
  }, [])
  return (
    <div className="flex flex-col h-full">
      <div
        className="p-2 text-center font-semibold border-b cursor-pointer"
        onClick={() => setShowMonth((v) => !v)}
      >
        {selected.toLocaleString('default', { month: 'long', year: 'numeric' })}
      </div>
      <div
        className={`grid grid-cols-7 text-center border-b overflow-hidden transition-all duration-300 ${showMonth ? 'max-h-96' : 'max-h-0'}`}
      >
        {monthDays.map((day) => (
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
        ))}
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
      <div className="flex-1 overflow-y-auto relative pt-2 divide-y">
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

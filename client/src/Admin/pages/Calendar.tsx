import { useState } from 'react'

function startOfWeek(date: Date) {
  const day = date.getDay()
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - day)
}

function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

export default function Calendar() {
  const [selected, setSelected] = useState(new Date())
  const weekStart = startOfWeek(selected)
  const days = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i))
  return (
    <div className="flex flex-col h-full">
      <div className="p-2 text-center font-semibold border-b">
        {selected.toLocaleString('default', { month: 'long', year: 'numeric' })}
      </div>
      <div className="grid grid-cols-7 text-center border-b">
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
      <div className="flex-1 overflow-y-auto divide-y">
        {Array.from({ length: 24 }).map((_, i) => (
          <div key={i} className="h-12 px-2">
            <span className="text-xs text-gray-500">{String(i).padStart(2, '0')}:00</span>
          </div>
        ))}
      </div>
    </div>
  )
}

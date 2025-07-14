import { useRef } from 'react'

interface Props {
  days: Date[]
  selected: Date
  setSelected: (d: Date) => void
  showMonth: boolean
  prevWeek: () => void
  nextWeek: () => void
}

export default function WeekSelector({ days, selected, setSelected, showMonth, prevWeek, nextWeek }: Props) {
  const weekTouchStart = useRef<number | null>(null)

  return (
    <div
      className={`grid grid-cols-7 text-center border-b ${showMonth ? 'hidden' : ''}`}
      onTouchStart={(e) => {
        weekTouchStart.current = e.touches[0].clientX
      }}
      onTouchEnd={(e) => {
        if (weekTouchStart.current !== null) {
          const diff = e.changedTouches[0].clientX - weekTouchStart.current
          if (Math.abs(diff) > 50) {
            diff < 0 ? nextWeek() : prevWeek()
          }
          weekTouchStart.current = null
        }
      }}
    >
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
  )
}

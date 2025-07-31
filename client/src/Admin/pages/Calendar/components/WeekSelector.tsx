import { useRef } from 'react'

interface Props {
  days: Date[]
  selected: Date
  setSelected: (d: Date) => void
  showMonth: boolean
  prevWeek: () => void
  nextWeek: () => void
  counts: Record<string, number>
}

export default function WeekSelector({ days, selected, setSelected, showMonth, prevWeek, nextWeek, counts }: Props) {
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
        const count = counts[day.toISOString().slice(0, 10)]
        return (
          <button
            key={day.toDateString()}
            onClick={() => setSelected(day)}
            className={`p-1 ${isSelected ? 'bg-blue-500 text-white' : 'hover:bg-gray-200'}`}
          >
            <div className="text-xs">
              {day.toLocaleDateString('default', { weekday: 'short' })}
            </div>
            <div className="text-sm font-medium flex flex-col items-center">
              {day.getDate()}
              {count ? (
                <span className="mt-1 inline-flex items-center justify-center w-4 h-4 text-[10px] bg-blue-600 text-white rounded-full">
                  {count}
                </span>
              ) : null}
            </div>
          </button>
        )
      })}
    </div>
  )
}

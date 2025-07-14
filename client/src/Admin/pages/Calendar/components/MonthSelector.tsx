import { useRef } from 'react'

interface MonthInfo {
  startDay: number
  endDay: number
  daysInMonth: number
}

interface Props {
  selected: Date
  setSelected: (d: Date) => void
  show: boolean
  setShow: (v: boolean) => void
  monthInfo: MonthInfo | null
  prevMonth: () => void
  nextMonth: () => void
}

export default function MonthSelector({
  selected,
  setSelected,
  show,
  setShow,
  monthInfo,
  prevMonth,
  nextMonth,
}: Props) {
  const monthTouchStart = useRef<number | null>(null)

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

  return (
    <>
      <div className="relative">
        <div
          className="p-2 text-center font-semibold border-b cursor-pointer flex items-center justify-center gap-1"
          onClick={() => setShow(!show)}
        >
          {selected.toLocaleString('default', { month: 'long', year: 'numeric' })}
          <svg
            className={`w-4 h-4 transition-transform ${show ? 'rotate-180' : ''}`}
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
        {show && (
          <>
            <button
              className="hidden md:block absolute left-2 top-1/2 -translate-y-1/2"
              onClick={prevMonth}
            >
              &#8592;
            </button>
            <button
              className="hidden md:block absolute right-2 top-1/2 -translate-y-1/2"
              onClick={nextMonth}
            >
              &#8594;
            </button>
          </>
        )}
      </div>
      <div
        className={`border-b overflow-hidden transition-[max-height] duration-300 ${show ? 'max-h-96' : 'max-h-0'}`}
      >
        <div
          className="grid grid-cols-7 text-center"
          onTouchStart={(e) => {
            monthTouchStart.current = e.touches[0].clientX
          }}
          onTouchEnd={(e) => {
            if (monthTouchStart.current !== null) {
              const diff = e.changedTouches[0].clientX - monthTouchStart.current
              if (Math.abs(diff) > 50) {
                diff < 0 ? nextMonth() : prevMonth()
              }
              monthTouchStart.current = null
            }
          }}
        >
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
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
                  setShow(false)
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
    </>
  )
}

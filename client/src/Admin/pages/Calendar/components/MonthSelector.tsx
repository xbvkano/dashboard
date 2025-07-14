import { useEffect, useRef, useState } from 'react'

interface Props {
  selected: Date
  setSelected: (d: Date) => void
  show: boolean
  setShow: (v: boolean) => void
  monthInfo: { startDay: number; endDay: number; daysInMonth: number } | null
  prevMonth: () => void
  nextMonth: () => void
}

function getPaddedMonthDays(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1)
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  const days = Array.from({ length: end.getDate() }).map(
    (_, i) => new Date(date.getFullYear(), date.getMonth(), i + 1)
  )
  const startPad = start.getDay()
  const endPad = 6 - end.getDay()
  return [
    ...Array.from({ length: startPad }).map(() => null as Date | null),
    ...days,
    ...Array.from({ length: endPad }).map(() => null as Date | null),
  ]
}

type MonthGridProps = {
  days: (Date | null)[]
  selected: Date
  setSelected: (d: Date) => void
  setShow: (v: boolean) => void
}

function MonthGrid({ days, selected, setSelected, setShow }: MonthGridProps) {
  return (
    <div className="grid grid-cols-7 text-center flex-shrink-0 w-full">
      {days.map((day, idx) =>
        day ? (
          <button
            key={day.toDateString()}
            onClick={() => {
              setSelected(day)
              setShow(false)
            }}
            className={`p-1 ${
              day.toDateString() === selected.toDateString()
                ? 'bg-blue-500 text-white'
                : 'hover:bg-gray-200'
            }`}
          >
            {day.getDate()}
          </button>
        ) : (
          <div key={idx} className="p-1" />
        )
      )}
    </div>
  )
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
  const containerRef = useRef<HTMLDivElement>(null)
  const touchStartX = useRef<number | null>(null)
  const [dragOffset, setDragOffset] = useState(0)
  const [translate, setTranslate] = useState(-100)
  const [animating, setAnimating] = useState(false)

  useEffect(() => {
    // reset position when selected month changes via buttons
    setTranslate(-100)
  }, [selected])

  const prevDate = new Date(selected.getFullYear(), selected.getMonth() - 1, 1)
  const nextDate = new Date(selected.getFullYear(), selected.getMonth() + 1, 1)

  const prevDays = getPaddedMonthDays(prevDate)
  const currentDays = getPaddedMonthDays(selected)
  const nextDays = getPaddedMonthDays(nextDate)

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    setDragOffset(0)
    setAnimating(false)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current == null || !containerRef.current) return
    const diff = e.touches[0].clientX - touchStartX.current
    const pct = (diff / containerRef.current.offsetWidth) * 100
    setDragOffset(pct)
  }

  const handleTouchEnd = () => {
    if (touchStartX.current == null || !containerRef.current) return
    const diffPx = (dragOffset / 100) * containerRef.current.offsetWidth
    if (Math.abs(diffPx) > 50) {
      setAnimating(true)
      if (diffPx < 0) {
        // swipe left -> next month
        setTranslate(-200)
        setTimeout(() => {
          setAnimating(false)
          setTranslate(-100)
          nextMonth()
        }, 300)
      } else {
        setTranslate(0)
        setTimeout(() => {
          setAnimating(false)
          setTranslate(-100)
          prevMonth()
        }, 300)
      }
    } else {
      setAnimating(true)
      setDragOffset(0)
      setTimeout(() => {
        setAnimating(false)
        setDragOffset(0)
      }, 300)
    }
    touchStartX.current = null
  }

  const style = {
    transform: `translateX(calc(${translate}% + ${dragOffset}%))`,
    transition: animating ? 'transform 0.3s ease' : undefined,
  }

  const paddedCurrent = (() => {
    if (monthInfo) {
      const startPad = monthInfo.startDay
      const endPad = 6 - monthInfo.endDay
      const monthDays = Array.from({ length: monthInfo.daysInMonth }).map(
        (_, i) => new Date(selected.getFullYear(), selected.getMonth(), i + 1)
      )
      return [
        ...Array.from({ length: startPad }).map(() => null as Date | null),
        ...monthDays,
        ...Array.from({ length: endPad }).map(() => null as Date | null),
      ]
    }
    return currentDays
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
        <div className="grid grid-cols-7 text-center">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="p-1 text-xs font-medium">
              {d}
            </div>
          ))}
        </div>
        <div
          className="overflow-hidden touch-pan-x"
          ref={containerRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="flex w-[300%]" style={style}>
            <MonthGrid
              days={prevDays}
              selected={selected}
              setSelected={setSelected}
              setShow={setShow}
            />
            <MonthGrid
              days={paddedCurrent}
              selected={selected}
              setSelected={setSelected}
              setShow={setShow}
            />
            <MonthGrid
              days={nextDays}
              selected={selected}
              setSelected={setSelected}
              setShow={setShow}
            />
          </div>
        </div>
      </div>
    </>
  )
}

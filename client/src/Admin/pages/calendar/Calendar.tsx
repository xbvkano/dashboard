import { useEffect, useRef, useState } from 'react'

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
  const [monthInfo, setMonthInfo] = useState<{
    startDay: number
    endDay: number
    daysInMonth: number
  } | null>(null)

  const monthTouchStart = useRef<number | null>(null)
  const weekTouchStart = useRef<number | null>(null)
  const dayTouchStart = useRef<number | null>(null)

  const [dayDragX, setDayDragX] = useState<number | null>(null)
  const [dragDirection, setDragDirection] = useState<'left' | 'right' | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const [containerRect, setContainerRect] = useState<DOMRect | null>(null)

  // for computing drag
  const pointerOffsetRef = useRef<number | null>(null)
  const boundaryLocalRef = useRef<number | null>(null)

  const timeColWidth = 4 * 16 // 4rem * 16px

  // fetch month metadata
  useEffect(() => {
    const year = selected.getFullYear()
    const month = selected.getMonth() + 1
    fetch(`http://localhost:3000/month-info?year=${year}&month=${month}`)
      .then((r) => r.json())
      .then((data) => setMonthInfo(data))
      .catch(() => setMonthInfo(null))
  }, [selected])

  // build week & month arrays...
  const weekStart = startOfWeek(selected)
  const days = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i))
  const monthStart = new Date(selected.getFullYear(), selected.getMonth(), 1)
  const monthEnd = new Date(selected.getFullYear(), selected.getMonth() + 1, 0)
  const monthDays = Array.from({ length: monthEnd.getDate() }).map(
    (_, i) => new Date(selected.getFullYear(), selected.getMonth(), i + 1)
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

  // navigation helpers
  const prevMonth = () => setSelected((d) => addMonths(d, -1))
  const nextMonth = () => setSelected((d) => addMonths(d, 1))
  const prevWeek = () => setSelected((d) => addDays(d, -7))
  const nextWeek = () => setSelected((d) => addDays(d, 7))
  const prevDay = () => setSelected((d) => addDays(d, -1))
  const nextDay = () => setSelected((d) => addDays(d, 1))

  // "Now" line
  useEffect(() => {
    const now = new Date()
    const offset = now.getHours() * 84 + (now.getMinutes() / 60) * 84
    setNowOffset(offset)
  }, [])

  // drag start
  const onDayTouchStart = (e: React.TouchEvent) => {
    const x = e.touches[0].clientX
    dayTouchStart.current = x
    setDragDirection(null)
    setDayDragX(null)
    pointerOffsetRef.current = null
    boundaryLocalRef.current = null
    if (containerRef.current) {
      setContainerRect(containerRef.current.getBoundingClientRect())
    }
  }

  // drag move
  const onDayTouchMove = (e: React.TouchEvent) => {
    if (dayTouchStart.current == null || !containerRect) return
    const x = e.touches[0].clientX
    const diff = x - dayTouchStart.current

    // **swapped**: diff<0 (finger left) → dragDirection 'right'; diff>0 → 'left'
    if (dragDirection == null) {
      const dir: 'left' | 'right' = diff < 0 ? 'right' : 'left'
      setDragDirection(dir)

      const startLocal = dayTouchStart.current - containerRect.left
      const boundaryLocal = dir === 'left' ? timeColWidth : containerRect.width
      boundaryLocalRef.current = boundaryLocal
      pointerOffsetRef.current = startLocal - boundaryLocal
    }

    if (dragDirection && pointerOffsetRef.current != null) {
      const localX = x - containerRect.left
      const newLocal = localX - pointerOffsetRef.current
      const boundaryLocal = boundaryLocalRef.current!
      let clamped: number
      if (dragDirection === 'left') {
        // moving right → clamp between 0 and timeColWidth
        clamped = Math.max(0, Math.min(newLocal, boundaryLocal))
      } else {
        // moving left → clamp from boundaryLocal to full width
        clamped = Math.max(boundaryLocal, newLocal)
      }
      setDayDragX(containerRect.left + clamped)
    }
  }

  // drag end
  const onDayTouchEnd = (e: React.TouchEvent) => {
    if (
      dayTouchStart.current == null ||
      !containerRect ||
      dragDirection == null ||
      boundaryLocalRef.current == null
    ) {
      // nothing to do
      dayTouchStart.current = null
      setDragDirection(null)
      setDayDragX(null)
      return
    }

    const fingerEnd = e.changedTouches[0].clientX
    const diffFinger = fingerEnd - dayTouchStart.current
    const threshold = containerRect.width / 2
    const willMove = Math.abs(diffFinger) > threshold

    // final local position
    let finalLocal = boundaryLocalRef.current
    if (willMove) {
      finalLocal = dragDirection === 'left' ? 0 : containerRect.width
    }

    // animate line
    setDayDragX(containerRect.left + finalLocal)

    // after animation, change date
    setTimeout(() => {
      if (willMove) {
        dragDirection === 'left' ? prevDay() : nextDay()
      }
      // reset
      dayTouchStart.current = null
      setDragDirection(null)
      setDayDragX(null)
    }, 200) // match your CSS duration
  }

  return (
    <div className="flex flex-col h-full">
      {/* Month header... */}
      <div className="relative">
        <div
          className="p-2 text-center font-semibold border-b cursor-pointer flex items-center justify-center gap-1"
          onClick={() => setShowMonth((v) => !v)}
        >
          {selected.toLocaleString('default', {
            month: 'long',
            year: 'numeric',
          })}
          <svg
            className={`w-4 h-4 transition-transform ${
              showMonth ? 'rotate-180' : ''
            }`}
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
        {showMonth && (
          <>
            <button
              className="hidden md:block absolute left-2 top-1/2 -translate-y-1/2"
              onClick={() => setSelected((d) => addMonths(d, -1))}
            >
              ←
            </button>
            <button
              className="hidden md:block absolute right-2 top-1/2 -translate-y-1/2"
              onClick={() => setSelected((d) => addMonths(d, 1))}
            >
              →
            </button>
          </>
        )}
      </div>

      {/* Month picker... */}
      <div
        className={`border-b overflow-hidden transition-[max-height] duration-300 ${
          showMonth ? 'max-h-96' : 'max-h-0'
        }`}
      >
        {/* ...month grid */}
      </div>

      {/* Week picker... */}
      <div
        className={`grid grid-cols-7 text-center border-b ${
          showMonth ? 'hidden' : ''
        }`}
        onTouchStart={(e) => {
          weekTouchStart.current = e.touches[0].clientX
        }}
        onTouchEnd={(e) => {
          if (weekTouchStart.current !== null) {
            const diff = e.changedTouches[0].clientX - weekTouchStart.current!
            if (Math.abs(diff) > 50) {
              diff < 0 ? nextWeek() : prevWeek()
            }
            weekTouchStart.current = null
          }
        }}
      >
        {days.map((day) => (
          <button
            key={day.toDateString()}
            onClick={() => setSelected(day)}
            className={`p-1 ${
              day.toDateString() === selected.toDateString()
                ? 'bg-blue-500 text-white'
                : 'hover:bg-gray-200'
            }`}
          >
            <div className="text-xs">
              {day.toLocaleDateString('default', { weekday: 'short' })}
            </div>
            <div className="text-sm font-medium">{day.getDate()}</div>
          </button>
        ))}
      </div>

      {/* Day view */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto relative divide-y"
        onTouchStart={onDayTouchStart}
        onTouchMove={onDayTouchMove}
        onTouchEnd={onDayTouchEnd}
      >
        {/* Drag line */}
        {dragDirection && dayDragX != null && containerRect && (
          <div
            className="absolute top-0 bottom-0 w-px bg-gray-400 transition-all duration-200"
            style={{ left: `${dayDragX}px` }}
          />
        )}

        {/* Now line */}
        {nowOffset != null && (
          <div
            className="absolute left-0 right-0 h-px bg-red-500"
            style={{ top: nowOffset }}
          />
        )}

        {/* Hours */}
        {Array.from({ length: 24 }).map((_, i) => (
          <div key={i} className="h-[84px] grid grid-cols-[4rem_1fr] px-2">
            <div className="text-xs text-gray-500 pr-2 border-r flex items-start justify-end">
              {new Date(0, 0, 0, i).toLocaleString('en-US', {
                hour: 'numeric',
                hour12: true,
              })}
            </div>
            <div />
          </div>
        ))}
      </div>
    </div>
  )
}

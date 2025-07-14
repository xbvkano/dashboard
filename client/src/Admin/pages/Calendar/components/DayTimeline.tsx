import { useRef, useState } from 'react'

interface Props {
  nowOffset: number | null
  prevDay: () => void
  nextDay: () => void
}

export default function DayTimeline({ nowOffset, prevDay, nextDay }: Props) {
  const dayTouchStart = useRef<number | null>(null)
  const [dayDragX, setDayDragX] = useState<number | null>(null)
  const [dragDirection, setDragDirection] = useState<'left' | 'right' | null>(null)

  return (
    <div
      className="flex-1 overflow-y-auto relative divide-y"
      onTouchStart={(e) => {
        dayTouchStart.current = e.touches[0].clientX
        setDayDragX(e.touches[0].clientX)
        setDragDirection(null)
      }}
      onTouchMove={(e) => {
        if (dayTouchStart.current !== null) {
          const x = e.touches[0].clientX
          setDayDragX(x)
          const diff = x - dayTouchStart.current
          if (diff !== 0) {
            setDragDirection(diff < 0 ? 'left' : 'right')
          }
        }
      }}
      onTouchEnd={() => {
        if (dayTouchStart.current !== null && dayDragX !== null) {
          const diff = dayDragX - dayTouchStart.current
          if (Math.abs(diff) > window.innerWidth / 2) {
            diff < 0 ? nextDay() : prevDay()
          }
        }
        dayTouchStart.current = null
        setDayDragX(null)
        setDragDirection(null)
      }}
    >
      {dragDirection && (
        <div
          className="absolute top-0 bottom-0 w-px bg-gray-400"
          style={{
            left: dragDirection === 'left' ? 'calc(4rem + 0.5rem)' : 'calc(100% - 1px)',
          }}
        />
      )}
      {nowOffset !== null && (
        <div className="absolute left-0 right-0 h-px bg-red-500" style={{ top: nowOffset }} />
      )}
      {Array.from({ length: 24 }).map((_, i) => (
        <div key={i} className="h-[84px] grid grid-cols-[4rem_1fr] px-2">
          <div className="text-xs text-gray-500 pr-2 border-r flex items-start justify-end">
            {new Date(0, 0, 0, i).toLocaleString('en-US', { hour: 'numeric', hour12: true })}
          </div>
          <div className="" />
        </div>
      ))}
    </div>
  )
}

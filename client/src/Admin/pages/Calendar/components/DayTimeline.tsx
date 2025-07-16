import { useLayoutEffect, useRef, useState, type Ref } from 'react'
import type { Appointment } from '../types'

interface DayProps {
  appointments: Appointment[]
  nowOffset: number | null
  scrollRef?: Ref<HTMLDivElement>
  animating: boolean
}

function Day({ appointments, nowOffset, scrollRef, animating }: DayProps) {
  const [selected, setSelected] = useState<Appointment | null>(null)

  // 4rem + 0.5rem in px (assuming 16px base font-size)
  const dividerPx = 4 * 16 + 0.5 * 16
  const LANE_GAP = 8 // space between appointment columns in pixels
  const apptWidth = '40vw'
  let containerWidth = `calc(${dividerPx}px + 40vw)`

  type Layout = {
    appt: Appointment
    start: number
    end: number
    lane: number
  }

  const events: Layout[] = appointments
    .map((a) => {
      const [h, m] = a.time.split(':').map((n) => parseInt(n, 10))
      const start = h * 60 + m
      const end = start + (a.hours ?? 1) * 60
      return { appt: a, start, end, lane: 0 }
    })
    .sort((a, b) => a.start - b.start)

  const active: Layout[] = []
  const layout: Layout[] = []
  let maxLane = 0

  for (const e of events) {
    // remove ended events
    for (let i = active.length - 1; i >= 0; i--) {
      if (active[i].end <= e.start) active.splice(i, 1)
    }

    let lane = 0
    while (active.some((a) => a.lane === lane)) lane++

    e.lane = lane
    if (lane + 1 > maxLane) maxLane = lane + 1
    active.push(e)
    layout.push(e)
  }

  containerWidth =
    layout.length === 0
      ? '100%'
      : `calc(${dividerPx}px + ${maxLane} * (40vw + ${LANE_GAP}px))`
  const rightEdge =
    layout.length === 0
      ? '100%'
      : `calc(${dividerPx}px + ${maxLane} * (40vw + ${LANE_GAP}px))`

  return (
    <div
      ref={scrollRef}
      className={`flex-1 relative ${animating ? 'overflow-hidden' : 'overflow-x-auto overflow-y-auto'}`}
    >
      <div className="relative divide-y" style={{ width: containerWidth }}>
        {/* divider line */}
        <div
          className="absolute top-0 bottom-0 w-px bg-gray-300 pointer-events-none"
          style={{ left: dividerPx }}
        />

        {/* right edge marker */}
        <div
          className="absolute top-0 bottom-0 w-px bg-gray-300 pointer-events-none"
          style={layout.length === 0 ? { right: 0 } : { left: rightEdge }}
        />

        {/* “now” indicator */}
        {nowOffset != null && (
          <div
            className="absolute left-0 right-0 h-px bg-red-500 pointer-events-none"
            style={{ top: nowOffset, zIndex: 20 }}
          />
        )}

        {/* hours grid */}
        {Array.from({ length: 24 }).map((_, i) => (
          <div key={i} className="h-[84px] grid grid-cols-[4rem_1fr] px-2">
            <div className="text-xs text-gray-500 pr-2 flex items-start justify-end">
              {new Date(0, 0, 0, i).toLocaleString('en-US', {
                hour: 'numeric',
                hour12: true,
              })}
            </div>
            <div />
          </div>
        ))}

        {layout.map((l, idx) => {
          const top = (l.start / 60) * 84
          const height = ((l.end - l.start) / 60) * 84 - 2
          const leftStyle = `calc(${dividerPx}px + ${l.lane} * (40vw + ${LANE_GAP}px))`
          return (
            <div
              key={l.appt.id ?? idx}
              className="absolute bg-blue-200 border border-blue-400 rounded text-xs overflow-hidden cursor-pointer"
              style={{ top, left: leftStyle, width: apptWidth, height, zIndex: 10 }}
              onClick={() => setSelected(l.appt)}
            >
              {l.appt.type}
            </div>
          )
        })}
      </div>
      {selected && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-40"
          onClick={() => setSelected(null)}
        >
          <div className="bg-white p-4 rounded space-y-1 max-w-xs" onClick={(e) => e.stopPropagation()}>
            <div className="font-medium">{selected.type}</div>
            <div className="text-sm">{selected.address}</div>
            {selected.size && <div className="text-sm">Size: {selected.size}</div>}
            {selected.hours && <div className="text-sm">Hours: {selected.hours}</div>}
            <button className="mt-2 px-2 text-blue-600" onClick={() => setSelected(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

interface Props {
  nowOffset: number | null
  prevDay: () => void
  nextDay: () => void
  appointments: Appointment[]
  prevAppointments: Appointment[]
  nextAppointments: Appointment[]
}

export default function DayTimeline({
  nowOffset,
  prevDay,
  nextDay,
  appointments,
  prevAppointments,
  nextAppointments,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const currentDayRef = useRef<HTMLDivElement | null>(null)
  const touchStartX = useRef<number | null>(null)
  const isPaging = useRef(false)
  const [dragDelta, setDragDelta] = useState(0)
  const [baseOffset, setBaseOffset] = useState(0)
  const [animating, setAnimating] = useState(false)

  useLayoutEffect(() => {
    if (!containerRef.current) return
    const w = containerRef.current.offsetWidth
    setBaseOffset(-w)
    setDragDelta(0)
    setAnimating(false)
  }, [appointments, prevAppointments, nextAppointments])

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    isPaging.current = false
    setDragDelta(0)
    setAnimating(false)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return
    const diff = e.touches[0].clientX - touchStartX.current
    const dayEl = currentDayRef.current
    if (!dayEl) return
    const atLeft = dayEl.scrollLeft <= 0
    const atRight =
      dayEl.scrollLeft + dayEl.clientWidth >= dayEl.scrollWidth - 1

    if (!isPaging.current) {
      if ((diff > 0 && atLeft) || (diff < 0 && atRight)) {
        isPaging.current = true
      } else {
        touchStartX.current = e.touches[0].clientX
        return
      }
    }

    e.preventDefault()
    setDragDelta(diff)
  }

  const handleTouchEnd = () => {
    if (!isPaging.current || touchStartX.current == null || !containerRef.current) {
      touchStartX.current = null
      isPaging.current = false
      return
    }
    const w = containerRef.current.offsetWidth
    const threshold = w * 0.25
    const moved = dragDelta

    if (Math.abs(moved) > threshold) {
      setAnimating(true)
      setDragDelta(0)
      if (moved < 0) {
        // swipe left → next
        setBaseOffset(-2 * w)
        setTimeout(() => {
          nextDay()
        }, 300)
      } else {
        // swipe right → prev
        setBaseOffset(0)
        setTimeout(() => {
          prevDay()
        }, 300)
      }
    } else {
      setAnimating(true)
      setBaseOffset(-w)
      setDragDelta(0)
      setTimeout(() => {
        setAnimating(false)
      }, 300)
    }

    touchStartX.current = null
    isPaging.current = false
  }

  const style = {
    transform: `translateX(${baseOffset + dragDelta}px)`,
    transition: animating ? 'transform 0.3s ease' : undefined,
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-hidden relative touch-pan-x"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="flex w-[300%]" style={style}>
        <Day appointments={prevAppointments} nowOffset={null} animating={animating} />
        <Day
          appointments={appointments}
          nowOffset={nowOffset}
          scrollRef={currentDayRef}
          animating={animating}
        />
        <Day appointments={nextAppointments} nowOffset={null} animating={animating} />
      </div>
    </div>
  )
}

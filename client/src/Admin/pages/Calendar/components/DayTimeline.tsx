import { useRef, useState } from 'react'
import type { Appointment } from '../types'

interface Props {
  nowOffset: number | null
  prevDay: () => void
  nextDay: () => void
  appointments: Appointment[]
}
export default function DayTimeline({
  nowOffset,
  prevDay,
  nextDay,
  appointments,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const dayTouchStart = useRef<number | null>(null)
  const [dayDragX, setDayDragX] = useState<number | null>(null);
  const [dragDirection, setDragDirection] = useState<"left" | "right" | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animateDirection, setAnimateDirection] = useState<"left" | "right" | null>(null);
  const [snapBack, setSnapBack] = useState(false);
  const [selected, setSelected] = useState<Appointment | null>(null);

  // 4rem + 0.5rem in px (assuming 16px base font-size)
  const dividerPx = 4 * 16 + 0.5 * 16;
  const LANE_GAP = 8; // space between appointment columns in pixels
  const apptWidth = '40vw';
  let containerWidth = `calc(${dividerPx}px + 40vw)`;

  const handleTouchStart = (e: React.TouchEvent) => {
    const x = e.touches[0].clientX;
    dayTouchStart.current = x;
    setDayDragX(x);
    setDragDirection(null);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (dayTouchStart.current == null) return
    const x = e.touches[0].clientX
    setDayDragX(x)
    const diff = x - dayTouchStart.current
    if (diff !== 0) setDragDirection(diff < 0 ? 'left' : 'right')
  }

  const handleTouchEnd = () => {
    if (
      dayTouchStart.current != null &&
      dayDragX != null &&
      dragDirection != null
    ) {
      const diff = dayDragX - dayTouchStart.current
      const half = window.innerWidth / 2

      if (
        Math.abs(diff) > half &&
        ((diff < 0 && atRightEdge) || (diff > 0 && atLeftEdge))
      ) {
        // crossed threshold → change day, snap to pivot
        if (diff < 0) {
          nextDay()
        } else {
          prevDay()
        }
        setSnapBack(false)
      } else {
        // didn’t cross → snap back
        setSnapBack(true)
      }
      setAnimateDirection(dragDirection)
      setIsAnimating(true)
    }

    // clear touch start so we know dragging ended
    dayTouchStart.current = null;
  };

  // compute where the line should be
  let lineX: number | null = null
  let transitionStyle: string | undefined
  const container = containerRef.current
  const atLeftEdge = container ? container.scrollLeft <= 0 : false
  const atRightEdge = container
    ? container.scrollLeft + container.clientWidth >= container.scrollWidth - 1
    : false

  if (isAnimating && animateDirection) {
    // during snap animation, go to either pivot or start depending on snapBack
    const startPivot =
      animateDirection === "left" ? window.innerWidth : dividerPx;
    const thresholdPivot =
      animateDirection === "left" ? dividerPx : window.innerWidth;

    const finalPivot = snapBack ? startPivot : thresholdPivot;

    lineX = finalPivot;
    transitionStyle = "left 0.3s ease";
  } else if (
    dayTouchStart.current != null &&
    dayDragX != null &&
    dragDirection &&
    ((dragDirection === 'left' && atRightEdge) ||
      (dragDirection === 'right' && atLeftEdge))
  ) {
    // while dragging, follow finger from the proper start point
    const startPivot =
      dragDirection === 'left' ? window.innerWidth : dividerPx
    const diff = dayDragX - dayTouchStart.current
    lineX = Math.min(
      Math.max(startPivot + diff, dividerPx),
      window.innerWidth
    )
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-x-auto overflow-y-auto relative"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="relative divide-y" style={{ width: containerWidth }}>
        {/* drag line */}
        {lineX != null && (
          <div
            className="absolute top-0 bottom-0 w-px bg-gray-400 pointer-events-none"
            style={{ left: `${lineX}px`, transition: transitionStyle }}
            onTransitionEnd={() => {
              // after snapping (either back or forward), clear everything
              if (isAnimating) {
                setIsAnimating(false);
                setAnimateDirection(null);
                setSnapBack(false);
                setDayDragX(null);
                setDragDirection(null);
              }
            }}
          />
        )}

        {/* divider line */}
        <div
          className="absolute top-0 bottom-0 w-px bg-gray-300 pointer-events-none"
          style={{ left: dividerPx }}
        />

        {/* right edge marker */}
        <div className="absolute top-0 bottom-0 right-0 w-px bg-gray-300 pointer-events-none" />

      {/* “now” indicator */}
      {nowOffset != null && (
        <div
          className="absolute left-0 right-0 h-px bg-red-500"
          style={{ top: nowOffset }}
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

      {(() => {
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

        containerWidth = `calc(${dividerPx}px + ${maxLane} * (40vw + ${LANE_GAP}px))`

        return layout.map((l, idx) => {
          const top = (l.start / 60) * 84
          const height = ((l.end - l.start) / 60) * 84 - 2
          const leftStyle = `calc(${dividerPx}px + ${l.lane} * (40vw + ${LANE_GAP}px))`
          return (
            <div
              key={l.appt.id ?? idx}
              className="absolute bg-blue-200 border border-blue-400 rounded text-xs overflow-hidden cursor-pointer"
              style={{
                top,
                left: leftStyle,
                width: apptWidth,
                height,
                zIndex: 10,
              }}
              onClick={() => setSelected(l.appt)}
            >
              {l.appt.type}
            </div>
          )
        })
      })()}
      </div>
      {selected && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-40"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white p-4 rounded space-y-1 max-w-xs"
            onClick={(e) => e.stopPropagation()}
          >
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
  );
}

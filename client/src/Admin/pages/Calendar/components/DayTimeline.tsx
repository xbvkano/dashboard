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
  const dayTouchStart = useRef<number | null>(null);
  const [dayDragX, setDayDragX] = useState<number | null>(null);
  const [dragDirection, setDragDirection] = useState<"left" | "right" | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animateDirection, setAnimateDirection] = useState<"left" | "right" | null>(null);
  const [snapBack, setSnapBack] = useState(false);
  const [selected, setSelected] = useState<Appointment | null>(null);

  // 4rem + 0.5rem in px (assuming 16px base font-size)
  const dividerPx = 4 * 16 + 0.5 * 16;

  const handleTouchStart = (e: React.TouchEvent) => {
    const x = e.touches[0].clientX;
    dayTouchStart.current = x;
    setDayDragX(x);
    setDragDirection(null);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (dayTouchStart.current == null) return;
    const x = e.touches[0].clientX;
    setDayDragX(x);
    const diff = x - dayTouchStart.current;
    if (diff !== 0) setDragDirection(diff < 0 ? "left" : "right");
  };

  const handleTouchEnd = () => {
    if (
      dayTouchStart.current != null &&
      dayDragX != null &&
      dragDirection != null
    ) {
      const diff = dayDragX - dayTouchStart.current;
      const half = window.innerWidth / 2;

      if (Math.abs(diff) > half) {
        // crossed threshold → change day, snap to pivot
        if (diff < 0) {
          nextDay();
        } else {
          prevDay();
        }
        setSnapBack(false);
      } else {
        // didn’t cross → snap back
        setSnapBack(true);
      }
      setAnimateDirection(dragDirection);
      setIsAnimating(true);
    }

    // clear touch start so we know dragging ended
    dayTouchStart.current = null;
  };

  // compute where the line should be
  let lineX: number | null = null;
  let transitionStyle: string | undefined;

  if (isAnimating && animateDirection) {
    // during snap animation, go to either pivot or start depending on snapBack
    const startPivot =
      animateDirection === "left" ? window.innerWidth : dividerPx;
    const thresholdPivot =
      animateDirection === "left" ? dividerPx : window.innerWidth;

    const finalPivot = snapBack ? startPivot : thresholdPivot;

    lineX = finalPivot;
    transitionStyle = "left 0.3s ease";
  } else if (dayTouchStart.current != null && dayDragX != null && dragDirection) {
    // while dragging, follow finger from the proper start point
    const startPivot =
      dragDirection === "left" ? window.innerWidth : dividerPx;
    const diff = dayDragX - dayTouchStart.current;
    lineX = Math.min(
      Math.max(startPivot + diff, dividerPx),
      window.innerWidth
    );
  }

  return (
    <div
      className="flex-1 overflow-y-auto relative divide-y"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
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
          <div className="text-xs text-gray-500 pr-2 border-r flex items-start justify-end">
            {new Date(0, 0, 0, i).toLocaleString('en-US', {
              hour: 'numeric',
              hour12: true,
            })}
          </div>
          <div />
        </div>
      ))}

      {Object.entries(
        appointments.reduce<Record<string, Appointment[]>>((acc, appt) => {
          acc[appt.time] = acc[appt.time] ? [...acc[appt.time], appt] : [appt]
          return acc
        }, {})
      )
        .sort(([t1], [t2]) => t1.localeCompare(t2))
        .map(([time, group]) => {
        const [h, m] = time.split(':').map((n) => parseInt(n, 10))
        const top = h * 84 + (m / 60) * 84
        const sorted = group
          .slice()
          .sort((a, b) =>
            new Date(a.createdAt ?? '').getTime() -
            new Date(b.createdAt ?? '').getTime()
          )
        return (
          <div
            key={time}
            className="absolute flex flex-row gap-1 overflow-x-auto flex-nowrap"
            style={{
              top,
              left: dividerPx,
              width: `calc(100% - ${dividerPx}px)`,
              padding: '2px',
              zIndex: 10,
            }}
          >
            {sorted.map((a, idx) => (
              <div
                key={a.id ?? idx}
                className="flex-shrink-0 min-w-full bg-blue-200 border border-blue-400 rounded px-1 text-xs overflow-hidden cursor-pointer"
                style={{ height: (a.hours || 1) * 84 - 2 }}
                onClick={() => setSelected(a)}
              >
                {a.type}
              </div>
            ))}
          </div>
        )
      })}
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

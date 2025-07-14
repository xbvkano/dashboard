import { useRef, useState } from "react";

interface Props {
  nowOffset: number | null;
  prevDay: () => void;
  nextDay: () => void;
}

export default function DayTimeline({ nowOffset, prevDay, nextDay }: Props) {
  const dayTouchStart = useRef<number | null>(null);
  const [dayDragX, setDayDragX] = useState<number | null>(null);
  const [dragDirection, setDragDirection] = useState<"left" | "right" | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animateDirection, setAnimateDirection] = useState<"left" | "right" | null>(null);
  const [snapBack, setSnapBack] = useState(false);

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
        diff < 0 ? nextDay() : prevDay();
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
            {new Date(0, 0, 0, i).toLocaleString("en-US", {
              hour: "numeric",
              hour12: true,
            })}
          </div>
          <div />
        </div>
      ))}
    </div>
  );
}

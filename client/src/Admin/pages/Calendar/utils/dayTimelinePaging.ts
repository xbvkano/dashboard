export type SwipeDirection = 'next' | 'prev'

/** Fraction of container width that must be dragged to commit a day change. */
export const SWIPE_COMMIT_THRESHOLD = 0.25

export function shouldCommitSwipe(moved: number, width: number): boolean {
  if (width <= 0) return false
  return Math.abs(moved) > width * SWIPE_COMMIT_THRESHOLD
}

/** Offset for the three-panel track centered on the current day. */
export function centerOffset(width: number): number {
  return -width
}

/**
 * After committing a horizontal swipe, animate to the prev (right) or next (left) panel.
 * moved < 0 → swipe left → next day; moved > 0 → swipe right → prev day.
 */
export function swipeDirection(moved: number): SwipeDirection {
  return moved < 0 ? 'next' : 'prev'
}

export function targetOffsetAfterSwipe(direction: SwipeDirection, width: number): number {
  return direction === 'next' ? -2 * width : 0
}

export type SettleState = {
  baseOffset: number
  dragDelta: number
  animating: boolean
}

/** State after a successful swipe animation completes and the new day is selected. */
export function settleAfterSwipe(width: number): SettleState {
  return {
    baseOffset: centerOffset(width),
    dragDelta: 0,
    animating: false,
  }
}

/** State while bouncing back when the swipe did not meet the threshold. */
export function bounceBackOffset(width: number): SettleState {
  return {
    baseOffset: centerOffset(width),
    dragDelta: 0,
    animating: true,
  }
}

export function isCalendarTransitioning(isLoadingDay: boolean, isSettling: boolean): boolean {
  return isLoadingDay || isSettling
}

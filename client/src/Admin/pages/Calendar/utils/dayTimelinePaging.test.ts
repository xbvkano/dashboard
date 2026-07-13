import { describe, expect, it } from 'vitest'
import {
  bounceBackOffset,
  centerOffset,
  isCalendarTransitioning,
  settleAfterSwipe,
  shouldCommitSwipe,
  swipeDirection,
  targetOffsetAfterSwipe,
} from './dayTimelinePaging'

describe('shouldCommitSwipe', () => {
  it('commits when drag exceeds 25% of width', () => {
    expect(shouldCommitSwipe(101, 400)).toBe(true)
    expect(shouldCommitSwipe(-101, 400)).toBe(true)
  })

  it('does not commit at or below threshold', () => {
    expect(shouldCommitSwipe(100, 400)).toBe(false)
    expect(shouldCommitSwipe(0, 400)).toBe(false)
  })

  it('does not commit when width is zero', () => {
    expect(shouldCommitSwipe(50, 0)).toBe(false)
  })
})

describe('swipe offsets', () => {
  it('centers on the middle panel', () => {
    expect(centerOffset(320)).toBe(-320)
  })

  it('maps swipe direction from drag delta', () => {
    expect(swipeDirection(-50)).toBe('next')
    expect(swipeDirection(50)).toBe('prev')
  })

  it('targets prev/next panel offsets after swipe', () => {
    expect(targetOffsetAfterSwipe('next', 320)).toBe(-640)
    expect(targetOffsetAfterSwipe('prev', 320)).toBe(0)
  })
})

describe('settleAfterSwipe', () => {
  it('recenters and clears animating after a successful swipe', () => {
    const settled = settleAfterSwipe(320)
    expect(settled).toEqual({
      baseOffset: -320,
      dragDelta: 0,
      animating: false,
    })
  })

  it('does not leave animating true after settle (regression for day desync)', () => {
    expect(settleAfterSwipe(200).animating).toBe(false)
  })
})

describe('bounceBackOffset', () => {
  it('animates back to center when swipe is not committed', () => {
    expect(bounceBackOffset(320)).toEqual({
      baseOffset: -320,
      dragDelta: 0,
      animating: true,
    })
  })
})

describe('isCalendarTransitioning', () => {
  it('is true while loading or settling', () => {
    expect(isCalendarTransitioning(true, false)).toBe(true)
    expect(isCalendarTransitioning(false, true)).toBe(true)
    expect(isCalendarTransitioning(true, true)).toBe(true)
  })

  it('is false only when both settled and loaded', () => {
    expect(isCalendarTransitioning(false, false)).toBe(false)
  })
})

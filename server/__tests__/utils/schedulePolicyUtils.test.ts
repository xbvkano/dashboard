/**
 * Unit tests for schedule policy date helpers.
 */

import { getNextOrThisUpdateDay, getNextUpdateDueDate } from '../../src/utils/schedulePolicyUtils'

describe('schedulePolicyUtils', () => {
  describe('getNextOrThisUpdateDay', () => {
    it('returns same day when refDate is already the update day (Sunday = 0)', () => {
      const ref = new Date(2026, 1, 22, 12, 0, 0, 0) // Sunday Feb 22, 2026
      const result = getNextOrThisUpdateDay(ref, 0)
      expect(result.getFullYear()).toBe(2026)
      expect(result.getMonth()).toBe(1)
      expect(result.getDate()).toBe(22)
      expect(result.getDay()).toBe(0)
    })

    it('returns next Sunday when refDate is Wednesday', () => {
      const ref = new Date(2026, 1, 18, 10, 0, 0, 0) // Wed Feb 18
      const result = getNextOrThisUpdateDay(ref, 0)
      expect(result.getDay()).toBe(0)
      expect(result.getDate()).toBe(22)
      expect(result.getMonth()).toBe(1)
    })

    it('returns next Monday when updateDayOfWeek is 1 and refDate is Sunday', () => {
      const ref = new Date(2026, 1, 22, 0, 0, 0, 0) // Sunday
      const result = getNextOrThisUpdateDay(ref, 1)
      expect(result.getDay()).toBe(1)
      expect(result.getDate()).toBe(23)
    })
  })

  describe('getNextUpdateDueDate', () => {
    it('returns next Sunday when afterDate is Wednesday', () => {
      const after = new Date(2026, 1, 18, 15, 0, 0, 0) // Wed Feb 18
      const result = getNextUpdateDueDate(after, 0)
      expect(result.getDay()).toBe(0)
      expect(result.getDate()).toBe(22)
      expect(result.getMonth()).toBe(1)
    })

    it('returns the Sunday after when afterDate is Sunday (strictly after)', () => {
      const after = new Date(2026, 1, 22, 23, 59, 59, 999) // Sunday Feb 22
      const result = getNextUpdateDueDate(after, 0)
      expect(result.getDay()).toBe(0)
      expect(result.getDate()).toBe(1) // Mar 1
      expect(result.getMonth()).toBe(2)
    })

    it('returns next Monday when updateDayOfWeek is 1 and afterDate is Friday', () => {
      const after = new Date(2026, 1, 20, 12, 0, 0, 0) // Fri Feb 20
      const result = getNextUpdateDueDate(after, 1)
      expect(result.getDay()).toBe(1)
      expect(result.getDate()).toBe(23)
    })
  })
})

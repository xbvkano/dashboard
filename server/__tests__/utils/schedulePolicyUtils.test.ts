/**
 * Unit tests for schedule policy date helpers.
 * Update day = Sunday (0): from Sunday–Saturday of week 1, the due date is Sunday of week 2;
 * when employee updates on or after that Sunday (week 2), next due moves to Sunday of week 3.
 */

import { getNextOrThisUpdateDay, getNextUpdateDueDate } from '../../src/utils/schedulePolicyUtils'

describe('schedulePolicyUtils', () => {
  const SUNDAY = 0

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

    // Week 1 = Feb 22 (Sun) – Feb 28 (Sat). During week 1, next/this Sunday is Feb 22 (if today Sun) or Mar 1 (if Mon–Sat).
    it('Monday week 1 → due Sunday week 2 (Mar 1)', () => {
      const mondayWeek1 = new Date(2026, 1, 23, 9, 0, 0, 0) // Mon Feb 23
      const result = getNextOrThisUpdateDay(mondayWeek1, SUNDAY)
      expect(result.getDay()).toBe(0)
      expect(result.getDate()).toBe(1)
      expect(result.getMonth()).toBe(2) // March
    })

    it('Saturday week 1 → due Sunday week 2 (Mar 1)', () => {
      const saturdayWeek1 = new Date(2026, 1, 28, 18, 0, 0, 0) // Sat Feb 28
      const result = getNextOrThisUpdateDay(saturdayWeek1, SUNDAY)
      expect(result.getDay()).toBe(0)
      expect(result.getDate()).toBe(1)
      expect(result.getMonth()).toBe(2)
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

    it('update on Sunday week 2 → next due is Sunday week 3', () => {
      const sundayWeek2 = new Date(2026, 2, 1, 10, 0, 0, 0) // Sun Mar 1 (week 2)
      const result = getNextUpdateDueDate(sundayWeek2, SUNDAY)
      expect(result.getDay()).toBe(0)
      expect(result.getDate()).toBe(8) // Mar 8 (week 3)
      expect(result.getMonth()).toBe(2)
    })

    it('update on Monday week 2 (Mar 2) → next due is Sunday week 3 (Mar 8)', () => {
      const mondayWeek2 = new Date(2026, 2, 2, 9, 0, 0, 0) // Mon Mar 2
      const result = getNextUpdateDueDate(mondayWeek2, SUNDAY)
      expect(result.getDay()).toBe(0)
      expect(result.getDate()).toBe(8)
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

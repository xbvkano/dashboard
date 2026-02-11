import {
  countOccurrencesInMonth,
  calculateProjectedRevenueForMonth,
  type RecurrenceRule,
} from '../../src/utils/recurrenceUtils'

/**
 * Projected revenue tests: verify occurrence counting and revenue calculation
 * for various combinations of confirmed, unconfirmed, and projected occurrences.
 *
 * Key principle: Projected revenue counts ALL occurrences from recurrence patterns
 * (baseline estimate), regardless of whether appointments already exist.
 */

describe('projectedRevenue', () => {
  describe('countOccurrencesInMonth - every 2 months (customMonths interval 2)', () => {
    const every2Months: RecurrenceRule = { type: 'customMonths', interval: 2 }

    it('returns 1 when every 2 months FALLS in target month (Jan ref → March)', () => {
      const lastBooked = new Date(2025, 0, 15) // Jan 15
      expect(countOccurrencesInMonth(every2Months, lastBooked, 2, 2025)).toBe(1) // March
    })

    it('returns 1 when every 2 months FALLS in target month (Jan ref → May)', () => {
      const lastBooked = new Date(2025, 0, 15)
      expect(countOccurrencesInMonth(every2Months, lastBooked, 4, 2025)).toBe(1) // May
    })

    it('returns 0 when every 2 months DOES NOT fall in target month (Jan ref → February)', () => {
      const lastBooked = new Date(2025, 0, 15)
      expect(countOccurrencesInMonth(every2Months, lastBooked, 1, 2025)).toBe(0) // Feb
    })

    it('returns 0 when every 2 months DOES NOT fall in target month (Jan ref → April)', () => {
      const lastBooked = new Date(2025, 0, 15)
      expect(countOccurrencesInMonth(every2Months, lastBooked, 3, 2025)).toBe(0) // April
    })

    it('returns 1 when reference is unconfirmed in target month (March 10 ref → March)', () => {
      const refInMonth = new Date(2025, 2, 10) // March 10 (e.g. unconfirmed)
      expect(countOccurrencesInMonth(every2Months, refInMonth, 2, 2025)).toBe(1)
    })

    it('returns 1 when reference is confirmed in target month (March 15 ref → March)', () => {
      const refInMonth = new Date(2025, 2, 15) // March 15 (e.g. confirmed)
      expect(countOccurrencesInMonth(every2Months, refInMonth, 2, 2025)).toBe(1)
    })

    it('returns 0 for future month when interval does not align (Jan ref → June)', () => {
      const lastBooked = new Date(2025, 0, 15)
      expect(countOccurrencesInMonth(every2Months, lastBooked, 5, 2025)).toBe(0) // 5 months, 5%2≠0
    })
  })

  describe('countOccurrencesInMonth - every 3 months (customMonths interval 3)', () => {
    const every3Months: RecurrenceRule = { type: 'customMonths', interval: 3 }

    it('returns 1 when every 3 months falls in month (Jan → Apr, Jul, Oct)', () => {
      const lastBooked = new Date(2025, 0, 10)
      expect(countOccurrencesInMonth(every3Months, lastBooked, 3, 2025)).toBe(1) // April
      expect(countOccurrencesInMonth(every3Months, lastBooked, 6, 2025)).toBe(1) // July
      expect(countOccurrencesInMonth(every3Months, lastBooked, 9, 2025)).toBe(1) // October
    })

    it('returns 0 when every 3 months does not fall in month (Jan → Feb, Mar, May)', () => {
      const lastBooked = new Date(2025, 0, 10)
      expect(countOccurrencesInMonth(every3Months, lastBooked, 1, 2025)).toBe(0) // Feb
      expect(countOccurrencesInMonth(every3Months, lastBooked, 2, 2025)).toBe(0) // Mar
      expect(countOccurrencesInMonth(every3Months, lastBooked, 4, 2025)).toBe(0) // May
    })
  })

  describe('countOccurrencesInMonth - weekly, biweekly, monthly for mix of reference types', () => {
    it('weekly: counts occurrences whether ref is confirmed or unconfirmed in prior month', () => {
      const refConfirmed = new Date(2025, 0, 15) // Jan 15 confirmed
      const refUnconfirmed = new Date(2025, 0, 22) // Jan 22 unconfirmed
      // March (month 2) should have 4 weeks from either ref
      expect(countOccurrencesInMonth({ type: 'weekly' }, refConfirmed, 2, 2025)).toBe(4)
      expect(countOccurrencesInMonth({ type: 'weekly' }, refUnconfirmed, 2, 2025)).toBe(4)
    })

    it('monthly: 1 occurrence whether ref is confirmed or projected month', () => {
      const refJan = new Date(2025, 0, 15)
      expect(countOccurrencesInMonth({ type: 'monthly' }, refJan, 2, 2025)).toBe(1) // March
      expect(countOccurrencesInMonth({ type: 'monthly' }, refJan, 5, 2025)).toBe(1) // June
    })

    it('biweekly: 2 occurrences in March from Jan ref', () => {
      const refJan = new Date(2025, 0, 1)
      expect(countOccurrencesInMonth({ type: 'biweekly' }, refJan, 2, 2025)).toBe(2)
    })
  })

  describe('calculateProjectedRevenueForMonth - mixed scenarios', () => {
    it('single family: every 2 months falls in March → 1 occurrence × price', () => {
      const families = [
        {
          rule: { type: 'customMonths', interval: 2 } as RecurrenceRule,
          referenceDate: new Date(2025, 0, 15),
          price: 150,
        },
      ]
      const { total, details } = calculateProjectedRevenueForMonth(families, 2, 2025) // March
      expect(total).toBe(150)
      expect(details[0].occurrences).toBe(1)
      expect(details[0].revenue).toBe(150)
    })

    it('single family: every 2 months does NOT fall in February → 0 revenue', () => {
      const families = [
        {
          rule: { type: 'customMonths', interval: 2 } as RecurrenceRule,
          referenceDate: new Date(2025, 0, 15),
          price: 150,
        },
      ]
      const { total, details } = calculateProjectedRevenueForMonth(families, 1, 2025) // Feb
      expect(total).toBe(0)
      expect(details[0].occurrences).toBe(0)
    })

    it('multiple families: mix of every 2 months (falls + does not fall) + weekly', () => {
      const families = [
        {
          rule: { type: 'customMonths', interval: 2 } as RecurrenceRule,
          referenceDate: new Date(2025, 0, 15),
          price: 150,
        },
        {
          rule: { type: 'customMonths', interval: 2 } as RecurrenceRule,
          referenceDate: new Date(2025, 0, 10),
          price: 200,
        },
        {
          rule: { type: 'weekly' } as RecurrenceRule,
          referenceDate: new Date(2025, 0, 1),
          price: 80,
        },
      ]
      // March: both every-2-months fall (2×), weekly has 4 occurrences
      const { total } = calculateProjectedRevenueForMonth(families, 2, 2025)
      expect(total).toBe(150 * 1 + 200 * 1 + 80 * 4) // 150 + 200 + 320 = 670
    })

    it('February: every 2 months does not fall, weekly still has occurrences', () => {
      const families = [
        {
          rule: { type: 'customMonths', interval: 2 } as RecurrenceRule,
          referenceDate: new Date(2025, 0, 15),
          price: 150,
        },
        {
          rule: { type: 'weekly' } as RecurrenceRule,
          referenceDate: new Date(2025, 0, 1),
          price: 80,
        },
      ]
      const { total, details } = calculateProjectedRevenueForMonth(families, 1, 2025) // Feb
      expect(details[0].occurrences).toBe(0)
      expect(details[1].occurrences).toBe(4) // 4 weeks in Feb 2025
      expect(total).toBe(0 + 80 * 4) // 320
    })

    it('month with mix of recurrence types: monthly + every 2 months all hit March', () => {
      // Ref dates from Jan (prior month). March: 2 monthly families + 1 every-2-months all have 1 occurrence.
      const families = [
        { rule: { type: 'monthly' } as RecurrenceRule, referenceDate: new Date(2025, 0, 10), price: 100 },
        { rule: { type: 'monthly' } as RecurrenceRule, referenceDate: new Date(2025, 0, 15), price: 120 },
        { rule: { type: 'customMonths', interval: 2 } as RecurrenceRule, referenceDate: new Date(2025, 0, 20), price: 90 },
      ]
      const { total } = calculateProjectedRevenueForMonth(families, 2, 2025) // March
      expect(total).toBe(100 + 120 + 90) // 310
    })

    it('empty families returns 0', () => {
      const { total } = calculateProjectedRevenueForMonth([], 2, 2025)
      expect(total).toBe(0)
    })

    it('all families with 0 occurrences in month returns 0', () => {
      const families = [
        { rule: { type: 'customMonths', interval: 2 } as RecurrenceRule, referenceDate: new Date(2025, 0, 15), price: 150 },
        { rule: { type: 'customMonths', interval: 2 } as RecurrenceRule, referenceDate: new Date(2025, 0, 15), price: 200 },
      ]
      const { total } = calculateProjectedRevenueForMonth(families, 1, 2025) // Feb - neither aligns
      expect(total).toBe(0)
    })
  })
})

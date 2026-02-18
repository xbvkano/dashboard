import {
  calculateNextAppointmentDate,
  parseLegacyFrequency,
  ruleToJson,
  jsonToRule,
  formatRecurrenceRule,
  countOccurrencesInMonth,
  type RecurrenceRule,
} from '../../src/utils/recurrenceUtils'

describe('recurrenceUtils', () => {
  describe('calculateNextAppointmentDate', () => {
    it('adds 7 days for weekly recurrence', () => {
      const ref = new Date(2025, 0, 15) // Jan 15, 2025
      const next = calculateNextAppointmentDate({ type: 'weekly', interval: 1 }, ref)
      expect(next.getDate()).toBe(22)
      expect(next.getMonth()).toBe(0)
      expect(next.getFullYear()).toBe(2025)
    })

    it('adds 14 days for biweekly recurrence', () => {
      const ref = new Date(2025, 0, 15)
      const next = calculateNextAppointmentDate({ type: 'biweekly', interval: 2 }, ref)
      expect(next.getDate()).toBe(29)
      expect(next.getMonth()).toBe(0)
    })

    it('adds 21 days for every3weeks recurrence', () => {
      const ref = new Date(2025, 0, 15)
      const next = calculateNextAppointmentDate({ type: 'every3weeks', interval: 3 }, ref)
      expect(next.getDate()).toBe(5)
      expect(next.getMonth()).toBe(1) // Feb 5
    })

    it('adds 28 days for every4weeks recurrence', () => {
      const ref = new Date(2025, 0, 15)
      const next = calculateNextAppointmentDate({ type: 'every4weeks', interval: 4 }, ref)
      expect(next.getDate()).toBe(12)
      expect(next.getMonth()).toBe(1) // Feb 12
    })

    it('every4weeks lands on same weekday (e.g. Tuesday → Tuesday)', () => {
      // Feb 23, 2025 is a Sunday; 4 weeks later must be Sunday March 23
      const ref = new Date(Date.UTC(2025, 1, 23, 0, 0, 0, 0))
      expect(ref.getUTCDay()).toBe(0) // Sunday
      const next = calculateNextAppointmentDate({ type: 'every4weeks', interval: 4 }, ref)
      expect(next.getUTCDay()).toBe(0) // still Sunday
      expect(next.getUTCDate()).toBe(23)
      expect(next.getUTCMonth()).toBe(2) // March 23
    })

    it('adds 1 month for monthly recurrence', () => {
      const ref = new Date(2025, 0, 15)
      const next = calculateNextAppointmentDate({ type: 'monthly' }, ref)
      expect(next.getDate()).toBe(15)
      expect(next.getMonth()).toBe(1)
      expect(next.getFullYear()).toBe(2025)
    })

    it('handles Jan 31 to Feb (short month) for monthly', () => {
      const ref = new Date(2025, 0, 31)
      const next = calculateNextAppointmentDate({ type: 'monthly' }, ref)
      expect(next.getDate()).toBe(28) // Feb has 28 days in 2025
      expect(next.getMonth()).toBe(1)
    })

    it('returns to 31st after Feb 28 when next month has 31 days (monthly)', () => {
      const feb28 = new Date(2025, 1, 28) // Feb 28 (from Jan 31)
      const next = calculateNextAppointmentDate({ type: 'monthly' }, feb28)
      expect(next.getDate()).toBe(31)
      expect(next.getMonth()).toBe(2) // March
    })

    it('returns to 31st after Apr 30 when next month has 31 days (monthly)', () => {
      const apr30 = new Date(2025, 3, 30) // Apr 30 (from Mar 31)
      const next = calculateNextAppointmentDate({ type: 'monthly' }, apr30)
      expect(next.getDate()).toBe(31)
      expect(next.getMonth()).toBe(4) // May
    })

    it('adds interval months for customMonths with interval 2', () => {
      const ref = new Date(2025, 0, 15) // Jan 15
      const next = calculateNextAppointmentDate({ type: 'customMonths', interval: 2 }, ref)
      expect(next.getDate()).toBe(15)
      expect(next.getMonth()).toBe(2) // March
      expect(next.getFullYear()).toBe(2025)
    })

    it('handles day overflow for customMonths (e.g. Jan 31 + 1 month)', () => {
      const ref = new Date(2025, 0, 31)
      const next = calculateNextAppointmentDate({ type: 'customMonths', interval: 1 }, ref)
      expect(next.getDate()).toBe(28) // Feb 28
      expect(next.getMonth()).toBe(1)
    })

    it('returns to 31st after Feb 28 for customMonths when next month has 31 days', () => {
      const feb28 = new Date(2025, 1, 28)
      const next = calculateNextAppointmentDate({ type: 'customMonths', interval: 1 }, feb28)
      expect(next.getDate()).toBe(31)
      expect(next.getMonth()).toBe(2) // March
    })

    it('handles year rollover for customMonths', () => {
      const ref = new Date(2025, 10, 15) // Nov 15
      const next = calculateNextAppointmentDate({ type: 'customMonths', interval: 3 }, ref)
      expect(next.getDate()).toBe(15)
      expect(next.getMonth()).toBe(1) // Feb (0-indexed)
      expect(next.getFullYear()).toBe(2026)
    })

    it('uses weekly fallback for unknown rule type', () => {
      const ref = new Date(2025, 0, 15)
      const next = calculateNextAppointmentDate({ type: 'weekly' as any }, ref)
      expect(next.getDate()).toBe(22)
    })
  })

  describe('parseLegacyFrequency', () => {
    it('parses WEEKLY', () => {
      expect(parseLegacyFrequency('WEEKLY')).toEqual({ type: 'weekly', interval: 1 })
    })
    it('parses BIWEEKLY', () => {
      expect(parseLegacyFrequency('BIWEEKLY')).toEqual({ type: 'biweekly', interval: 2 })
    })
    it('parses EVERY3', () => {
      expect(parseLegacyFrequency('EVERY3')).toEqual({ type: 'every3weeks', interval: 3 })
    })
    it('parses EVERY4', () => {
      expect(parseLegacyFrequency('EVERY4')).toEqual({ type: 'every4weeks', interval: 4 })
    })
    it('parses MONTHLY', () => {
      expect(parseLegacyFrequency('MONTHLY')).toEqual({ type: 'monthly' })
    })
    it('parses CUSTOM with months', () => {
      expect(parseLegacyFrequency('CUSTOM', 4)).toEqual({ type: 'customMonths', interval: 4 })
    })
    it('defaults to weekly for unknown frequency', () => {
      expect(parseLegacyFrequency('UNKNOWN')).toEqual({ type: 'weekly', interval: 1 })
    })
  })

  describe('ruleToJson and jsonToRule', () => {
    it('round-trips a rule through JSON', () => {
      const rule: RecurrenceRule = { type: 'customMonths', interval: 3 }
      const json = ruleToJson(rule)
      expect(typeof json).toBe('string')
      const parsed = jsonToRule(json)
      expect(parsed).toEqual(rule)
    })

    it('returns default weekly for invalid JSON', () => {
      const parsed = jsonToRule('invalid json {')
      expect(parsed).toEqual({ type: 'weekly', interval: 1 })
    })

    it('parses every4weeks and next date is +28 days', () => {
      const parsed = jsonToRule('{"type":"every4weeks"}')
      expect(parsed.type).toBe('every4weeks')
      const ref = new Date(2025, 1, 23) // Feb 23
      const next = calculateNextAppointmentDate(parsed, ref)
      expect(next.getDate()).toBe(23)
      expect(next.getMonth()).toBe(2) // March 23
    })

    it('normalizes interval 4 to every4weeks when type was wrong', () => {
      const parsed = jsonToRule('{"type":"weekly","interval":4}')
      expect(parsed.type).toBe('every4weeks')
      expect(parsed.interval).toBe(4)
    })
  })

  describe('formatRecurrenceRule', () => {
    it('formats weekly', () => expect(formatRecurrenceRule({ type: 'weekly' })).toBe('Every week'))
    it('formats biweekly', () => expect(formatRecurrenceRule({ type: 'biweekly' })).toBe('Every 2 weeks'))
    it('formats every3weeks', () => expect(formatRecurrenceRule({ type: 'every3weeks' })).toBe('Every 3 weeks'))
    it('formats every4weeks', () => expect(formatRecurrenceRule({ type: 'every4weeks' })).toBe('Every 4 weeks'))
    it('formats monthly', () => expect(formatRecurrenceRule({ type: 'monthly' })).toBe('Every month'))
    it('formats customMonths interval 1', () => expect(formatRecurrenceRule({ type: 'customMonths', interval: 1 })).toBe('Every 1 month'))
    it('formats customMonths interval 3', () => expect(formatRecurrenceRule({ type: 'customMonths', interval: 3 })).toBe('Every 3 months'))
    it('formats monthlyPattern first Monday', () => {
      expect(formatRecurrenceRule({ type: 'monthlyPattern', weekOfMonth: 1, dayOfWeek: 1 })).toBe('first Monday of every month')
    })
    it('formats monthlyPattern last Friday', () => {
      expect(formatRecurrenceRule({ type: 'monthlyPattern', weekOfMonth: -1, dayOfWeek: 5 })).toBe('last Friday of every month')
    })
  })

  describe('countOccurrencesInMonth', () => {
    it('returns 0 when last booked is after target month', () => {
      const lastBooked = new Date(2025, 3, 15) // April 15
      const count = countOccurrencesInMonth({ type: 'weekly' }, lastBooked, 1, 2025) // February
      expect(count).toBe(0)
    })

    it('counts 4 weekly occurrences when starting mid-month (Jan 1 ref → Jan 8, 15, 22, 29)', () => {
      const lastBooked = new Date(2025, 0, 1) // Jan 1
      const count = countOccurrencesInMonth({ type: 'weekly' }, lastBooked, 0, 2025) // January
      expect(count).toBe(4)
    })

    it('counts 5 weekly occurrences when starting before month (Dec 18 ref → Jan 1, 8, 15, 22, 29)', () => {
      const lastBooked = new Date(2024, 11, 18) // Dec 18 - next occurrences land 5x in Jan
      const count = countOccurrencesInMonth({ type: 'weekly' }, lastBooked, 0, 2025) // January
      expect(count).toBe(5)
    })

    it('counts 4 weekly occurrences in February (28 days, start before month)', () => {
      const lastBooked = new Date(2025, 0, 29) // Jan 29 - next: Feb 5, 12, 19, 26
      const count = countOccurrencesInMonth({ type: 'weekly' }, lastBooked, 1, 2025) // February
      expect(count).toBe(4)
    })

    it('counts 4 weekly occurrences in March when starting Feb 26 (Mar 5, 12, 19, 26)', () => {
      const lastBooked = new Date(2025, 1, 26) // Feb 26 - next: Mar 5, 12, 19, 26
      const count = countOccurrencesInMonth({ type: 'weekly' }, lastBooked, 2, 2025) // March
      expect(count).toBe(4)
    })

    it('counts 5 weekly occurrences in March when starting Feb 23 (Mar 2, 9, 16, 23, 30)', () => {
      const lastBooked = new Date(2025, 1, 23) // Feb 23 - next: Mar 2, 9, 16, 23, 30
      const count = countOccurrencesInMonth({ type: 'weekly' }, lastBooked, 2, 2025)
      expect(count).toBe(5)
    })

    it('weekly: 5 times in July 2025 when ref is June 25', () => {
      const lastBooked = new Date(2025, 5, 25) // Jun 25 - next: Jul 2, 9, 16, 23, 30
      const count = countOccurrencesInMonth({ type: 'weekly' }, lastBooked, 6, 2025) // July
      expect(count).toBe(5)
    })

    it('counts 2 biweekly occurrences when starting Jan 1 (Jan 15, 29)', () => {
      const lastBooked = new Date(2025, 0, 1)
      const count = countOccurrencesInMonth({ type: 'biweekly' }, lastBooked, 0, 2025)
      expect(count).toBe(2)
    })

    it('counts 3 biweekly occurrences when starting before month (Dec 18 ref → Jan 1, 15, 29)', () => {
      const lastBooked = new Date(2024, 11, 18)
      const count = countOccurrencesInMonth({ type: 'biweekly' }, lastBooked, 0, 2025)
      expect(count).toBe(3)
    })

    it('counts 1 biweekly occurrence when starting Jan 8 (next Jan 22 only in Jan, then Feb 5)', () => {
      const lastBooked = new Date(2025, 0, 8) // Jan 8 + 14 = Jan 22 (in Jan), Jan 22 + 14 = Feb 5 (out)
      const count = countOccurrencesInMonth({ type: 'biweekly' }, lastBooked, 0, 2025)
      expect(count).toBe(1)
    })

    it('counts 2 every3weeks occurrences when starting before month (Dec 11 ref → Jan 1, 22)', () => {
      const lastBooked = new Date(2024, 11, 11) // Dec 11 + 21 = Jan 1, Jan 1 + 21 = Jan 22
      const count = countOccurrencesInMonth({ type: 'every3weeks' }, lastBooked, 0, 2025)
      expect(count).toBe(2)
    })

    it('counts 1 every3weeks occurrence when starting Jan 1 (Jan 22 only, next Feb 12)', () => {
      const lastBooked = new Date(2025, 0, 1)
      const count = countOccurrencesInMonth({ type: 'every3weeks' }, lastBooked, 0, 2025)
      expect(count).toBe(1)
    })

    it('counts 2 every3weeks occurrences in March when starting Jan 22 (Mar 5, 26)', () => {
      const lastBooked = new Date(2025, 0, 22) // Jan 22 + 21 = Feb 12, Feb 12 + 21 = Mar 5, Mar 5 + 21 = Mar 26
      const count = countOccurrencesInMonth({ type: 'every3weeks' }, lastBooked, 2, 2025)
      expect(count).toBe(2)
    })

    it('adds 28 days for every4weeks: Jan 1 → Jan 29, then Feb 26', () => {
      const lastBooked = new Date(2025, 0, 1)
      const next1 = calculateNextAppointmentDate({ type: 'every4weeks', interval: 4 }, lastBooked)
      expect(next1.getDate()).toBe(29)
      expect(next1.getMonth()).toBe(0)
      const next2 = calculateNextAppointmentDate({ type: 'every4weeks', interval: 4 }, next1)
      expect(next2.getDate()).toBe(26)
      expect(next2.getMonth()).toBe(1)
    })

    it('counts 1 every4weeks occurrence in January when starting Jan 1 (Jan 29 only, next Feb 26)', () => {
      const lastBooked = new Date(2025, 0, 1)
      const count = countOccurrencesInMonth({ type: 'every4weeks' }, lastBooked, 0, 2025)
      expect(count).toBe(1)
    })

    it('counts 1 every4weeks occurrence in March when starting Jan 29 (Mar 26 only)', () => {
      const lastBooked = new Date(2025, 0, 29) // Jan 29 + 28 = Feb 26, Feb 26 + 28 = Mar 26
      const count = countOccurrencesInMonth({ type: 'every4weeks' }, lastBooked, 2, 2025) // March: Mar 26 only
      expect(count).toBe(1)
    })

    it('counts 1 monthly occurrence', () => {
      const lastBooked = new Date(2025, 0, 15)
      const count = countOccurrencesInMonth({ type: 'monthly' }, lastBooked, 2, 2025) // March
      expect(count).toBe(1)
    })

    it('counts 1 for customMonths every 2 months when month aligns', () => {
      const lastBooked = new Date(2025, 0, 15) // Jan 15
      const count = countOccurrencesInMonth({ type: 'customMonths', interval: 2 }, lastBooked, 2, 2025) // March
      expect(count).toBe(1)
    })

    it('returns 0 for customMonths every 2 months when month does not align', () => {
      const lastBooked = new Date(2025, 0, 15) // Jan 15
      const count = countOccurrencesInMonth({ type: 'customMonths', interval: 2 }, lastBooked, 1, 2025) // February
      expect(count).toBe(0)
    })

    it('returns 0 for customMonths when future month does not align with interval', () => {
      const lastBooked = new Date(2025, 0, 10) // Jan 10
      const count = countOccurrencesInMonth({ type: 'customMonths', interval: 2 }, lastBooked, 5, 2025) // June (5 months from Jan, 5%2≠0)
      expect(count).toBe(0)
    })

    it('counts customMonths every 3 months correctly for future months', () => {
      const lastBooked = new Date(2025, 0, 15) // Jan
      // Jan, Apr, Jul, Oct
      expect(countOccurrencesInMonth({ type: 'customMonths', interval: 3 }, lastBooked, 3, 2025)).toBe(1) // April
      expect(countOccurrencesInMonth({ type: 'customMonths', interval: 3 }, lastBooked, 1, 2025)).toBe(0) // Feb
    })
  })
})

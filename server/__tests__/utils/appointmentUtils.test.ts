import {
  parseSqft,
  calculateAppointmentHours,
  calculatePayRate,
  calculateCarpetRate,
  getSlotFromTime,
} from '../../src/utils/appointmentUtils'

describe('appointmentUtils', () => {
  describe('parseSqft', () => {
    it('parses simple number string', () => {
      expect(parseSqft('1500')).toBe(1500)
    })
    it('parses range format (e.g. "1000-1500")', () => {
      expect(parseSqft('1000-1500')).toBe(1500) // uses second part
    })
    it('parses range with first part only when second is missing', () => {
      expect(parseSqft('1500-')).toBe(1500)
    })
    it('returns null for null/undefined', () => {
      expect(parseSqft(null)).toBeNull()
      expect(parseSqft(undefined)).toBeNull()
    })
    it('returns null for empty string', () => {
      expect(parseSqft('')).toBeNull()
    })
    it('returns null for non-numeric string', () => {
      expect(parseSqft('abc')).toBeNull()
    })
  })

  describe('calculateAppointmentHours', () => {
    describe('STANDARD service', () => {
      it('returns 3 hours for ≤1500 sqft', () => {
        expect(calculateAppointmentHours('1500', 'STANDARD')).toBe(3)
      })
      it('returns 4 hours for 1501-2000 sqft', () => {
        expect(calculateAppointmentHours('1800', 'STANDARD')).toBe(4)
      })
      it('returns 5 hours for 2001-2500 sqft', () => {
        expect(calculateAppointmentHours('2200', 'STANDARD')).toBe(5)
      })
      it('returns 6 hours for 2501-3000 sqft', () => {
        expect(calculateAppointmentHours('2800', 'STANDARD')).toBe(6)
      })
      it('returns 7 hours for 3001-3500 sqft', () => {
        expect(calculateAppointmentHours('3200', 'STANDARD')).toBe(7)
      })
      it('returns 8 hours for 3501-4000 sqft', () => {
        expect(calculateAppointmentHours('3800', 'STANDARD')).toBe(8)
      })
      it('returns 9 hours for 4000+ sqft', () => {
        expect(calculateAppointmentHours('5000', 'STANDARD')).toBe(9)
      })
      it('defaults to 3 hours when size cannot be parsed', () => {
        expect(calculateAppointmentHours(null, 'STANDARD')).toBe(3)
        expect(calculateAppointmentHours('invalid', 'STANDARD')).toBe(3)
      })
    })

    describe('DEEP service', () => {
      it('adds 1 hour to base', () => {
        expect(calculateAppointmentHours('1500', 'DEEP')).toBe(4)
        expect(calculateAppointmentHours('2500', 'DEEP')).toBe(6)
      })
    })

    describe('MOVE_IN_OUT service', () => {
      it('adds 2 hours to base', () => {
        expect(calculateAppointmentHours('1500', 'MOVE_IN_OUT')).toBe(5)
        expect(calculateAppointmentHours('2500', 'MOVE_IN_OUT')).toBe(7)
      })
    })
  })

  describe('calculatePayRate', () => {
    describe('STANDARD type', () => {
      it('returns 80 for small (≤2500 sqft)', () => {
        expect(calculatePayRate('STANDARD', '1500', 1)).toBe(80)
      })
      it('returns 100 for large (>2500 sqft)', () => {
        expect(calculatePayRate('STANDARD', '3000', 1)).toBe(100)
      })
    })

    describe('DEEP / MOVE_IN_OUT type', () => {
      it('returns 100 for large regardless of count', () => {
        expect(calculatePayRate('DEEP', '3000', 1)).toBe(100)
        expect(calculatePayRate('DEEP', '3000', 2)).toBe(100)
      })
      it('returns 100 for small with 1 employee', () => {
        expect(calculatePayRate('DEEP', '1500', 1)).toBe(100)
      })
      it('returns 90 for small with 2+ employees', () => {
        expect(calculatePayRate('DEEP', '1500', 2)).toBe(90)
      })
    })

    it('returns 0 for unknown type', () => {
      expect(calculatePayRate('UNKNOWN', '1500', 1)).toBe(0)
    })
  })

  describe('calculateCarpetRate', () => {
    it('returns 10 for 1 room small, 20 for 1 room large', () => {
      expect(calculateCarpetRate('1500', 1)).toBe(10)
      expect(calculateCarpetRate('3000', 1)).toBe(20)
    })
    it('returns 20 for 2-3 rooms small, 30 for 2-3 rooms large', () => {
      expect(calculateCarpetRate('1500', 2)).toBe(20)
      expect(calculateCarpetRate('3000', 3)).toBe(30)
    })
    it('returns 30 for 4-5 rooms small, 40 for 4-5 rooms large', () => {
      expect(calculateCarpetRate('1500', 5)).toBe(30)
      expect(calculateCarpetRate('3000', 4)).toBe(40)
    })
    it('returns 40 for 6-8 rooms small, 60 for 6-8 rooms large', () => {
      expect(calculateCarpetRate('1500', 8)).toBe(40)
      expect(calculateCarpetRate('3000', 6)).toBe(60)
    })
    it('adds 10 per room over 8 for small', () => {
      expect(calculateCarpetRate('1500', 10)).toBe(60) // 40 + 10*2
    })
    it('adds 10 per room over 8 for large', () => {
      expect(calculateCarpetRate('3000', 10)).toBe(80) // 60 + 10*2
    })
    it('returns 0 when size cannot be parsed', () => {
      expect(calculateCarpetRate('invalid', 5)).toBe(0)
    })
  })

  describe('getSlotFromTime', () => {
    it('returns M (AM) for times before 2pm', () => {
      expect(getSlotFromTime('08:00')).toBe('M')
      expect(getSlotFromTime('09:30')).toBe('M')
      expect(getSlotFromTime('13:59')).toBe('M')
    })
    it('returns A (PM) for 2pm and after', () => {
      expect(getSlotFromTime('14:00')).toBe('A')
      expect(getSlotFromTime('17:00')).toBe('A')
    })
    it('returns M for empty or invalid time', () => {
      expect(getSlotFromTime('')).toBe('M')
      expect(getSlotFromTime(null as any)).toBe('M')
      expect(getSlotFromTime(undefined as any)).toBe('M')
    })
  })
})

import {
  getAppliancesInsidePrice,
  getBaseboardsPrice,
  getCarpetShampooPrice,
  getCarpetShampooRatePerRoom,
  getExtraCleanerAmount,
} from '../../src/data/addonPricing'

describe('addonPricing', () => {
  describe('getExtraCleanerAmount', () => {
    it('returns 80 for STANDARD', () => {
      expect(getExtraCleanerAmount('STANDARD')).toBe(80)
    })

    it('returns 100 for DEEP and MOVE_IN_OUT', () => {
      expect(getExtraCleanerAmount('DEEP')).toBe(100)
      expect(getExtraCleanerAmount('MOVE_IN_OUT')).toBe(100)
    })

    it('returns null for unknown type', () => {
      expect(getExtraCleanerAmount('UNKNOWN')).toBeNull()
    })
  })

  describe('getAppliancesInsidePrice', () => {
    it('returns 30 for STANDARD only', () => {
      expect(getAppliancesInsidePrice('STANDARD')).toBe(30)
      expect(getAppliancesInsidePrice('DEEP')).toBeNull()
      expect(getAppliancesInsidePrice('MOVE_IN_OUT')).toBeNull()
    })
  })

  describe('getCarpetShampooRatePerRoom', () => {
    it('returns 70 for one room', () => {
      expect(getCarpetShampooRatePerRoom(1)).toBe(70)
    })

    it('returns 60 for two rooms', () => {
      expect(getCarpetShampooRatePerRoom(2)).toBe(60)
    })

    it('returns 50 for three or more rooms', () => {
      expect(getCarpetShampooRatePerRoom(3)).toBe(50)
      expect(getCarpetShampooRatePerRoom(5)).toBe(50)
    })

    it('returns null for zero or negative rooms', () => {
      expect(getCarpetShampooRatePerRoom(0)).toBeNull()
      expect(getCarpetShampooRatePerRoom(-1)).toBeNull()
    })
  })

  describe('getCarpetShampooPrice', () => {
    it('calculates total from room-count rate', () => {
      expect(getCarpetShampooPrice('0-1000', 1)).toEqual({
        ratePerRoom: 70,
        total: 70,
      })
      expect(getCarpetShampooPrice('3000-3500', 2)).toEqual({
        ratePerRoom: 60,
        total: 120,
      })
      expect(getCarpetShampooPrice('4500-5000', 4)).toEqual({
        ratePerRoom: 50,
        total: 200,
      })
    })

    it('returns null for zero or negative rooms', () => {
      expect(getCarpetShampooPrice('0-1000', 0)).toBeNull()
    })
  })

  describe('getBaseboardsPrice', () => {
    it('returns 30 up to 2500 sqft', () => {
      expect(getBaseboardsPrice('0-1000', 'STANDARD')).toBe(30)
      expect(getBaseboardsPrice('2000-2500', 'DEEP')).toBe(30)
      expect(getBaseboardsPrice('2500', 'STANDARD')).toBe(30)
    })

    it('returns 40 above 2500 sqft', () => {
      expect(getBaseboardsPrice('2500-3000', 'STANDARD')).toBe(40)
      expect(getBaseboardsPrice('5000-5500', 'DEEP')).toBe(40)
    })
  })
})

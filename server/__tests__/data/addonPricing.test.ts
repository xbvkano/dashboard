import {
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

  describe('getCarpetShampooRatePerRoom', () => {
    it('returns 45 for up to 1000 sqft', () => {
      expect(getCarpetShampooRatePerRoom('0-1000')).toBe(45)
      expect(getCarpetShampooRatePerRoom('999')).toBe(45)
    })

    it('returns 50 above 1000 up to 4000 sqft', () => {
      expect(getCarpetShampooRatePerRoom('1000-1500')).toBe(50)
      expect(getCarpetShampooRatePerRoom('3500-4000')).toBe(50)
      expect(getCarpetShampooRatePerRoom('4000')).toBe(50)
    })

    it('returns 55 above 4000 sqft', () => {
      expect(getCarpetShampooRatePerRoom('4000-4500')).toBe(55)
      expect(getCarpetShampooRatePerRoom('5500-6000')).toBe(55)
    })
  })

  describe('getCarpetShampooPrice', () => {
    it('calculates total from rooms and tier rate', () => {
      expect(getCarpetShampooPrice('0-1000', 3)).toEqual({
        ratePerRoom: 45,
        total: 135,
      })
      expect(getCarpetShampooPrice('3000-3500', 2)).toEqual({
        ratePerRoom: 50,
        total: 100,
      })
      expect(getCarpetShampooPrice('4500-5000', 4)).toEqual({
        ratePerRoom: 55,
        total: 220,
      })
    })

    it('returns null for zero or negative rooms', () => {
      expect(getCarpetShampooPrice('0-1000', 0)).toBeNull()
    })
  })

  describe('getBaseboardsPrice', () => {
    it('returns flat 20 regardless of size and type', () => {
      expect(getBaseboardsPrice('0-1000', 'STANDARD')).toBe(20)
      expect(getBaseboardsPrice('5000-5500', 'DEEP')).toBe(20)
    })
  })
})

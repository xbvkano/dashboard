import {
  getPricing,
  getDefaultPrice,
  getDefaultTeamSize,
  getSizeRange,
} from '../../src/data/teamSizeData'
import { resolvePricingInput } from '../../src/services/pricing/resolvePricingInput'

describe('teamSizeData', () => {
  describe('getPricing', () => {
    it('returns correct price and team size for 0-1000 Standard', () => {
      expect(getPricing('0-1000', 'STANDARD')).toEqual({
        teamSize: 1,
        price: 210,
        requiresReview: false,
      })
    })

    it('returns correct price and team size for 2000-2500 Deep', () => {
      expect(getPricing('2000-2500', 'DEEP')).toEqual({
        teamSize: 2,
        price: 380,
        requiresReview: false,
      })
    })

    it('returns correct price and team size for 5000-5500 Move-in/out', () => {
      expect(getPricing('5000-5500', 'MOVE_IN_OUT')).toEqual({
        teamSize: 3,
        price: 620,
        requiresReview: false,
      })
    })

    it('returns supervisor review for 6000+', () => {
      expect(getPricing('6000+', 'STANDARD')).toEqual({
        teamSize: null,
        price: null,
        requiresReview: true,
        message: 'Price requires supervisor review',
      })
    })

    it('maps raw sqft to bucket via getSizeRange', () => {
      expect(getPricing('3200', 'STANDARD')).toEqual({
        teamSize: 2,
        price: 320,
        requiresReview: false,
      })
    })
  })

  describe('getDefaultTeamSize / getDefaultPrice backward compat', () => {
    it('delegates to getPricing for normal rows', () => {
      expect(getDefaultTeamSize('1500-2000', 'DEEP')).toBe(1)
      expect(getDefaultPrice('1500-2000', 'DEEP')).toBe(320)
    })

    it('falls back when requires review', () => {
      expect(getDefaultTeamSize('6000+', 'DEEP')).toBe(1)
      expect(getDefaultPrice('6000+', 'DEEP')).toBe(0)
    })
  })

  describe('getSizeRange', () => {
    it('passes through bucket strings', () => {
      expect(getSizeRange('3000-3500')).toBe('3000-3500')
      expect(getSizeRange('6000+')).toBe('6000+')
    })

    it('maps numeric sqft to buckets', () => {
      expect(getSizeRange('3200')).toBe('3000-3500')
      expect(getSizeRange('6500')).toBe('6000+')
    })
  })
})

describe('resolvePricingInput', () => {
  it('resolves sizeType mode', () => {
    expect(
      resolvePricingInput({ mode: 'sizeType', size: '1000-1500', type: 'DEEP' })
    ).toEqual({
      teamSize: 1,
      price: 290,
      requiresReview: false,
    })
  })

  it('throws for unimplemented bedBath mode', () => {
    expect(() =>
      resolvePricingInput({ mode: 'bedBath', bedrooms: 3, bathrooms: 2, type: 'STANDARD' })
    ).toThrow('not implemented')
  })
})

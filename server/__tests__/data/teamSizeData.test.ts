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
        price: 410,
        requiresReview: false,
      })
    })

    it('returns correct price and team size for 5000-5500 Move-in/out', () => {
      expect(getPricing('5000-5500', 'MOVE_IN_OUT')).toEqual({
        teamSize: 3,
        price: 660,
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
        price: 380,
        requiresReview: false,
      })
    })
  })

  describe('getDefaultTeamSize / getDefaultPrice backward compat', () => {
    it('delegates to getPricing for normal rows', () => {
      expect(getDefaultTeamSize('1500-2000', 'DEEP')).toBe(1)
      expect(getDefaultPrice('1500-2000', 'DEEP')).toBe(340)
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
  it('resolves sizeType mode with add-ons', () => {
    expect(
      resolvePricingInput({ mode: 'sizeType', size: '1000-1500', type: 'DEEP' })
    ).toEqual({
      teamSize: 1,
      price: 295,
      requiresReview: false,
      size: '1000-1500',
      extraCleanerAmount: 100,
      baseboardsPrice: 20,
      carpetShampoo: null,
    })
  })

  it('resolves bedBath mode', () => {
    expect(
      resolvePricingInput({
        mode: 'bedBath',
        bedrooms: 3,
        bathrooms: 2,
        type: 'STANDARD',
      })
    ).toEqual({
      teamSize: 1,
      price: 260,
      requiresReview: false,
      size: '1500-2000',
      extraCleanerAmount: 80,
      baseboardsPrice: 20,
      carpetShampoo: null,
    })
  })

  it('resolves formerly missing bedBath combinations through pricing', () => {
    expect(
      resolvePricingInput({
        mode: 'bedBath',
        bedrooms: 1,
        bathrooms: 2,
        type: 'DEEP',
      })
    ).toMatchObject({
      size: '1000-1500',
      price: 295,
      teamSize: 1,
      requiresReview: false,
    })
    expect(
      resolvePricingInput({
        mode: 'bedBath',
        bedrooms: 2,
        bathrooms: 3,
        type: 'STANDARD',
      })
    ).toMatchObject({
      size: '2000-2500',
      price: 295,
      teamSize: 1,
      requiresReview: false,
    })
    expect(
      resolvePricingInput({
        mode: 'bedBath',
        bedrooms: 3,
        bathrooms: 3.5,
        type: 'MOVE_IN_OUT',
      })
    ).toMatchObject({
      size: '3000-3500',
      price: 480,
      teamSize: 2,
      requiresReview: false,
    })
    expect(
      resolvePricingInput({
        mode: 'bedBath',
        bedrooms: 4,
        bathrooms: 1,
        type: 'STANDARD',
      })
    ).toMatchObject({
      size: '1000-1500',
      price: 240,
      teamSize: 1,
      requiresReview: false,
    })
  })

  it('includes carpet shampoo when rooms provided', () => {
    expect(
      resolvePricingInput({
        mode: 'sizeType',
        size: '0-1000',
        type: 'STANDARD',
        carpetShampooRooms: 2,
      })
    ).toMatchObject({
      carpetShampoo: { rooms: 2, ratePerRoom: 45, total: 90 },
    })
  })

  it('returns supervisor review for 5+ bedrooms (like 6000+ sqft)', () => {
    expect(
      resolvePricingInput({
        mode: 'bedBath',
        bedrooms: 5,
        bathrooms: 2,
        type: 'STANDARD',
      })
    ).toEqual({
      teamSize: null,
      price: null,
      requiresReview: true,
      message: 'Price requires supervisor review',
    })
  })

  it('returns supervisor review for 5+ bathrooms (like 6000+ sqft)', () => {
    expect(
      resolvePricingInput({
        mode: 'bedBath',
        bedrooms: 4,
        bathrooms: 5,
        type: 'DEEP',
      })
    ).toEqual({
      teamSize: null,
      price: null,
      requiresReview: true,
      message: 'Price requires supervisor review',
    })
  })

  it('throws for unmapped bedBath combo within unsupported ranges', () => {
    expect(() =>
      resolvePricingInput({ mode: 'bedBath', bedrooms: 0, bathrooms: 2, type: 'STANDARD' })
    ).toThrow('No size mapping')
  })
})

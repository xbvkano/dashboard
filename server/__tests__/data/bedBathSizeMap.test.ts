import { bedBathSizeMap, resolveSizeFromBedBath } from '../../src/data/bedBathSizeMap'

describe('bedBathSizeMap', () => {
  it('has 15 explicit mappings', () => {
    expect(bedBathSizeMap).toHaveLength(15)
  })

  it.each([
    [1, 1, '0-1000'],
    [1, 1.5, '0-1000'],
    [2, 1, '1000-1500'],
    [2, 1.5, '1000-1500'],
    [2, 2, '1000-1500'],
    [2, 2.5, '2000-2500'],
    [3, 1, '1000-1500'],
    [3, 2, '1500-2000'],
    [3, 2.5, '2000-2500'],
    [3, 3, '2500-3000'],
    [4, 2, '1500-2000'],
    [4, 2.5, '2000-2500'],
    [4, 3, '3000-3500'],
    [4, 3.5, '3000-3500'],
    [4, 4, '3500-4000'],
  ] as const)(
    'maps %i bed / %s bath to %s',
    (bedrooms, bathrooms, size) => {
      expect(resolveSizeFromBedBath(bedrooms, bathrooms)).toBe(size)
    }
  )

  it('returns null for unmapped combinations', () => {
    expect(resolveSizeFromBedBath(5, 2)).toBeNull()
    expect(resolveSizeFromBedBath(2, 3)).toBeNull()
  })
})

import { bedBathSizeMap, resolveSizeFromBedBath } from '../../src/data/bedBathSizeMap'
import { teamSizeData } from '../../src/data/teamSizeData'

/** Mirrors calculator UI options in BedBathSearch.tsx */
const BEDROOM_OPTIONS = [1, 2, 3, 4] as const
const BATHROOM_OPTIONS = [1, 1.5, 2, 2.5, 3, 3.5, 4] as const

const SIZE_BUCKET_ORDER = [
  '0-1000',
  '1000-1500',
  '1500-2000',
  '2000-2500',
  '2500-3000',
  '3000-3500',
  '3500-4000',
  '4000-4500',
  '4500-5000',
  '5000-5500',
  '5500-6000',
  '6000+',
] as const

const validPricingSizes = new Set(teamSizeData.map((r) => r.size))

function sizeRank(size: string): number {
  const idx = SIZE_BUCKET_ORDER.indexOf(size as (typeof SIZE_BUCKET_ORDER)[number])
  if (idx < 0) throw new Error(`Unknown size bucket: ${size}`)
  return idx
}

describe('bedBathSizeMap', () => {
  it('has 28 explicit mappings (all UI combinations)', () => {
    expect(bedBathSizeMap).toHaveLength(28)
  })

  it('has unique bedroom/bathroom keys', () => {
    const keys = bedBathSizeMap.map((r) => `${r.bedrooms}-${r.bathrooms}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('only maps to sizes that exist in teamSizeData', () => {
    for (const row of bedBathSizeMap) {
      expect(validPricingSizes.has(row.size)).toBe(true)
    }
  })

  it('covers every UI bedroom × bathroom combination', () => {
    for (const bedrooms of BEDROOM_OPTIONS) {
      for (const bathrooms of BATHROOM_OPTIONS) {
        expect(resolveSizeFromBedBath(bedrooms, bathrooms)).not.toBeNull()
      }
    }
  })

  it.each([
    [1, 1, '0-1000'],
    [1, 1.5, '0-1000'],
    [1, 2, '1000-1500'],
    [1, 2.5, '1500-2000'],
    [1, 3, '1500-2000'],
    [1, 3.5, '2000-2500'],
    [1, 4, '2000-2500'],
    [2, 1, '1000-1500'],
    [2, 1.5, '1000-1500'],
    [2, 2, '1000-1500'],
    [2, 2.5, '2000-2500'],
    [2, 3, '2000-2500'],
    [2, 3.5, '2500-3000'],
    [2, 4, '2500-3000'],
    [3, 1, '1000-1500'],
    [3, 1.5, '1000-1500'],
    [3, 2, '1500-2000'],
    [3, 2.5, '2000-2500'],
    [3, 3, '2500-3000'],
    [3, 3.5, '3000-3500'],
    [3, 4, '3000-3500'],
    [4, 1, '1000-1500'],
    [4, 1.5, '1000-1500'],
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

  it('is non-decreasing in bathrooms for fixed bedrooms', () => {
    for (const bedrooms of BEDROOM_OPTIONS) {
      for (let i = 0; i < BATHROOM_OPTIONS.length - 1; i++) {
        const a = resolveSizeFromBedBath(bedrooms, BATHROOM_OPTIONS[i])!
        const b = resolveSizeFromBedBath(bedrooms, BATHROOM_OPTIONS[i + 1])!
        expect(sizeRank(b)).toBeGreaterThanOrEqual(sizeRank(a))
      }
    }
  })

  it('is non-decreasing in bedrooms for fixed bathrooms', () => {
    for (const bathrooms of BATHROOM_OPTIONS) {
      for (let i = 0; i < BEDROOM_OPTIONS.length - 1; i++) {
        const a = resolveSizeFromBedBath(BEDROOM_OPTIONS[i], bathrooms)!
        const b = resolveSizeFromBedBath(BEDROOM_OPTIONS[i + 1], bathrooms)!
        expect(sizeRank(b)).toBeGreaterThanOrEqual(sizeRank(a))
      }
    }
  })

  it('respects pairwise dominance (more beds and baths cannot map smaller)', () => {
    for (const rowA of bedBathSizeMap) {
      for (const rowB of bedBathSizeMap) {
        if (
          rowB.bedrooms >= rowA.bedrooms &&
          rowB.bathrooms >= rowA.bathrooms &&
          (rowB.bedrooms > rowA.bedrooms || rowB.bathrooms > rowA.bathrooms)
        ) {
          expect(sizeRank(rowB.size)).toBeGreaterThanOrEqual(sizeRank(rowA.size))
        }
      }
    }
  })

  it('returns null for unmapped combinations outside the UI matrix', () => {
    expect(resolveSizeFromBedBath(5, 2)).toBeNull()
    expect(resolveSizeFromBedBath(0, 2)).toBeNull()
    expect(resolveSizeFromBedBath(2, 0)).toBeNull()
  })
})

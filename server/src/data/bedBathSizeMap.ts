export interface BedBathRow {
  bedrooms: number
  bathrooms: number
  size: string
}

export const bedBathSizeMap: BedBathRow[] = [
  { bedrooms: 1, bathrooms: 1, size: '0-1000' },
  { bedrooms: 1, bathrooms: 1.5, size: '0-1000' },
  { bedrooms: 2, bathrooms: 1, size: '1000-1500' },
  { bedrooms: 2, bathrooms: 1.5, size: '1000-1500' },
  { bedrooms: 2, bathrooms: 2, size: '1000-1500' },
  { bedrooms: 2, bathrooms: 2.5, size: '2000-2500' },
  { bedrooms: 3, bathrooms: 1, size: '1000-1500' },
  { bedrooms: 3, bathrooms: 2, size: '1500-2000' },
  { bedrooms: 3, bathrooms: 2.5, size: '2000-2500' },
  { bedrooms: 3, bathrooms: 3, size: '2500-3000' },
  { bedrooms: 4, bathrooms: 2, size: '1500-2000' },
  { bedrooms: 4, bathrooms: 2.5, size: '2000-2500' },
  { bedrooms: 4, bathrooms: 3, size: '3000-3500' },
  { bedrooms: 4, bathrooms: 3.5, size: '3000-3500' },
  { bedrooms: 4, bathrooms: 4, size: '3500-4000' },
]

export function resolveSizeFromBedBath(
  bedrooms: number,
  bathrooms: number
): string | null {
  const row = bedBathSizeMap.find(
    (r) => r.bedrooms === bedrooms && r.bathrooms === bathrooms
  )
  return row?.size ?? null
}

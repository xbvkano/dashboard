import { parseSqft } from '../utils/appointmentUtils'
import { getSizeRange } from './teamSizeData'

/** Extra cleaner ("Menina Extra") — flat by service type for now */
export const EXTRA_CLEANER_BY_TYPE = {
  STANDARD: 80,
  DEEP: 100,
  MOVE_IN_OUT: 100,
} as const

/** Carpet shampoo customer rate tiers by resolved sqft upper bound */
export const CARPET_SHAMPOO_TIERS = [
  { maxSqft: 1000, ratePerRoom: 45 },
  { maxSqft: 4000, ratePerRoom: 50 },
  { maxSqft: Infinity, ratePerRoom: 55 },
] as const

const BASEBOARDS_FLAT_PRICE = 20

export function getExtraCleanerAmount(type: string): number | null {
  const key = type as keyof typeof EXTRA_CLEANER_BY_TYPE
  return EXTRA_CLEANER_BY_TYPE[key] ?? null
}

export function getCarpetShampooRatePerRoom(size: string): number | null {
  const sqft = parseSqft(getSizeRange(size))
  if (sqft === null) return null
  const tier = CARPET_SHAMPOO_TIERS.find((t) => sqft <= t.maxSqft)
  return tier?.ratePerRoom ?? null
}

export function getCarpetShampooPrice(
  size: string,
  rooms: number
): { ratePerRoom: number; total: number } | null {
  if (rooms <= 0) return null
  const ratePerRoom = getCarpetShampooRatePerRoom(size)
  if (ratePerRoom === null) return null
  return { ratePerRoom, total: rooms * ratePerRoom }
}

/** Baseboards — flat for now; accepts size + type for future tiered pricing */
export function getBaseboardsPrice(_size: string, _type: string): number {
  return BASEBOARDS_FLAT_PRICE
}

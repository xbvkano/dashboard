import { parseSqft } from '../utils/appointmentUtils'
import { getSizeRange } from './teamSizeData'

/** Extra cleaner ("Menina Extra") — flat by service type for now */
export const EXTRA_CLEANER_BY_TYPE = {
  STANDARD: 80,
  DEEP: 100,
  MOVE_IN_OUT: 100,
} as const

/** Fridge/oven cleaned on the inside — STANDARD only */
export const APPLIANCES_INSIDE_PRICE = 30

/**
 * Carpet shampoo customer rate by room count:
 * 1 room → $70, 2 rooms → $60/room, 3+ → $50/room.
 */
export function getCarpetShampooRatePerRoom(rooms: number): number | null {
  if (rooms <= 0) return null
  if (rooms === 1) return 70
  if (rooms === 2) return 60
  return 50
}

export function getExtraCleanerAmount(type: string): number | null {
  const key = type as keyof typeof EXTRA_CLEANER_BY_TYPE
  return EXTRA_CLEANER_BY_TYPE[key] ?? null
}

export function getAppliancesInsidePrice(type: string): number | null {
  return type === 'STANDARD' ? APPLIANCES_INSIDE_PRICE : null
}

export function getCarpetShampooPrice(
  _size: string,
  rooms: number
): { ratePerRoom: number; total: number } | null {
  if (rooms <= 0) return null
  const ratePerRoom = getCarpetShampooRatePerRoom(rooms)
  if (ratePerRoom === null) return null
  return { ratePerRoom, total: rooms * ratePerRoom }
}

/**
 * Baseboards add-on: $30 up to 2500 sqft (inclusive), $40 above.
 * Size ranges use the upper bound via parseSqft(getSizeRange(size)).
 */
export function getBaseboardsPrice(size: string, _type: string): number {
  const sqft = parseSqft(getSizeRange(size))
  if (sqft === null) return 30
  return sqft <= 2500 ? 30 : 40
}

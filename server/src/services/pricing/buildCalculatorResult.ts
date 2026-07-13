import {
  getBaseboardsPrice,
  getCarpetShampooPrice,
  getExtraCleanerAmount,
} from '../../data/addonPricing'
import type { PricingResult } from '../../data/teamSizeData'

export function buildCalculatorResult(
  base: PricingResult,
  size: string,
  type: string,
  carpetShampooRooms?: number
): PricingResult {
  const extraCleanerAmount = getExtraCleanerAmount(type)
  const baseboardsPrice = getBaseboardsPrice(size, type)
  const carpetShampoo =
    carpetShampooRooms != null && carpetShampooRooms > 0
      ? (() => {
          const pricing = getCarpetShampooPrice(size, carpetShampooRooms)
          return pricing
            ? { rooms: carpetShampooRooms, ...pricing }
            : null
        })()
      : null

  return {
    ...base,
    size,
    extraCleanerAmount,
    baseboardsPrice,
    carpetShampoo,
  }
}

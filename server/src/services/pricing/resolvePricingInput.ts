import { resolveSizeFromBedBath } from '../../data/bedBathSizeMap'
import { getPricing, getSizeRange } from '../../data/teamSizeData'
import type { PricingResult } from '../../data/teamSizeData'
import { buildCalculatorResult } from './buildCalculatorResult'

export type PricingSearchInput =
  | { mode: 'sizeType'; size: string; type: string; carpetShampooRooms?: number }
  | {
      mode: 'bedBath'
      bedrooms: number
      bathrooms: number
      type: string
      carpetShampooRooms?: number
    }

export function resolvePricingInput(input: PricingSearchInput): PricingResult {
  switch (input.mode) {
    case 'sizeType': {
      const size = getSizeRange(input.size)
      const base = getPricing(input.size, input.type)
      return buildCalculatorResult(
        base,
        size,
        input.type,
        input.carpetShampooRooms
      )
    }
    case 'bedBath': {
      const size = resolveSizeFromBedBath(input.bedrooms, input.bathrooms)
      if (!size) {
        throw new Error(
          `No size mapping for ${input.bedrooms} bedroom(s) and ${input.bathrooms} bathroom(s)`
        )
      }
      const base = getPricing(size, input.type)
      return buildCalculatorResult(
        base,
        size,
        input.type,
        input.carpetShampooRooms
      )
    }
    default: {
      const _exhaustive: never = input
      throw new Error(`Unknown pricing search mode: ${(_exhaustive as PricingSearchInput).mode}`)
    }
  }
}

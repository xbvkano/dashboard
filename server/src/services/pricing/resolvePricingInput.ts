import { getPricing } from '../../data/teamSizeData'
import type { PricingResult } from '../../data/teamSizeData'

export type PricingSearchInput =
  | { mode: 'sizeType'; size: string; type: string }
  | { mode: 'bedBath'; bedrooms: number; bathrooms: number; type: string }

export function resolvePricingInput(input: PricingSearchInput): PricingResult {
  switch (input.mode) {
    case 'sizeType':
      return getPricing(input.size, input.type)
    case 'bedBath':
      throw new Error('Bed/bath pricing lookup is not implemented yet')
    default: {
      const _exhaustive: never = input
      throw new Error(`Unknown pricing search mode: ${(_exhaustive as PricingSearchInput).mode}`)
    }
  }
}

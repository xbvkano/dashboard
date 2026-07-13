import type { ComponentType } from 'react'
import SizeTypeSearch, { type SizeTypeSearchValues } from './SizeTypeSearch'
import BedBathSearch, { type BedBathSearchValues } from './BedBathSearch'

export type { SizeTypeSearchValues, BedBathSearchValues }

export type SearchModeId = 'sizeType' | 'bedBath'

export type CalculatorSearchValues = SizeTypeSearchValues | BedBathSearchValues

export interface SearchModeConfig {
  id: SearchModeId
  label: string
  enabled: boolean
  component: ComponentType<{
    values: CalculatorSearchValues
    onChange: (values: CalculatorSearchValues) => void
  }>
}

export const searchModes: SearchModeConfig[] = [
  {
    id: 'sizeType',
    label: 'By Size & Type',
    enabled: true,
    component: SizeTypeSearch as SearchModeConfig['component'],
  },
  {
    id: 'bedBath',
    label: 'By Bedrooms & Bathrooms',
    enabled: true,
    component: BedBathSearch as SearchModeConfig['component'],
  },
]

export const defaultSizeTypeValues: SizeTypeSearchValues = {
  size: '',
  type: '',
}

export const defaultBedBathValues: BedBathSearchValues = {
  bedrooms: '',
  bathrooms: '',
  type: '',
}

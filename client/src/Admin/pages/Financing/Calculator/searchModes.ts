import type { ComponentType } from 'react'
import SizeTypeSearch, { type SizeTypeSearchValues } from './SizeTypeSearch'

export type { SizeTypeSearchValues }

export type SearchModeId = 'sizeType' | 'bedBath'

export interface SearchModeConfig {
  id: SearchModeId
  label: string
  enabled: boolean
  component: ComponentType<{
    values: SizeTypeSearchValues
    onChange: (values: SizeTypeSearchValues) => void
  }>
}

export const searchModes: SearchModeConfig[] = [
  {
    id: 'sizeType',
    label: 'By Size & Type',
    enabled: true,
    component: SizeTypeSearch,
  },
  // Future: bed/bath mode
  // { id: 'bedBath', label: 'By Bedrooms & Bathrooms', enabled: false, component: BedBathSearch },
]

export const defaultSizeTypeValues: SizeTypeSearchValues = {
  size: '',
  type: '',
}

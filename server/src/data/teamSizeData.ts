import { parseSqft } from '../utils/appointmentUtils'

/**
 * Team size by property size range and service type.
 * Used for templates, AI appointments, and default team sizing.
 */
export interface TeamSizeRow {
  size: string
  service: string
  teamSize: number
}

export const teamSizeData: TeamSizeRow[] = [
  { size: '0-1000', service: 'Standard', teamSize: 1 },
  { size: '0-1000', service: 'Deep', teamSize: 1 },
  { size: '0-1000', service: 'Move', teamSize: 1 },
  { size: '1000-1500', service: 'Standard', teamSize: 1 },
  { size: '1000-1500', service: 'Deep', teamSize: 1 },
  { size: '1000-1500', service: 'Move', teamSize: 1 },
  { size: '1500-2000', service: 'Standard', teamSize: 1 },
  { size: '1500-2000', service: 'Deep', teamSize: 1 },
  { size: '1500-2000', service: 'Move', teamSize: 1 },
  { size: '2000-2500', service: 'Standard', teamSize: 1 },
  { size: '2000-2500', service: 'Deep', teamSize: 2 },
  { size: '2000-2500', service: 'Move', teamSize: 2 },
  { size: '2500-3000', service: 'Standard', teamSize: 1 },
  { size: '2500-3000', service: 'Deep', teamSize: 2 },
  { size: '2500-3000', service: 'Move', teamSize: 2 },
  { size: '3000-3500', service: 'Standard', teamSize: 2 },
  { size: '3000-3500', service: 'Deep', teamSize: 2 },
  { size: '3000-3500', service: 'Move', teamSize: 2 },
  { size: '3500-4000', service: 'Standard', teamSize: 2 },
  { size: '3500-4000', service: 'Deep', teamSize: 2 },
  { size: '3500-4000', service: 'Move', teamSize: 2 },
  { size: '4000-4500', service: 'Standard', teamSize: 2 },
  { size: '4000-4500', service: 'Deep', teamSize: 2 },
  { size: '4000-4500', service: 'Move', teamSize: 2 },
  { size: '4500-5000', service: 'Standard', teamSize: 2 },
  { size: '4500-5000', service: 'Deep', teamSize: 2 },
  { size: '4500-5000', service: 'Move', teamSize: 2 },
  { size: '5000-5500', service: 'Standard', teamSize: 2 },
  { size: '5000-5500', service: 'Deep', teamSize: 2 },
  { size: '5000-5500', service: 'Move', teamSize: 2 },
  { size: '5500-6000', service: 'Standard', teamSize: 2 },
  { size: '5500-6000', service: 'Deep', teamSize: 2 },
  { size: '5500-6000', service: 'Move', teamSize: 2 },
  { size: '6000+', service: 'Standard', teamSize: 2 },
  { size: '6000+', service: 'Deep', teamSize: 2 },
  { size: '6000+', service: 'Move', teamSize: 2 },
]

const serviceMap: Record<string, string> = {
  STANDARD: 'Standard',
  DEEP: 'Deep',
  MOVE_IN_OUT: 'Move',
}

export function getDefaultTeamSize(size: string, type: string): number {
  const sizeRange = getSizeRange(size)
  const service = serviceMap[type] || type
  const row = teamSizeData.find(
    (r) => r.size === sizeRange && r.service === service
  )
  return row?.teamSize ?? 1
}

export function getSizeRange(size: string): string {
  if (size.includes('-')) return size
  const sqft = parseSqft(size)
  if (sqft === null) return size
  if (sqft <= 1000) return '0-1000'
  if (sqft <= 1500) return '1000-1500'
  if (sqft <= 2000) return '1500-2000'
  if (sqft <= 2500) return '2000-2500'
  if (sqft <= 3000) return '2500-3000'
  if (sqft <= 3500) return '3000-3500'
  if (sqft <= 4000) return '3500-4000'
  if (sqft <= 4500) return '4000-4500'
  if (sqft <= 5000) return '4500-5000'
  if (sqft <= 5500) return '5000-5500'
  if (sqft <= 6000) return '5500-6000'
  return '6000+'
}

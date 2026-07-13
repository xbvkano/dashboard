import { parseSqft } from '../utils/appointmentUtils'

/**
 * Team size and default price by property size range and service type.
 * Used for templates, AI appointments, and default team sizing / pricing.
 */
export interface TeamSizeRow {
  size: string
  service: string
  teamSize: number
  price: number
  requiresReview?: boolean
}

export interface PricingResult {
  teamSize: number | null
  price: number | null
  requiresReview: boolean
  message?: string
  size?: string
  extraCleanerAmount?: number | null
  baseboardsPrice?: number | null
  carpetShampoo?: { rooms: number; ratePerRoom: number; total: number } | null
}

export const teamSizeData: TeamSizeRow[] = [
  { size: '0-1000', service: 'Standard', teamSize: 1, price: 210 },
  { size: '0-1000', service: 'Deep', teamSize: 1, price: 260 },
  { size: '0-1000', service: 'Move', teamSize: 1, price: 260 },
  { size: '1000-1500', service: 'Standard', teamSize: 1, price: 240 },
  { size: '1000-1500', service: 'Deep', teamSize: 1, price: 295 },
  { size: '1000-1500', service: 'Move', teamSize: 1, price: 295 },
  { size: '1500-2000', service: 'Standard', teamSize: 1, price: 260 },
  { size: '1500-2000', service: 'Deep', teamSize: 1, price: 340 },
  { size: '1500-2000', service: 'Move', teamSize: 1, price: 340 },
  { size: '2000-2500', service: 'Standard', teamSize: 1, price: 295 },
  { size: '2000-2500', service: 'Deep', teamSize: 2, price: 410 },
  { size: '2000-2500', service: 'Move', teamSize: 2, price: 410 },
  { size: '2500-3000', service: 'Standard', teamSize: 2, price: 340 },
  { size: '2500-3000', service: 'Deep', teamSize: 2, price: 445 },
  { size: '2500-3000', service: 'Move', teamSize: 2, price: 445 },
  { size: '3000-3500', service: 'Standard', teamSize: 2, price: 380 },
  { size: '3000-3500', service: 'Deep', teamSize: 2, price: 480 },
  { size: '3000-3500', service: 'Move', teamSize: 2, price: 480 },
  { size: '3500-4000', service: 'Standard', teamSize: 2, price: 420 },
  { size: '3500-4000', service: 'Deep', teamSize: 2, price: 520 },
  { size: '3500-4000', service: 'Move', teamSize: 2, price: 520 },
  { size: '4000-4500', service: 'Standard', teamSize: 2, price: 445 },
  { size: '4000-4500', service: 'Deep', teamSize: 2, price: 545 },
  { size: '4000-4500', service: 'Move', teamSize: 2, price: 545 },
  { size: '4500-5000', service: 'Standard', teamSize: 2, price: 495 },
  { size: '4500-5000', service: 'Deep', teamSize: 2, price: 620 },
  { size: '4500-5000', service: 'Move', teamSize: 2, price: 620 },
  { size: '5000-5500', service: 'Standard', teamSize: 2, price: 530 },
  { size: '5000-5500', service: 'Deep', teamSize: 3, price: 660 },
  { size: '5000-5500', service: 'Move', teamSize: 3, price: 660 },
  { size: '5500-6000', service: 'Standard', teamSize: 2, price: 580 },
  { size: '5500-6000', service: 'Deep', teamSize: 3, price: 695 },
  { size: '5500-6000', service: 'Move', teamSize: 3, price: 695 },
  { size: '6000+', service: 'Standard', teamSize: 0, price: 0, requiresReview: true },
  { size: '6000+', service: 'Deep', teamSize: 0, price: 0, requiresReview: true },
  { size: '6000+', service: 'Move', teamSize: 0, price: 0, requiresReview: true },
]

const serviceMap: Record<string, string> = {
  STANDARD: 'Standard',
  DEEP: 'Deep',
  MOVE_IN_OUT: 'Move',
}

const SUPERVISOR_REVIEW_MESSAGE = 'Price requires supervisor review'

export function getPricing(size: string, type: string): PricingResult {
  const row = findRow(size, type)
  if (!row) {
    return { teamSize: null, price: null, requiresReview: false }
  }
  if (row.requiresReview) {
    return {
      teamSize: null,
      price: null,
      requiresReview: true,
      message: SUPERVISOR_REVIEW_MESSAGE,
    }
  }
  return {
    teamSize: row.teamSize,
    price: row.price,
    requiresReview: false,
  }
}

export function getDefaultTeamSize(size: string, type: string): number {
  const result = getPricing(size, type)
  return result.teamSize ?? 1
}

export function getDefaultPrice(size: string, type: string): number {
  const result = getPricing(size, type)
  return result.price ?? 0
}

function findRow(size: string, type: string): TeamSizeRow | undefined {
  const sizeRange = getSizeRange(size)
  const service = serviceMap[type] || type
  return teamSizeData.find(
    (r) => r.size === sizeRange && r.service === service
  )
}

export function getSizeRange(size: string): string {
  if (size.includes('-') || size.endsWith('+')) return size
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

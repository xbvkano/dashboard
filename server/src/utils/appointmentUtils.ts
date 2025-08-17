/**
 * Parse square footage from size string
 */
export function parseSqft(s: string | null | undefined): number | null {
  if (!s) return null
  const parts = s.split('-')
  let n = parseInt(parts[1] || parts[0])
  if (isNaN(n)) n = parseInt(s)
  return isNaN(n) ? null : n
}

/**
 * Calculate appointment hours based on size and service type
 */
export function calculateAppointmentHours(size: string | null, serviceType: string): number {
  const sqft = parseSqft(size)
  if (sqft === null) return 3 // Default hours if size cannot be parsed
  
  // Base hours calculation based on square footage
  let baseHours = 3 // Minimum hours
  
  if (sqft <= 1500) {
    baseHours = 3
  } else if (sqft <= 2000) {
    baseHours = 4
  } else if (sqft <= 2500) {
    baseHours = 5
  } else if (sqft <= 3000) {
    baseHours = 6
  } else if (sqft <= 3500) {
    baseHours = 7
  } else if (sqft <= 4000) {
    baseHours = 8
  } else {
    baseHours = 9 // For 4000+ sqft
  }
  
  // Adjust hours based on service type
  switch (serviceType) {
    case 'DEEP':
      return baseHours + 1 // Deep cleaning takes longer
    case 'MOVE_IN_OUT':
      return baseHours + 2 // Move in/out cleaning takes even longer
    case 'STANDARD':
    default:
      return baseHours
  }
}

/**
 * Calculate pay rate based on type, size, and employee count
 */
export function calculatePayRate(type: string, size: string | null, count: number): number {
  const sqft = size ? parseSqft(size) : null
  const isLarge = sqft != null && sqft > 2500
  if (type === 'STANDARD') return isLarge ? 100 : 80
  if (type === 'DEEP' || type === 'MOVE_IN_OUT') {
    if (isLarge) return 100
    return count === 1 ? 100 : 90
  }
  return 0
}

/**
 * Calculate carpet rate based on size and number of rooms
 */
export function calculateCarpetRate(size: string, rooms: number): number {
  const sqft = parseSqft(size)
  if (sqft === null) return 0
  const isLarge = sqft > 2500
  if (rooms === 1) return isLarge ? 20 : 10
  if (rooms <= 3) return isLarge ? 30 : 20
  if (rooms <= 5) return isLarge ? 40 : 30
  if (rooms <= 8) return isLarge ? 60 : 40
  return (isLarge ? 60 : 40) + 10 * (rooms - 8)
}

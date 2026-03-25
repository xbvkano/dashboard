/**
 * Website schema type definitions (external reference)
 * Mirrors the Prisma schema from the website project.
 */

// --- Enums ---

export type CouponType = 'percent' | 'flat' | 'item'

// --- Models ---

export interface Coupon {
  id: string
  name: string
  type: CouponType
  value: string
  expireDate: Date | string
  useCount: number
}

export interface FormData {
  id: number
  name: string
  number: string
  address: string
  size: string
  date: string
  service: string
  baseboards: boolean
  fridgeInside: boolean
  ovenInside: boolean
  done: boolean
  price: number
  carpetShampooRooms: number
  blacklist: boolean
  source: string
  otherSource: string | null
  dateCreated: Date
  visited?: boolean
  /** Set when a valid coupon was applied at submit time */
  couponId?: string | null
  /** Nested coupon from GET /api/quotes (null if no coupon) */
  coupon?: Coupon | null
}

export interface Call {
  id: number
  createdAt: Date
  caller: string
  called: string
  size: string
  service: string
  section: string
  price: number | null
  visited?: boolean
}

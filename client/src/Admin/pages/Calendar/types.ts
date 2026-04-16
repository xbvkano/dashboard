export interface AppointmentTemplate {
  id?: number
  templateName: string
  type: 'STANDARD' | 'DEEP' | 'MOVE_IN_OUT'
  size: string
  teamSize?: number
  address: string
  price: number
  clientId: number
  cityStateZip?: string
  notes?: string
  instructions?: string
  carpetEnabled?: boolean
  carpetRooms?: number
  carpetPrice?: number
}

/** Business IANA zone (must stay aligned with server DEFAULT_APPOINTMENT_TIMEZONE). */
export const APPOINTMENT_BUSINESS_TIME_ZONE = 'America/Los_Angeles'

/** Today’s calendar date YYYY-MM-DD in the business timezone. */
export function businessTodayLocalDateString(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: APPOINTMENT_BUSINESS_TIME_ZONE })
}

/**
 * Stable YYYY-MM-DD for routing, sorting, and display. Prefer API `localDate`; fallback to legacy `date`/`dateUtc`.
 */
export function appointmentCalendarDateKey(a: {
  localDate?: string | null
  date?: string | Date
  dateUtc?: string | Date | null
}): string {
  if (a.localDate) return a.localDate
  const d = a.date
  if (typeof d === 'string') return d.slice(0, 10)
  if (d instanceof Date) return d.toISOString().slice(0, 10)
  if (a.dateUtc != null) {
    const u = a.dateUtc
    return (typeof u === 'string' ? u : u.toISOString()).slice(0, 10)
  }
  return ''
}

export interface Appointment {
  id?: number
  date: string
  /** YYYY-MM-DD in business timezone (server-computed). Prefer over slicing `date`. */
  localDate?: string
  /** UTC calendar day (ISO), optional until backfilled on older rows */
  dateUtc?: string | null
  time: string
  clientId: number
  type: 'STANDARD' | 'DEEP' | 'MOVE_IN_OUT'
  address: string
  cityStateZip?: string
  size?: string
  price?: number
  notes?: string
  payrollNote?: string | null
  hours?: number
  paid?: boolean
  paymentMethod?: 'CASH' | 'ZELLE' | 'VENMO' | 'PAYPAL' | 'OTHER' | 'CHECK'
  tip?: number
  noTeam?: boolean
  carpetRooms?: number
  carpetPrice?: number
  adminId?: number
  reoccurring?: boolean
  reocuringDate?: string
  recurringDone?: boolean
  observe?: boolean
  observation?: string
  infoSent?: boolean
  status?:
    | 'APPOINTED'
    | 'RESCHEDULE_NEW'
    | 'RESCHEDULE_OLD'
    | 'CANCEL'
    | 'REBOOK'
    | 'REOCCURRING'
    | 'RECURRING_UNCONFIRMED'
    | 'DELETED'
  familyId?: number
  templateId?: number
  teamSize?: number
  client?: import('../Clients/components/types').Client
  employees?: import('../Employees/components/types').Employee[]
  admin?: { id: number; name: string | null; email: string }
  createdAt?: string
  payrollItems?: {
    employeeId: number
    amount?: number
    extras: { id: number; name: string; amount: number }[]
  }[]
  /** Public Supabase URLs for screenshots used when booking from messaging */
  bookingScreenshotUrls?: string[]
}

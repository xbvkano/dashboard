export interface AppointmentTemplate {
  id?: number
  templateName: string
  type: 'STANDARD' | 'DEEP' | 'MOVE_IN_OUT'
  size: string
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

export interface Appointment {
  id?: number
  date: string
  time: string
  clientId: number
  type: 'STANDARD' | 'DEEP' | 'MOVE_IN_OUT'
  address: string
  cityStateZip?: string
  size?: string
  price?: number
  notes?: string
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
  client?: import('../Clients/components/types').Client
  employees?: import('../Employees/components/types').Employee[]
  admin?: { id: number; name: string | null; email: string }
  createdAt?: string
  payrollItems?: {
    employeeId: number
    extras: { id: number; name: string; amount: number }[]
  }[]
}

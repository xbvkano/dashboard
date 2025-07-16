export interface AppointmentTemplate {
  id?: number
  templateName: string
  type: 'STANDARD' | 'DEEP' | 'MOVE_IN_OUT'
  size?: string
  address: string
  price: number
  clientId: number
  cityStateZip?: string // used for notes
}

export interface Appointment {
  id?: number
  date: string
  time: string
  clientId: number
  type: 'STANDARD' | 'DEEP' | 'MOVE_IN_OUT'
  address: string
  size?: string
  price?: number
  notes?: string
  hours?: number
  paid?: boolean
  paymentMethod?: 'CASH' | 'ZELLE' | 'VENMO' | 'PAYPAL' | 'OTHER' | 'CHECK'
  tip?: number
  createdAt?: string
}

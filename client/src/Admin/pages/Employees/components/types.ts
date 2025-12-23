export interface Employee {
  id?: number
  name: string
  number: string
  notes?: string
  experienced?: boolean
  disabled?: boolean
  password?: string
  hasPassword?: boolean
  userType?: 'Google' | 'password'
}

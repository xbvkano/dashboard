export interface Employee {
  id?: number
  name: string
  number: string
  notes?: string
  disabled?: boolean
  password?: string
  hasPassword?: boolean
  userType?: 'Google' | 'password'
}

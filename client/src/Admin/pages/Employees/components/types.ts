export interface Employee {
  id?: number
  name: string
  number: string
  notes?: string
  disabled?: boolean
  password?: string
  hasPassword?: boolean
  userType?: 'Google' | 'password'
  supervisorId?: number | null
  supervisor?: { id: number; name: string | null } | null
}

export interface SupervisorOption {
  id: number
  name: string | null
  userName: string | null
  role: string
}

export const SIZE_OPTIONS = [
  '0-1000',
  '1000-1500',
  '1500-2000',
  '2000-2500',
  '2500-3000',
  '3000-3500',
  '3500-4000',
  '4000-4500',
  '4500-5000',
  '5000-5500',
  '5500-6000',
  '6000+',
] as const

export type SizeOption = (typeof SIZE_OPTIONS)[number]

export const APPOINTMENT_TYPE_OPTIONS = [
  { value: 'STANDARD', label: 'Standard' },
  { value: 'DEEP', label: 'Deep' },
  { value: 'MOVE_IN_OUT', label: 'Move-in/out' },
] as const

export type AppointmentTypeOption = (typeof APPOINTMENT_TYPE_OPTIONS)[number]['value']

export const SERVICE_STATUS_BUBBLE_COLOR = '#7C3AED'

export const SERVICE_STATUS_KINDS = ['ON_THE_WAY', 'ARRIVED', 'THIRTY_MINUTES_LEFT'] as const

export type ServiceStatusKind = (typeof SERVICE_STATUS_KINDS)[number]

export const SERVICE_STATUS_SMS_BODIES: Partial<Record<ServiceStatusKind, string>> = {
  ON_THE_WAY:
    'Hi! This is Evidence Cleaning — your cleaning team is on the way to your appointment.',
  THIRTY_MINUTES_LEFT:
    'Hi! This is Evidence Cleaning — there are about 30 minutes left on your cleaning.',
}

export function isServiceStatusKind(value: string): value is ServiceStatusKind {
  return (SERVICE_STATUS_KINDS as readonly string[]).includes(value)
}

export const SERVICE_STATUS_BUBBLE_COLOR = '#7C3AED'

export const SERVICE_STATUS_KINDS = ['ON_THE_WAY', 'ARRIVED', 'THIRTY_MINUTES_LEFT'] as const

export type ServiceStatusKind = (typeof SERVICE_STATUS_KINDS)[number]

export const SERVICE_STATUS_SMS_BODIES: Partial<Record<ServiceStatusKind, string>> = {
  ON_THE_WAY:
    'Hi! This is Evidence Cleaning. Your cleaning team is on the way to your appointment.',
  THIRTY_MINUTES_LEFT:
    'The cleaning team just informed us that they will be done with the cleaning in about 30 minutes. Please let me know if they did a good job 😊. If you’d like to schedule your next cleaning now, just let me know! Due to high demand, this helps us secure the best date and time for you.',
}

export function isServiceStatusKind(value: string): value is ServiceStatusKind {
  return (SERVICE_STATUS_KINDS as readonly string[]).includes(value)
}

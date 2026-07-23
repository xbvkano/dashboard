import { SERVICE_STATUS_BUBBLE_COLOR } from '../constants/serviceStatus'

const HEX6 = /^#[0-9A-Fa-f]{6}$/

/** Prefer message-level override (e.g. service-status purple) over staff user color. */
export function resolveOutboundBubbleColor(input: {
  bubbleColorOverride: string | null | undefined
  staffBubbleColor: string | null | undefined
}): string | null {
  const override = input.bubbleColorOverride?.trim()
  if (override && HEX6.test(override)) return override
  const staff = input.staffBubbleColor?.trim()
  if (staff && HEX6.test(staff)) return staff
  return null
}

export { SERVICE_STATUS_BUBBLE_COLOR }

import type { PushoverInboundPayload } from '../services/pushover'

const PUSHOVER_MESSAGE_MAX = 1024

export const PUSHOVER_FORM_CALL_PRIORITY = 2
export const PUSHOVER_FORM_CALL_MAX_SEND_COUNT = 5
export const PUSHOVER_FORM_CALL_RETRY_SEC = 300
/** floor(expire / retry) deliveries — 1500/300 = 5 (1200/300 = 4 only). */
export const PUSHOVER_FORM_CALL_EXPIRE_SEC =
  PUSHOVER_FORM_CALL_RETRY_SEC * PUSHOVER_FORM_CALL_MAX_SEND_COUNT

/** Pushover emergency-priority delivery count from retry/expire (see pushover.net/api). */
export function pushoverEmergencyDeliveryCount(retrySec: number, expireSec: number): number {
  if (retrySec <= 0) return 1
  return Math.floor(expireSec / retrySec)
}
export const PUSHOVER_FORM_CALL_SOUND = 'cashregister'
export const PUSHOVER_SMS_SOUND = 'magic'

export type PushoverTestType = 'INBOUND_SMS' | 'WEBSITE_FORM' | 'INBOUND_CALL'

export const PUSHOVER_TEST_TYPES: PushoverTestType[] = [
  'INBOUND_SMS',
  'WEBSITE_FORM',
  'INBOUND_CALL',
]

function joinParts(parts: Array<string | null | undefined>): string {
  return parts
    .map((p) => (p != null ? String(p).trim() : ''))
    .filter((p) => p.length > 0)
    .join(' · ')
}

export function formatQuotePushoverBody(input: {
  name: string
  number: string
  sizeLabel: string
  serviceLabelStr: string
  price: number
  couponName?: string | null
}): string {
  const parts = [input.name, input.number, input.sizeLabel, input.serviceLabelStr, `$${input.price}`]
  let body = joinParts(parts)
  if (input.couponName?.trim()) {
    body += ` · coupon ${input.couponName.trim()}`
  }
  return body.slice(0, PUSHOVER_MESSAGE_MAX)
}

export function formatCallPushoverBody(input: {
  caller: string
  service: string
  size: string
  section: string
}): string {
  return joinParts([input.caller, input.service, input.size, input.section]).slice(
    0,
    PUSHOVER_MESSAGE_MAX,
  )
}

export function buildInboundSmsPushoverPayload(input: {
  senderLabel: string
  body: string
  mediaCount: number
  receivedAt: Date
}): PushoverInboundPayload {
  const title = input.senderLabel.slice(0, 250)
  const basePreview =
    input.body.trim().slice(0, 400) || (input.mediaCount > 0 ? '📷 Photo' : '(empty)')
  const when = input.receivedAt.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
  const suffix = `\n\n${when}`
  const maxPreviewLen = Math.max(0, 1024 - suffix.length)
  const preview = basePreview.slice(0, maxPreviewLen)
  const message = `${preview}${suffix}`.slice(0, 1024)
  return {
    title,
    message,
    priority: 1,
    sound: PUSHOVER_SMS_SOUND,
  }
}

export type PushoverTestSample = {
  type: PushoverTestType
  label: string
  description: string
  payload: PushoverInboundPayload
}

const SAMPLE_RECEIVED_AT = new Date('2026-07-07T15:30:00.000Z')

export function buildPushoverTestSample(type: PushoverTestType): PushoverTestSample {
  switch (type) {
    case 'INBOUND_SMS':
      return {
        type,
        label: 'Inbound SMS',
        description: 'CRM inbox message (priority 1, magic sound, no repeat)',
        payload: buildInboundSmsPushoverPayload({
          senderLabel: 'Jane Customer',
          body: 'Hi — can I get a quote for carpet cleaning this week?',
          mediaCount: 0,
          receivedAt: SAMPLE_RECEIVED_AT,
        }),
      }
    case 'WEBSITE_FORM':
      return {
        type,
        label: 'Website quote',
        description: 'Evidence form submission (priority 2, repeats up to 5× every 5 min)',
        payload: {
          title: 'New quote',
          message: formatQuotePushoverBody({
            name: 'Maria Garcia',
            number: '(702) 555-1234',
            sizeLabel: '0 - 1000sqft',
            serviceLabelStr: 'Standard Cleaning',
            price: 195,
          }),
          priority: PUSHOVER_FORM_CALL_PRIORITY,
          sound: PUSHOVER_FORM_CALL_SOUND,
          retry: PUSHOVER_FORM_CALL_RETRY_SEC,
          expire: PUSHOVER_FORM_CALL_EXPIRE_SEC,
        },
      }
    case 'INBOUND_CALL':
      return {
        type,
        label: 'Inbound call',
        description: 'IVR call via evidence (priority 2, repeats up to 5× every 5 min)',
        payload: {
          title: 'Inbound call',
          message: formatCallPushoverBody({
            caller: '(702) 555-0142',
            service: 'Move in/out',
            size: '1501 - 2000sqft',
            section: 'schedule IVR',
          }),
          priority: PUSHOVER_FORM_CALL_PRIORITY,
          sound: PUSHOVER_FORM_CALL_SOUND,
          retry: PUSHOVER_FORM_CALL_RETRY_SEC,
          expire: PUSHOVER_FORM_CALL_EXPIRE_SEC,
        },
      }
  }
}

export function listPushoverTestSamples(): PushoverTestSample[] {
  return PUSHOVER_TEST_TYPES.map(buildPushoverTestSample)
}

export function isPushoverTestType(value: string): value is PushoverTestType {
  return (PUSHOVER_TEST_TYPES as string[]).includes(value)
}

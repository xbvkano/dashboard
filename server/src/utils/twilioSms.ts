/**
 * Outbound Twilio SMS: prefer Messaging Service (A2P) when TWILIO_MESSAGING_SERVICE_SID
 * is set; otherwise use TWILIO_FROM_NUMBER as `from`.
 */
export const TWILIO_OUTBOUND_NOT_CONFIGURED =
  'Twilio outbound not configured: set TWILIO_MESSAGING_SERVICE_SID and/or TWILIO_FROM_NUMBER'

export function isTwilioOutboundConfigured(): boolean {
  const mg = process.env.TWILIO_MESSAGING_SERVICE_SID?.trim()
  const from = process.env.TWILIO_FROM_NUMBER?.trim()
  return Boolean(mg || from)
}

/** Account SID + Auth Token + at least one outbound address (Messaging Service or From). */
export function isTwilioClientConfigured(): boolean {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim()
  const token = process.env.TWILIO_AUTH_TOKEN?.trim()
  return Boolean(sid && token && isTwilioOutboundConfigured())
}

export type TwilioMessageCreateParams =
  | { to: string; body: string; messagingServiceSid: string }
  | { to: string; body: string; from: string }

/**
 * Build params for `twilioClient.messages.create(...)`.
 * Prefers Messaging Service SID when set (typical for US A2P).
 */
export function twilioMessageCreateParams(to: string, body: string): TwilioMessageCreateParams {
  const mg = process.env.TWILIO_MESSAGING_SERVICE_SID?.trim()
  if (mg) {
    return { to, body, messagingServiceSid: mg }
  }
  const from = process.env.TWILIO_FROM_NUMBER?.trim()
  if (!from) {
    throw new Error(TWILIO_OUTBOUND_NOT_CONFIGURED)
  }
  return { to, body, from }
}

/**
 * SMS/MMS outbound. Twilio accepts body + optional `mediaUrl` (HTTPS, publicly fetchable by Twilio).
 * When `mediaUrl` is present, **Body is optional** — use an empty string for image-only so the contact
 * does not get a separate blank/space “text” alongside the picture.
 */
export function twilioMmsMessageCreateParams(
  to: string,
  body: string,
  mediaUrls: string[],
): TwilioMessageCreateParams & { mediaUrl?: string[] } {
  const urls = mediaUrls.filter(Boolean).slice(0, 10)
  const trimmed = body.trim()
  const textBody = trimmed.length > 0 ? body : urls.length > 0 ? '' : body
  const base = twilioMessageCreateParams(to, textBody)
  if (urls.length === 0) return base
  return { ...base, mediaUrl: urls }
}

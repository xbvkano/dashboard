/**
 * Outbound Twilio SMS helpers.
 *
 * Jobs / scripts without a conversation line still prefer Messaging Service (A2P)
 * when TWILIO_MESSAGING_SERVICE_SID is set.
 * CRM inbox outbound always passes forceFrom + fromE164 (conversation.businessNumber)
 * so client and employee lines never get mixed via a shared sender pool.
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

export type TwilioOutboundOptions = {
  /**
   * Explicit Twilio `from` number (conversation business line).
   * With `forceFrom`, skips Messaging Service so client vs employee lines stay separate.
   */
  fromE164?: string
  /**
   * When true with `fromE164`, always use `from` (never Messaging Service).
   * Required for CRM inbox sends (both client TWILIO_FROM_NUMBER and employee
   * TWILIO_ADMIN_FROM_NUMBER) so a shared Messaging Service pool cannot pick the wrong sender.
   */
  forceFrom?: boolean
}

/**
 * Build params for `twilioClient.messages.create(...)`.
 * Prefers Messaging Service SID when set (typical for US A2P jobs), unless `forceFrom` + `fromE164`.
 */
export function twilioMessageCreateParams(
  to: string,
  body: string,
  options?: TwilioOutboundOptions,
): TwilioMessageCreateParams {
  const forcedFrom = options?.fromE164?.trim()
  if (forcedFrom && options?.forceFrom) {
    return { to, body, from: forcedFrom }
  }

  const mg = process.env.TWILIO_MESSAGING_SERVICE_SID?.trim()
  if (mg) {
    return { to, body, messagingServiceSid: mg }
  }
  const from = forcedFrom || process.env.TWILIO_FROM_NUMBER?.trim()
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
  options?: TwilioOutboundOptions,
): TwilioMessageCreateParams & { mediaUrl?: string[] } {
  const urls = mediaUrls.filter(Boolean).slice(0, 10)
  const trimmed = body.trim()
  const textBody = trimmed.length > 0 ? body : urls.length > 0 ? '' : body
  const base = twilioMessageCreateParams(to, textBody, options)
  if (urls.length === 0) return base
  return { ...base, mediaUrl: urls }
}

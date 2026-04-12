/**
 * Subset of Twilio webhook fields used for persistence. Extend when wiring real webhooks.
 */
export interface TwilioInboundSmsPayload {
  MessageSid?: string
  AccountSid?: string
  MessagingServiceSid?: string
  From?: string
  To?: string
  Body?: string
  NumMedia?: string
  NumSegments?: string
  SmsStatus?: string
  SmsMessageSid?: string
  /** ISO or RFC2822 from Twilio; optional */
  DateSent?: string
  [key: string]: unknown
}

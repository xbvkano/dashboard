export { SESSION_INACTIVITY_MS } from './constants'
export { ensureOpenSession } from './sessionLifecycle'
export {
  findOrCreateContactPoint,
  findOrCreateConversation,
  ingestInboundSms,
  linkContactPointToClient,
  sendOutboundSms,
} from './messagingService'
export { generateMockAppointmentExtraction } from './appointmentExtractionMock'
export type { TwilioInboundSmsPayload } from './twilioTypes'
export type { SmsTransport, SmsSendInput, SmsSendResult } from './smsTransport'
export { MockSmsTransport, TwilioSmsTransport } from './smsTransport'

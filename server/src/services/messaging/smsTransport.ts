import twilio from 'twilio'
import { twilioMessageCreateParams, twilioMmsMessageCreateParams } from '../../utils/twilioSms'

/**
 * Outbound SMS provider boundary. Swap implementation for real Twilio sends.
 */
export interface SmsSendInput {
  toE164: string
  body: string
  /** Public HTTPS URLs for MMS (Twilio fetches at send time) */
  mediaPublicUrls?: string[]
}

export interface SmsSendResult {
  messageSid: string
  status: string
  accountSid?: string
  messagingServiceSid?: string
  raw?: unknown
  /** Distinguish persisted payload shape in messagingService */
  source?: 'mock' | 'twilio'
}

export interface SmsTransport {
  send(input: SmsSendInput): Promise<SmsSendResult>
}

/** Persists-ready mock: no network; returns a synthetic SID. Mirrors Twilio env (MG vs from). */
export class MockSmsTransport implements SmsTransport {
  async send(input: SmsSendInput): Promise<SmsSendResult> {
    const urls = input.mediaPublicUrls?.filter(Boolean) ?? []
    const params =
      urls.length > 0
        ? twilioMmsMessageCreateParams(input.toE164, input.body, urls)
        : twilioMessageCreateParams(input.toE164, input.body)
    console.log(
      '[messaging-mock-sms] not sent to Twilio (mock transport)',
      JSON.stringify({
        to: input.toE164,
        bodyPreview: input.body.length > 400 ? `${input.body.slice(0, 400)}…` : input.body,
        mediaUrls: urls.length ? urls : undefined,
      }),
    )
    const messageSid = `SM_MOCK_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    return {
      messageSid,
      status: 'sent',
      accountSid: process.env.TWILIO_ACCOUNT_SID ?? 'AC_MOCK',
      messagingServiceSid:
        'messagingServiceSid' in params ? params.messagingServiceSid : undefined,
      raw: { mock: true, twilioParams: params },
      source: 'mock',
    }
  }
}

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID || '',
  process.env.TWILIO_AUTH_TOKEN || '',
)

/** Real Twilio REST send (Messaging Service or From per `twilioMessageCreateParams`). */
export class TwilioSmsTransport implements SmsTransport {
  async send(input: SmsSendInput): Promise<SmsSendResult> {
    const urls = input.mediaPublicUrls?.filter(Boolean) ?? []
    const params =
      urls.length > 0
        ? twilioMmsMessageCreateParams(input.toE164, input.body, urls)
        : twilioMessageCreateParams(input.toE164, input.body)
    const result = await twilioClient.messages.create(
      params as Parameters<typeof twilioClient.messages.create>[0],
    )
    return {
      messageSid: result.sid,
      status: result.status ?? 'queued',
      accountSid: result.accountSid,
      messagingServiceSid: (result as { messaging_service_sid?: string }).messaging_service_sid,
      raw: {
        sid: result.sid,
        status: result.status,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
      },
      source: 'twilio',
    }
  }
}

import {
  isTwilioClientConfigured,
  isTwilioOutboundConfigured,
  twilioMessageCreateParams,
  twilioMmsMessageCreateParams,
  TWILIO_OUTBOUND_NOT_CONFIGURED,
} from '../../src/utils/twilioSms'

describe('twilioSms', () => {
  let savedMg: string | undefined
  let savedFrom: string | undefined
  let savedSid: string | undefined
  let savedToken: string | undefined

  beforeEach(() => {
    savedMg = process.env.TWILIO_MESSAGING_SERVICE_SID
    savedFrom = process.env.TWILIO_FROM_NUMBER
    savedSid = process.env.TWILIO_ACCOUNT_SID
    savedToken = process.env.TWILIO_AUTH_TOKEN
  })

  afterEach(() => {
    if (savedMg !== undefined) process.env.TWILIO_MESSAGING_SERVICE_SID = savedMg
    else delete process.env.TWILIO_MESSAGING_SERVICE_SID
    if (savedFrom !== undefined) process.env.TWILIO_FROM_NUMBER = savedFrom
    else delete process.env.TWILIO_FROM_NUMBER
    if (savedSid !== undefined) process.env.TWILIO_ACCOUNT_SID = savedSid
    else delete process.env.TWILIO_ACCOUNT_SID
    if (savedToken !== undefined) process.env.TWILIO_AUTH_TOKEN = savedToken
    else delete process.env.TWILIO_AUTH_TOKEN
  })

  it('prefers Messaging Service when TWILIO_MESSAGING_SERVICE_SID is set', () => {
    delete process.env.TWILIO_FROM_NUMBER
    process.env.TWILIO_MESSAGING_SERVICE_SID = 'MGaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    expect(isTwilioOutboundConfigured()).toBe(true)
    const p = twilioMessageCreateParams('+15551234567', 'hi')
    expect(p).toEqual({
      to: '+15551234567',
      body: 'hi',
      messagingServiceSid: 'MGaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    })
  })

  it('falls back to from when Messaging Service is unset', () => {
    delete process.env.TWILIO_MESSAGING_SERVICE_SID
    process.env.TWILIO_FROM_NUMBER = '+19876543210'
    const p = twilioMessageCreateParams('+15551234567', 'x')
    expect(p).toEqual({
      to: '+15551234567',
      body: 'x',
      from: '+19876543210',
    })
  })

  it('forceFrom uses fromE164 and skips Messaging Service', () => {
    process.env.TWILIO_MESSAGING_SERVICE_SID = 'MGaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    process.env.TWILIO_FROM_NUMBER = '+19876543210'
    const p = twilioMessageCreateParams('+15551234567', 'hi', {
      fromE164: '+15550001111',
      forceFrom: true,
    })
    expect(p).toEqual({
      to: '+15551234567',
      body: 'hi',
      from: '+15550001111',
    })
  })

  it('pinned client business line skips Messaging Service even when MG is set', () => {
    process.env.TWILIO_MESSAGING_SERVICE_SID = 'MGaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    process.env.TWILIO_FROM_NUMBER = '+19876543210'
    const clientLine = '+19876543210'
    const p = twilioMessageCreateParams('+15551234567', 'client hi', {
      fromE164: clientLine,
      forceFrom: true,
    })
    expect(p).toEqual({
      to: '+15551234567',
      body: 'client hi',
      from: clientLine,
    })
    expect(p).not.toHaveProperty('messagingServiceSid')
  })

  it('pinned employee business line skips Messaging Service even when MG is set', () => {
    process.env.TWILIO_MESSAGING_SERVICE_SID = 'MGaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    process.env.TWILIO_FROM_NUMBER = '+19876543210'
    const adminLine = '+15557654321'
    const p = twilioMessageCreateParams('+15551234567', 'employee hi', {
      fromE164: adminLine,
      forceFrom: true,
    })
    expect(p).toEqual({
      to: '+15551234567',
      body: 'employee hi',
      from: adminLine,
    })
    expect(p).not.toHaveProperty('messagingServiceSid')
  })

  it('MMS with forceFrom pins from and skips Messaging Service', () => {
    process.env.TWILIO_MESSAGING_SERVICE_SID = 'MGaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    const p = twilioMmsMessageCreateParams(
      '+15551234567',
      'caption',
      ['https://cdn.example.com/a.jpg'],
      { fromE164: '+19876543210', forceFrom: true },
    )
    expect(p).toEqual({
      to: '+15551234567',
      body: 'caption',
      from: '+19876543210',
      mediaUrl: ['https://cdn.example.com/a.jpg'],
    })
  })

  it('throws when neither is set', () => {
    delete process.env.TWILIO_MESSAGING_SERVICE_SID
    delete process.env.TWILIO_FROM_NUMBER
    expect(isTwilioOutboundConfigured()).toBe(false)
    expect(() => twilioMessageCreateParams('+1', 'b')).toThrow(TWILIO_OUTBOUND_NOT_CONFIGURED)
  })

  it('twilioMmsMessageCreateParams adds mediaUrl and omits caption body when only media', () => {
    process.env.TWILIO_MESSAGING_SERVICE_SID = 'MGaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    const p = twilioMmsMessageCreateParams('+15551234567', '', [
      'https://cdn.example.com/a.jpg',
    ])
    expect(p).toMatchObject({
      to: '+15551234567',
      body: '',
      messagingServiceSid: 'MGaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      mediaUrl: ['https://cdn.example.com/a.jpg'],
    })
  })

  it('isTwilioClientConfigured requires account, token, and outbound address', () => {
    process.env.TWILIO_MESSAGING_SERVICE_SID = 'MGaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    delete process.env.TWILIO_FROM_NUMBER
    delete process.env.TWILIO_ACCOUNT_SID
    delete process.env.TWILIO_AUTH_TOKEN
    expect(isTwilioClientConfigured()).toBe(false)
    process.env.TWILIO_ACCOUNT_SID = 'ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    expect(isTwilioClientConfigured()).toBe(false)
    process.env.TWILIO_AUTH_TOKEN = 'secret'
    expect(isTwilioClientConfigured()).toBe(true)
  })
})

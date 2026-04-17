import { normalizeTwilioMessagingError } from '../../src/services/messaging/normalizeTwilioMessagingError'

describe('normalizeTwilioMessagingError', () => {
  it('normalizes code 30019 into TWILIO_CONTENT_SIZE_EXCEEDED', () => {
    const err = {
      code: 30019,
      status: 400,
      moreInfo: 'https://www.twilio.com/docs/errors/30019',
      message: 'Content size exceeds carrier limit',
    }
    expect(normalizeTwilioMessagingError(err)).toEqual({
      type: 'TWILIO_CONTENT_SIZE_EXCEEDED',
      twilioCode: 30019,
      status: 400,
      moreInfo: 'https://www.twilio.com/docs/errors/30019',
      message: 'Content size exceeds carrier limit',
    })
  })

  it('accepts string codes and nested error shapes', () => {
    const err = { error: { code: '30019', status: '400', message: 'too big' } }
    const out = normalizeTwilioMessagingError(err)
    expect(out.type).toBe('TWILIO_CONTENT_SIZE_EXCEEDED')
    expect(out.twilioCode).toBe(30019)
    expect(out.status).toBe(400)
    expect(out.message).toBe('too big')
  })

  it('returns TWILIO_OTHER for unknown code', () => {
    const err = { code: 21610, status: 400, message: 'unsubscribed' }
    expect(normalizeTwilioMessagingError(err)).toEqual({
      type: 'TWILIO_OTHER',
      twilioCode: 21610,
      status: 400,
      moreInfo: undefined,
      message: 'unsubscribed',
    })
  })

  it('handles non-object errors', () => {
    const out = normalizeTwilioMessagingError('boom')
    expect(out.type).toBe('TWILIO_OTHER')
  })
})


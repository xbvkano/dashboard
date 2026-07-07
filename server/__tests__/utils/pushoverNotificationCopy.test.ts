import {
  buildInboundSmsPushoverPayload,
  buildPushoverTestSample,
  formatCallPushoverBody,
  formatQuotePushoverBody,
  listPushoverTestSamples,
  PUSHOVER_FORM_CALL_EXPIRE_SEC,
  PUSHOVER_FORM_CALL_RETRY_SEC,
  pushoverEmergencyDeliveryCount,
} from '../../src/utils/pushoverNotificationCopy'

describe('pushoverNotificationCopy', () => {
  it('formatQuotePushoverBody matches evidence concise format', () => {
    expect(
      formatQuotePushoverBody({
        name: 'Maria Garcia',
        number: '(702) 555-1234',
        sizeLabel: '0 - 1000sqft',
        serviceLabelStr: 'Standard Cleaning',
        price: 195,
      }),
    ).toBe('Maria Garcia · (702) 555-1234 · 0 - 1000sqft · Standard Cleaning · $195')
  })

  it('formatCallPushoverBody matches evidence concise format', () => {
    expect(
      formatCallPushoverBody({
        caller: '(702) 555-0142',
        service: 'Move in/out',
        size: '1501 - 2000sqft',
        section: 'schedule IVR',
      }),
    ).toBe('(702) 555-0142 · Move in/out · 1501 - 2000sqft · schedule IVR')
  })

  it('buildInboundSmsPushoverPayload keeps timestamp suffix', () => {
    const receivedAt = new Date('2026-04-13T12:00:00.000Z')
    const payload = buildInboundSmsPushoverPayload({
      senderLabel: '+15559990000',
      body: 'Hi',
      mediaCount: 0,
      receivedAt,
    })
    expect(payload.title).toBe('+15559990000')
    expect(payload.message).toContain('Hi')
    expect(payload.message).toContain('\n\n')
    expect(payload.priority).toBe(1)
    expect(payload.sound).toBe('magic')
  })

  it('listPushoverTestSamples returns all three notification types', () => {
    const samples = listPushoverTestSamples()
    expect(samples.map((s) => s.type)).toEqual(['INBOUND_SMS', 'WEBSITE_FORM', 'INBOUND_CALL'])
    expect(buildPushoverTestSample('WEBSITE_FORM').payload.retry).toBe(300)
    expect(buildPushoverTestSample('WEBSITE_FORM').payload.expire).toBe(1500)
    expect(
      pushoverEmergencyDeliveryCount(
        PUSHOVER_FORM_CALL_RETRY_SEC,
        PUSHOVER_FORM_CALL_EXPIRE_SEC,
      ),
    ).toBe(5)
    expect(pushoverEmergencyDeliveryCount(300, 1200)).toBe(4)
  })
})

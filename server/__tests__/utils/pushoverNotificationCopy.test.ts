import {
  buildInboundSmsPushoverPayload,
  buildPushoverTestSample,
  buildServiceStatusPushoverPayload,
  formatCallPushoverBody,
  formatQuotePushoverBody,
  listPushoverTestSamples,
  PUSHOVER_FORM_CALL_EXPIRE_SEC,
  PUSHOVER_FORM_CALL_RETRY_SEC,
  PUSHOVER_SERVICE_STATUS_PRIORITY,
  PUSHOVER_SERVICE_STATUS_SOUND,
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

  it('listPushoverTestSamples returns all four notification types', () => {
    const samples = listPushoverTestSamples()
    expect(samples.map((s) => s.type)).toEqual([
      'INBOUND_SMS',
      'WEBSITE_FORM',
      'INBOUND_CALL',
      'SERVICE_STATUS',
    ])
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

  describe('SERVICE_STATUS', () => {
    it('uses pushover default sound and priority 1 for on the way', () => {
      const payload = buildServiceStatusPushoverPayload({
        kind: 'ON_THE_WAY',
        employeeName: 'Maria',
        clientName: 'Jane Client',
        address: '123 Main St',
        time: '09:00',
      })
      expect(payload.sound).toBe('pushover')
      expect(payload.sound).toBe(PUSHOVER_SERVICE_STATUS_SOUND)
      expect(payload.priority).toBe(1)
      expect(payload.priority).toBe(PUSHOVER_SERVICE_STATUS_PRIORITY)
      expect(payload.title).toBe('On the way — Jane Client · Maria')
      expect(payload.message).toContain('Jane Client')
      expect(payload.message).toContain('Maria')
      expect(payload.message).toContain('123 Main St')
      expect(payload.message).toContain('09:00')
      expect(payload.retry).toBeUndefined()
      expect(payload.expire).toBeUndefined()
    })

    it('builds arrived and 30 minutes titles with client and employee names', () => {
      expect(
        buildServiceStatusPushoverPayload({
          kind: 'ARRIVED',
          employeeName: 'Ana',
          clientName: 'Bob',
          address: '456 Oak Ave',
          time: '14:00',
        }).title,
      ).toBe('Arrived — Bob · Ana')
      expect(
        buildServiceStatusPushoverPayload({
          kind: 'THIRTY_MINUTES_LEFT',
          employeeName: 'João',
          clientName: 'Carla',
          address: '789 Pine Rd',
          time: '10:30',
        }).title,
      ).toBe('30 min left — Carla · João')
    })

    it('does not use inbound SMS or form/call sounds', () => {
      const payload = buildServiceStatusPushoverPayload({
        kind: 'ARRIVED',
        employeeName: 'Sam',
        clientName: 'Pat',
        address: '1 Test Ln',
        time: '11:00',
      })
      expect(payload.sound).not.toBe('magic')
      expect(payload.sound).not.toBe('cashregister')
      expect(payload.priority).not.toBe(2)
    })

    it('SERVICE_STATUS test sample matches type constants', () => {
      const sample = buildPushoverTestSample('SERVICE_STATUS')
      expect(sample.type).toBe('SERVICE_STATUS')
      expect(sample.payload.sound).toBe(PUSHOVER_SERVICE_STATUS_SOUND)
      expect(sample.payload.priority).toBe(PUSHOVER_SERVICE_STATUS_PRIORITY)
      expect(sample.payload.title).toContain('—')
      expect(sample.payload.title).toMatch(/·/)
    })

    it('rejects unknown kinds at runtime for safety', () => {
      expect(() =>
        buildServiceStatusPushoverPayload({
          kind: 'NOT_A_KIND' as 'ON_THE_WAY',
          employeeName: 'X',
          clientName: 'Y',
          address: 'Z',
          time: '12:00',
        }),
      ).toThrow(/kind/i)
    })
  })
})

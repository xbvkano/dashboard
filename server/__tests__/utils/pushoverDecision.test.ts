import { shouldSendInboundPushover } from '../../src/utils/pushoverDecision'

describe('pushoverDecision', () => {
  const now = new Date('2026-04-13T12:00:00.000Z')

  it('skips when presence (viewer on thread)', () => {
    expect(
      shouldSendInboundPushover({
        now,
        hasActivePresence: true,
        lastPushoverNotifiedAt: null,
      })
    ).toBe(false)
  })

  it('sends when no presence and never notified', () => {
    expect(
      shouldSendInboundPushover({
        now,
        hasActivePresence: false,
        lastPushoverNotifiedAt: null,
      })
    ).toBe(true)
  })

  it('suppresses within 5 minutes of last notification', () => {
    expect(
      shouldSendInboundPushover({
        now,
        hasActivePresence: false,
        lastPushoverNotifiedAt: new Date('2026-04-13T11:57:00.000Z'),
      })
    ).toBe(false)
  })

  it('allows again after 5 minutes', () => {
    expect(
      shouldSendInboundPushover({
        now,
        hasActivePresence: false,
        lastPushoverNotifiedAt: new Date('2026-04-13T11:54:00.000Z'),
      })
    ).toBe(true)
  })
})

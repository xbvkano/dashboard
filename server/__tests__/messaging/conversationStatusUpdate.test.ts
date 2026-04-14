import { buildConversationStatusUpdateData } from '../../src/services/messaging/conversationStatusUpdate'

describe('buildConversationStatusUpdateData', () => {
  it('ARCHIVED sets archivedAt and does not clear pushover throttle', () => {
    const now = new Date('2026-04-13T10:00:00.000Z')
    const data = buildConversationStatusUpdateData('ARCHIVED', now) as any
    expect(data.status).toBe('ARCHIVED')
    expect(data.archivedAt).toBe(now)
    expect(data.lastPushoverNotifiedAt).toBeUndefined()
  })

  it('OPEN clears archivedAt and clears lastPushoverNotifiedAt', () => {
    const now = new Date('2026-04-13T10:00:00.000Z')
    const data = buildConversationStatusUpdateData('OPEN', now) as any
    expect(data.status).toBe('OPEN')
    expect(data.archivedAt).toBeNull()
    expect(data.lastPushoverNotifiedAt).toBeNull()
  })
})


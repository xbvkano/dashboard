import {
  lastMessagePreviewText,
  mapConversationsToInboxDto,
  previewBody,
} from '../../src/utils/messagingDto'

describe('messagingDto', () => {
  it('previewBody truncates long text', () => {
    const long = 'x'.repeat(200)
    expect(previewBody(long, 10).length).toBeLessThanOrEqual(11)
  })

  it('lastMessagePreviewText shows photo hint when body empty but media present', () => {
    expect(lastMessagePreviewText({ body: '', mediaCount: 1 })).toBe('📷 Photo')
    expect(lastMessagePreviewText({ body: '   ', mediaCount: 0 })).toBeNull()
  })

  it('maps inbox rows with client and last preview', () => {
    const t = new Date('2026-04-11T10:00:00.000Z')
    const dto = mapConversationsToInboxDto([
      {
        id: 1,
        channel: 'SMS',
        status: 'OPEN',
        businessNumber: '+17255774523',
        lastMessageAt: t,
        contactPoint: {
          id: 2,
          type: 'PHONE',
          value: '+15551110000',
          displayValue: null,
          blocked: false,
        },
        client: { id: 9, name: 'John Doe', number: '+15551111111', notes: null },
        sessions: [{ id: 3, openedAt: t }],
        messages: [{ body: 'Need cleaning tomorrow' }],
      },
    ])
    expect(dto[0].client?.name).toBe('John Doe')
    expect(dto[0].lastMessagePreview).toContain('Need cleaning')
    expect(dto[0].openSession?.id).toBe(3)
  })
})

import { ConversationStatus } from '@prisma/client'
import {
  markAllOpenConversationsRead,
  uniqueDevInboundFromE164,
} from '../../src/services/messaging/actionCountsDev'

describe('actionCountsDev', () => {
  it('builds a unique US test From number', () => {
    expect(uniqueDevInboundFromE164(123)).toBe('+15550010123')
  })

  it('marks every OPEN conversation read for the user', async () => {
    const upsert = jest.fn().mockResolvedValue({})
    const db = {
      conversation: {
        findMany: jest.fn().mockResolvedValue([
          { id: 1, messages: [{ id: 10 }] },
          { id: 2, messages: [] },
        ]),
      },
      userConversationRead: { upsert },
    } as any
    await expect(markAllOpenConversationsRead(db, 7)).resolves.toBe(2)
    expect(db.conversation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: ConversationStatus.OPEN } }),
    )
    expect(upsert).toHaveBeenCalledTimes(2)
    expect(upsert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { userId_conversationId: { userId: 7, conversationId: 1 } },
        create: expect.objectContaining({ lastReadMessageId: 10 }),
      }),
    )
    expect(upsert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        create: expect.objectContaining({ lastReadMessageId: null }),
      }),
    )
  })
})

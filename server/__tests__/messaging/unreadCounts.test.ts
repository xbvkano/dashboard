import { ConversationStatus, MessageDirection } from '@prisma/client'
import {
  countMessagingUnread,
  countUnreadForBusinessNumber,
} from '../../src/services/messaging/unreadCounts'

function mockDb(rows: unknown[]) {
  return {
    conversation: {
      findMany: jest.fn().mockResolvedValue(rows),
    },
  } as any
}

describe('countUnreadForBusinessNumber', () => {
  it('counts inbound-unseen OPEN threads only', async () => {
    const db = mockDb([
      { messages: [{ id: 10, direction: MessageDirection.INBOUND }], userReads: [] },
      { messages: [{ id: 11, direction: MessageDirection.OUTBOUND }], userReads: [] },
      { messages: [{ id: 12, direction: MessageDirection.INBOUND }], userReads: [{ lastReadMessageId: 12 }] },
      { messages: [{ id: 13, direction: MessageDirection.INBOUND }], userReads: [{ lastReadMessageId: 10 }] },
      { messages: [], userReads: [] },
    ])
    await expect(countUnreadForBusinessNumber(db, 7, '+15550001111')).resolves.toBe(2)
    expect(db.conversation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: ConversationStatus.OPEN, businessNumber: '+15550001111' },
      }),
    )
  })
})

describe('countMessagingUnread', () => {
  const prevClient = process.env.TWILIO_FROM_NUMBER
  const prevEmployee = process.env.TWILIO_ADMIN_FROM_NUMBER
  const prevTypo = process.env.TWILIO_ADMIN_ROM_NUMBER
  const prevVoice = process.env.TWILIO_ADMIN_PHONE_NUMBER

  afterEach(() => {
    process.env.TWILIO_FROM_NUMBER = prevClient
    process.env.TWILIO_ADMIN_FROM_NUMBER = prevEmployee
    process.env.TWILIO_ADMIN_ROM_NUMBER = prevTypo
    process.env.TWILIO_ADMIN_PHONE_NUMBER = prevVoice
  })

  it('splits client vs employee and totals them', async () => {
    process.env.TWILIO_FROM_NUMBER = '+15551111111'
    process.env.TWILIO_ADMIN_FROM_NUMBER = '+15552222222'
    delete process.env.TWILIO_ADMIN_ROM_NUMBER
    delete process.env.TWILIO_ADMIN_PHONE_NUMBER

    const findMany = jest.fn(async ({ where }: { where: { businessNumber: string } }) => {
      if (where.businessNumber.includes('1111111') || where.businessNumber === '+15551111111') {
        return [
          { messages: [{ id: 1, direction: MessageDirection.INBOUND }], userReads: [] },
          { messages: [{ id: 2, direction: MessageDirection.INBOUND }], userReads: [] },
        ]
      }
      return [{ messages: [{ id: 3, direction: MessageDirection.INBOUND }], userReads: [] }]
    })
    const db = { conversation: { findMany } } as any
    const counts = await countMessagingUnread(db, 1)
    expect(counts.client).toBe(2)
    expect(counts.employee).toBe(1)
    expect(counts.total).toBe(3)
  })

  it('returns zeros when inbox lines are not configured', async () => {
    delete process.env.TWILIO_FROM_NUMBER
    delete process.env.TWILIO_ADMIN_FROM_NUMBER
    delete process.env.TWILIO_ADMIN_ROM_NUMBER
    delete process.env.TWILIO_ADMIN_PHONE_NUMBER
    const findMany = jest.fn()
    const db = { conversation: { findMany } } as any
    await expect(countMessagingUnread(db, 1)).resolves.toEqual({ client: 0, employee: 0, total: 0 })
    expect(findMany).not.toHaveBeenCalled()
  })
})

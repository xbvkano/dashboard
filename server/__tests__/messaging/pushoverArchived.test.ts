import { ContactPointType, ConversationStatus } from '@prisma/client'

const sendPushoverMessageMock = jest.fn()

jest.mock('../../src/services/pushover', () => ({
  isPushoverConfigured: () => true,
  sendPushoverMessage: (...args: unknown[]) => sendPushoverMessageMock(...args),
}))

jest.mock('../../src/utils/pushoverDecision', () => ({
  shouldSendInboundPushover: () => true,
}))

import { ingestInboundSms } from '../../src/services/messaging/messagingService'

function mockPrisma(overrides: Record<string, unknown> = {}) {
  return {
    contactPoint: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    conversation: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    conversationSession: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    message: {
      create: jest.fn(),
      update: jest.fn(),
    },
    messageMedia: {
      create: jest.fn(),
    },
    appointment: {
      updateMany: jest.fn(),
    },
    conversationPresence: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    userConversationRead: {
      upsert: jest.fn(),
    },
    client: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    ...overrides,
  } as any
}

describe('pushover: archived threads', () => {
  const now = new Date('2026-04-13T12:00:00.000Z')

  beforeEach(() => {
    sendPushoverMessageMock.mockClear()
    delete process.env.DASHBOARD_PUBLIC_URL
  })

  it('does not send pushover for inbound messages when conversation is archived', async () => {
    const prisma = mockPrisma()

    prisma.contactPoint.findUnique.mockResolvedValue(null)
    prisma.contactPoint.create
      .mockResolvedValueOnce({ id: 1, type: ContactPointType.PHONE, value: '+15559990000', clientId: null })
      .mockResolvedValueOnce({ id: 2, type: ContactPointType.PHONE, value: '+17255774523', clientId: null })

    prisma.conversation.findUnique.mockResolvedValue({
      id: 50,
      status: ConversationStatus.ARCHIVED,
      clientId: null,
      contactPointId: 1,
      businessNumber: '+17255774523',
      lastMessageAt: null,
    })

    prisma.conversationSession.findFirst.mockResolvedValue(null)
    prisma.conversationSession.create.mockResolvedValue({ id: 400 })
    prisma.message.create.mockResolvedValue({ id: 5000, mediaCount: 0 })
    prisma.conversation.update.mockResolvedValue({})

    // convState lookup (by id) for lastPushoverNotifiedAt
    prisma.conversation.findUnique.mockImplementation((args: any) => {
      if (args?.where?.id === 50 && args?.select?.lastPushoverNotifiedAt) {
        return Promise.resolve({ id: 50, lastPushoverNotifiedAt: null })
      }
      return Promise.resolve({
        id: 50,
        status: ConversationStatus.ARCHIVED,
        clientId: null,
        contactPointId: 1,
        businessNumber: '+17255774523',
        lastMessageAt: null,
      })
    })

    await ingestInboundSms(
      prisma,
      { From: '+15559990000', To: '+17255774523', Body: 'Hi', MessageSid: 'SM_1' } as any,
      { now },
    )

    expect(sendPushoverMessageMock).not.toHaveBeenCalled()
  })

  it('sends pushover for inbound messages when conversation is open', async () => {
    const prisma = mockPrisma()

    prisma.contactPoint.findUnique.mockResolvedValue(null)
    prisma.contactPoint.create
      .mockResolvedValueOnce({ id: 1, type: ContactPointType.PHONE, value: '+15559990000', clientId: null })
      .mockResolvedValueOnce({ id: 2, type: ContactPointType.PHONE, value: '+17255774523', clientId: null })

    prisma.conversation.findUnique.mockResolvedValue({
      id: 50,
      status: ConversationStatus.OPEN,
      clientId: null,
      contactPointId: 1,
      businessNumber: '+17255774523',
      lastMessageAt: null,
    })

    prisma.conversationSession.findFirst.mockResolvedValue(null)
    prisma.conversationSession.create.mockResolvedValue({ id: 400 })
    prisma.message.create.mockResolvedValue({ id: 5000, mediaCount: 0 })
    prisma.conversation.update.mockResolvedValue({})

    prisma.conversation.findUnique.mockImplementation((args: any) => {
      if (args?.where?.id === 50 && args?.select?.lastPushoverNotifiedAt) {
        return Promise.resolve({ id: 50, lastPushoverNotifiedAt: null })
      }
      return Promise.resolve({
        id: 50,
        status: ConversationStatus.OPEN,
        clientId: null,
        contactPointId: 1,
        businessNumber: '+17255774523',
        lastMessageAt: null,
      })
    })

    await ingestInboundSms(
      prisma,
      { From: '+15559990000', To: '+17255774523', Body: 'Hi', MessageSid: 'SM_2' } as any,
      { now },
    )

    expect(sendPushoverMessageMock).toHaveBeenCalledTimes(1)
    expect(sendPushoverMessageMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        title: expect.stringContaining('New message from:'),
      }),
    )
  })

  it('includes inbox deep-link url when DASHBOARD_PUBLIC_URL is set', async () => {
    process.env.DASHBOARD_PUBLIC_URL = 'https://dashboard.example.com/'
    const prisma = mockPrisma()

    prisma.contactPoint.findUnique.mockResolvedValue(null)
    prisma.contactPoint.create
      .mockResolvedValueOnce({ id: 1, type: ContactPointType.PHONE, value: '+15559990000', clientId: null })
      .mockResolvedValueOnce({ id: 2, type: ContactPointType.PHONE, value: '+17255774523', clientId: null })

    prisma.conversation.findUnique.mockResolvedValue({
      id: 50,
      status: ConversationStatus.OPEN,
      clientId: null,
      contactPointId: 1,
      businessNumber: '+17255774523',
      lastMessageAt: null,
    })

    prisma.conversationSession.findFirst.mockResolvedValue(null)
    prisma.conversationSession.create.mockResolvedValue({ id: 400 })
    prisma.message.create.mockResolvedValue({ id: 5000, mediaCount: 0 })
    prisma.conversation.update.mockResolvedValue({})

    prisma.conversation.findUnique.mockImplementation((args: any) => {
      if (args?.where?.id === 50 && args?.select?.lastPushoverNotifiedAt) {
        return Promise.resolve({ id: 50, lastPushoverNotifiedAt: null })
      }
      return Promise.resolve({
        id: 50,
        status: ConversationStatus.OPEN,
        clientId: null,
        contactPointId: 1,
        businessNumber: '+17255774523',
        lastMessageAt: null,
      })
    })

    await ingestInboundSms(
      prisma,
      { From: '+15559990000', To: '+17255774523', Body: 'Hi', MessageSid: 'SM_3' } as any,
      { now },
    )

    expect(sendPushoverMessageMock).toHaveBeenCalledTimes(1)
    expect(sendPushoverMessageMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        url: 'https://dashboard.example.com/dashboard/messages/inbox?conversation=50',
      }),
    )
  })

  it('omits url when DASHBOARD_PUBLIC_URL is unset', async () => {
    delete process.env.DASHBOARD_PUBLIC_URL
    const prisma = mockPrisma()

    prisma.contactPoint.findUnique.mockResolvedValue(null)
    prisma.contactPoint.create
      .mockResolvedValueOnce({ id: 1, type: ContactPointType.PHONE, value: '+15559990000', clientId: null })
      .mockResolvedValueOnce({ id: 2, type: ContactPointType.PHONE, value: '+17255774523', clientId: null })

    prisma.conversation.findUnique.mockResolvedValue({
      id: 50,
      status: ConversationStatus.OPEN,
      clientId: null,
      contactPointId: 1,
      businessNumber: '+17255774523',
      lastMessageAt: null,
    })

    prisma.conversationSession.findFirst.mockResolvedValue(null)
    prisma.conversationSession.create.mockResolvedValue({ id: 400 })
    prisma.message.create.mockResolvedValue({ id: 5000, mediaCount: 0 })
    prisma.conversation.update.mockResolvedValue({})

    prisma.conversation.findUnique.mockImplementation((args: any) => {
      if (args?.where?.id === 50 && args?.select?.lastPushoverNotifiedAt) {
        return Promise.resolve({ id: 50, lastPushoverNotifiedAt: null })
      }
      return Promise.resolve({
        id: 50,
        status: ConversationStatus.OPEN,
        clientId: null,
        contactPointId: 1,
        businessNumber: '+17255774523',
        lastMessageAt: null,
      })
    })

    await ingestInboundSms(
      prisma,
      { From: '+15559990000', To: '+17255774523', Body: 'Hi', MessageSid: 'SM_4' } as any,
      { now },
    )

    expect(sendPushoverMessageMock).toHaveBeenCalledTimes(1)
    expect(sendPushoverMessageMock.mock.calls[0]?.[0]).toEqual(
      expect.not.objectContaining({
        url: expect.any(String),
      }),
    )
  })
})


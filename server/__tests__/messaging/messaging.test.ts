import {
  ContactPointType,
  ConversationChannel,
  ConversationStatus,
  MessageDeliveryStatus,
  MessageDirection,
  MessageSenderType,
} from '@prisma/client'
import {
  findOrCreateContactPoint,
  findOrCreateConversation,
  ingestInboundSms,
  linkContactPointToClient,
  sendOutboundSms,
} from '../../src/services/messaging/messagingService'
import { ensureOpenSession } from '../../src/services/messaging/sessionLifecycle'
import { generateMockAppointmentExtraction } from '../../src/services/messaging/appointmentExtractionMock'
import { SESSION_INACTIVITY_MS } from '../../src/services/messaging/constants'
import { MockSmsTransport } from '../../src/services/messaging/smsTransport'

function mockPrisma(overrides: Record<string, unknown> = {}) {
  return {
    contactPoint: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    conversation: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    conversationSession: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    message: {
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    messageMedia: {
      create: jest.fn(),
      createMany: jest.fn(),
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
    ...overrides,
  } as any
}

describe('messaging: contact & conversation', () => {
  it('creates ContactPoint without Client', async () => {
    const prisma = mockPrisma()
    prisma.contactPoint.findUnique.mockResolvedValue(null)
    prisma.contactPoint.create.mockResolvedValue({
      id: 1,
      type: ContactPointType.PHONE,
      value: '+15551110000',
      clientId: null,
    })

    const cp = await findOrCreateContactPoint(prisma, ContactPointType.PHONE, '+15551110000')
    expect(cp.clientId).toBeNull()
    expect(prisma.contactPoint.create).toHaveBeenCalled()
  })

  it('links ContactPoint to Client later', async () => {
    const prisma = mockPrisma()
    prisma.contactPoint.findUnique.mockResolvedValue({
      id: 2,
      type: ContactPointType.PHONE,
      value: '+15552220000',
      clientId: null,
    })
    prisma.contactPoint.update.mockResolvedValue({
      id: 2,
      clientId: 5,
    })
    prisma.conversation.updateMany.mockResolvedValue({ count: 1 })

    const cp = await linkContactPointToClient(prisma, 2, 5)
    expect(cp.clientId).toBe(5)
  })

  it('findOrCreateConversation returns existing for same contact + business number', async () => {
    const prisma = mockPrisma()
    const existing = {
      id: 10,
      contactPointId: 1,
      businessNumber: '+17255774523',
    }
    prisma.conversation.findUnique.mockResolvedValue(existing)

    const c = await findOrCreateConversation(prisma, {
      contactPointId: 1,
      businessNumber: '+17255774523',
    })
    expect(c.id).toBe(10)
    expect(prisma.conversation.create).not.toHaveBeenCalled()
  })

  it('creates conversation when none exists', async () => {
    const prisma = mockPrisma()
    prisma.conversation.findUnique.mockResolvedValue(null)
    prisma.conversation.create.mockResolvedValue({
      id: 11,
      channel: ConversationChannel.SMS,
      status: ConversationStatus.OPEN,
      contactPointId: 3,
      businessNumber: '+17255774523',
    })

    const c = await findOrCreateConversation(prisma, {
      contactPointId: 3,
      businessNumber: '+17255774523',
    })
    expect(c.id).toBe(11)
    expect(prisma.conversation.create).toHaveBeenCalled()
  })
})

describe('messaging: session lifecycle', () => {
  const now = new Date('2026-04-11T12:00:00.000Z')

  it('creates a session when none exists', async () => {
    const prisma = mockPrisma()
    prisma.conversation.findUnique.mockResolvedValue({
      id: 1,
      lastMessageAt: null,
    })
    prisma.conversationSession.findFirst.mockResolvedValue(null)
    prisma.conversationSession.create.mockResolvedValue({ id: 100 })

    const r = await ensureOpenSession(prisma, 1, now)
    expect(r.sessionId).toBe(100)
    expect(r.rotated).toBe(false)
  })

  it('reuses session when activity within 12 hours', async () => {
    const prisma = mockPrisma()
    const recent = new Date(now.getTime() - 60 * 60 * 1000)
    prisma.conversation.findUnique.mockResolvedValue({
      id: 1,
      lastMessageAt: recent,
    })
    prisma.conversationSession.findFirst.mockResolvedValue({ id: 200, closedAt: null })

    const r = await ensureOpenSession(prisma, 1, now)
    expect(r.sessionId).toBe(200)
    expect(r.rotated).toBe(false)
    expect(prisma.conversationSession.update).not.toHaveBeenCalled()
  })

  it('closes session and creates new one when inactivity exceeds 12 hours', async () => {
    const prisma = mockPrisma()
    const old = new Date(now.getTime() - SESSION_INACTIVITY_MS - 1000)
    prisma.conversation.findUnique.mockResolvedValue({
      id: 1,
      lastMessageAt: old,
    })
    prisma.conversationSession.findFirst.mockResolvedValue({ id: 300, closedAt: null })
    prisma.conversationSession.update.mockResolvedValue({ id: 300 })
    prisma.conversationSession.create.mockResolvedValue({ id: 301 })

    const r = await ensureOpenSession(prisma, 1, now)
    expect(r.rotated).toBe(true)
    expect(r.sessionId).toBe(301)
    expect(prisma.conversationSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 300 },
        data: expect.objectContaining({ closeReason: 'INACTIVITY' }),
      })
    )
  })
})

describe('messaging: inbound / outbound', () => {
  const now = new Date('2026-04-11T12:00:00.000Z')

  it('ingestInboundSms persists message and updates lastMessageAt', async () => {
    const prisma = mockPrisma()
    prisma.contactPoint.findUnique.mockResolvedValue(null)
    prisma.contactPoint.create
      .mockResolvedValueOnce({
        id: 1,
        type: ContactPointType.PHONE,
        value: '+15559990000',
        clientId: null,
      })
      .mockResolvedValueOnce({
        id: 2,
        type: ContactPointType.PHONE,
        value: '+17255774523',
        clientId: null,
      })

    prisma.conversation.findUnique.mockImplementation((args: { where: { id?: number } }) => {
      if (args.where.id === 50) {
        return Promise.resolve({ id: 50, lastMessageAt: null, lastPushoverNotifiedAt: null })
      }
      return Promise.resolve(null)
    })
    prisma.conversation.create.mockResolvedValue({
      id: 50,
      clientId: null,
      contactPointId: 1,
      businessNumber: '+17255774523',
    })
    prisma.conversationSession.findFirst.mockResolvedValue(null)
    prisma.conversationSession.create.mockResolvedValue({ id: 400 })
    prisma.message.create.mockResolvedValue({ id: 5000 })
    prisma.conversation.update.mockResolvedValue({})

    const result = await ingestInboundSms(
      prisma,
      {
        From: '+15559990000',
        To: '+17255774523',
        Body: 'Hello there',
        MessageSid: 'SM_in_1',
      },
      { now }
    )

    expect(result.conversationId).toBe(50)
    expect(result.messageId).toBe(5000)
    expect(prisma.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          direction: MessageDirection.INBOUND,
          senderType: MessageSenderType.CUSTOMER,
          body: 'Hello there',
          status: MessageDeliveryStatus.RECEIVED,
        }),
      })
    )
    expect(prisma.conversation.update).toHaveBeenCalled()
  })

  it('sendOutboundSms attaches userId for staff', async () => {
    const prisma = mockPrisma()
    prisma.conversation.findUnique.mockResolvedValue({
      id: 60,
      businessNumber: '+17255774523',
      clientId: 9,
      lastMessageAt: now,
      contactPoint: { id: 7, value: '+15558887777' },
    })
    prisma.conversationSession.findFirst.mockResolvedValue({ id: 410, closedAt: null })
    prisma.contactPoint.findUnique.mockImplementation((args: { where: { type_value?: { value: string } } }) => {
      const v = args?.where?.type_value?.value
      if (v === '+17255774523') return Promise.resolve(null)
      if (v === '+15558887777') {
        return Promise.resolve({
          id: 7,
          type: ContactPointType.PHONE,
          value: '+15558887777',
        })
      }
      return Promise.resolve(null)
    })
    prisma.contactPoint.create.mockResolvedValue({ id: 8, value: '+17255774523' })
    prisma.message.create.mockResolvedValue({ id: 6000 })
    prisma.conversation.update.mockResolvedValue({})

    const transport = new MockSmsTransport()
    const sendSpy = jest.spyOn(transport, 'send')

    await sendOutboundSms(prisma, {
      conversationId: 60,
      body: 'Reply from staff',
      userId: 42,
      transport,
      now,
    })

    expect(sendSpy).toHaveBeenCalled()
    expect(prisma.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 42,
          senderType: MessageSenderType.STAFF,
          direction: MessageDirection.OUTBOUND,
        }),
      })
    )
  })

  it('sendOutboundSms passes media URLs to transport and persists MessageMedia', async () => {
    const prisma = mockPrisma()
    prisma.conversation.findUnique.mockResolvedValue({
      id: 60,
      businessNumber: '+17255774523',
      clientId: 9,
      lastMessageAt: now,
      contactPoint: { id: 7, value: '+15558887777' },
    })
    prisma.conversationSession.findFirst.mockResolvedValue({ id: 410, closedAt: null })
    prisma.contactPoint.findUnique.mockImplementation((args: { where: { type_value?: { value: string } } }) => {
      const v = args?.where?.type_value?.value
      if (v === '+17255774523') return Promise.resolve(null)
      if (v === '+15558887777') {
        return Promise.resolve({
          id: 7,
          type: ContactPointType.PHONE,
          value: '+15558887777',
        })
      }
      return Promise.resolve(null)
    })
    prisma.contactPoint.create.mockResolvedValue({ id: 8, value: '+17255774523' })
    prisma.message.create.mockResolvedValue({ id: 6001 })
    prisma.conversation.update.mockResolvedValue({})

    const transport = new MockSmsTransport()
    const sendSpy = jest.spyOn(transport, 'send')

    await sendOutboundSms(prisma, {
      conversationId: 60,
      body: '',
      outboundMedia: [
        {
          storageKey: 'messaging/outbound/60/x.jpg',
          publicUrl: 'https://example.supabase.co/storage/v1/object/public/bucket/x.jpg',
          mimeType: 'image/jpeg',
          fileSize: 100,
        },
      ],
      transport,
      now,
    })

    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaPublicUrls: ['https://example.supabase.co/storage/v1/object/public/bucket/x.jpg'],
      })
    )
    expect(prisma.messageMedia.createMany).toHaveBeenCalled()
  })
})

describe('messaging: mock extraction & list shaping', () => {
  it('generateMockAppointmentExtraction returns structured mock when session has messages', async () => {
    const prisma = mockPrisma()
    prisma.conversationSession.findUnique.mockResolvedValue({
      id: 1,
      summary: null,
      messages: [{ id: 1 }],
      appointments: [],
    })

    const out = await generateMockAppointmentExtraction(prisma, 1)
    expect(out.intent).toBe('book_cleaning')
    expect(out.customerName).toBe('Jane Doe')
    expect(out.confidence).toBe(0.87)
  })

  it('generateMockAppointmentExtraction handles empty session gracefully', async () => {
    const prisma = mockPrisma()
    prisma.conversationSession.findUnique.mockResolvedValue({
      id: 2,
      summary: null,
      messages: [],
      appointments: [],
    })

    const out = await generateMockAppointmentExtraction(prisma, 2)
    expect(out.intent).toBe('unknown')
    expect(out.confidence).toBe(0)
  })
})

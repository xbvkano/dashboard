/**
 * Inbound MMS path: Twilio payload → download → Supabase upload → MessageMedia row.
 * Storage and Twilio download are mocked; Prisma is mocked.
 */
import { ContactPointType, MessageMediaSource } from '@prisma/client'

jest.mock('../../src/services/supabaseStorage', () => ({
  isSupabaseStorageConfigured: jest.fn(() => true),
  uploadBufferToMessaging: jest.fn().mockResolvedValue({
    storageKey: 'messaging/inbound/50/5000/0-ab12cd34.jpg',
    publicUrl: 'https://project.supabase.co/storage/v1/object/public/bucket/k.jpg',
  }),
}))

const downloadTwilioMediaMock = jest.fn()
jest.mock('../../src/services/messaging/twilioInboundMedia', () => {
  const actual = jest.requireActual('../../src/services/messaging/twilioInboundMedia')
  return {
    ...actual,
    downloadTwilioMedia: (...args: unknown[]) => downloadTwilioMediaMock(...args),
  }
})

import { ingestInboundSms } from '../../src/services/messaging/messagingService'
import { isSupabaseStorageConfigured, uploadBufferToMessaging } from '../../src/services/supabaseStorage'

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

describe('ingestInboundSms (MMS)', () => {
  const now = new Date('2026-04-11T12:00:00.000Z')

  beforeEach(() => {
    downloadTwilioMediaMock.mockResolvedValue({
      buffer: Buffer.from([0xff, 0xd8, 0xff]),
      contentType: 'image/jpeg',
    })
    jest.mocked(uploadBufferToMessaging).mockClear()
    jest.mocked(isSupabaseStorageConfigured).mockReturnValue(true)
  })

  it('creates MessageMedia rows after downloading and uploading each Twilio media item', async () => {
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
    prisma.messageMedia.create.mockResolvedValue({ id: 1 })

    await ingestInboundSms(
      prisma,
      {
        From: '+15559990000',
        To: '+17255774523',
        Body: 'See pic',
        MessageSid: 'SM_in_mms',
        NumMedia: '1',
        MediaUrl0: 'https://api.twilio.com/2010-04-01/Accounts/AC/Media/ME0',
        MediaContentType0: 'image/jpeg',
      },
      { now },
    )

    expect(downloadTwilioMediaMock).toHaveBeenCalledWith('https://api.twilio.com/2010-04-01/Accounts/AC/Media/ME0')
    expect(uploadBufferToMessaging).toHaveBeenCalled()
    expect(prisma.messageMedia.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        messageId: 5000,
        mimeType: 'image/jpeg',
        source: MessageMediaSource.INBOUND_TWILIO,
        sortOrder: 0,
        fileSize: 3,
        publicUrl: expect.stringContaining('supabase'),
      }),
    })
  })

  it('throws when media is present but Supabase is not configured', async () => {
    jest.mocked(isSupabaseStorageConfigured).mockReturnValue(false)

    const prisma = mockPrisma()
    prisma.contactPoint.findUnique.mockResolvedValue(null)
    prisma.contactPoint.create
      .mockResolvedValueOnce({ id: 1, type: ContactPointType.PHONE, value: '+1', clientId: null })
      .mockResolvedValueOnce({ id: 2, type: ContactPointType.PHONE, value: '+2', clientId: null })
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

    await expect(
      ingestInboundSms(
        prisma,
        {
          From: '+15559990000',
          To: '+17255774523',
          Body: '',
          NumMedia: '1',
          MediaUrl0: 'https://api.twilio.com/media/x',
          MediaContentType0: 'image/png',
        },
        { now },
      ),
    ).rejects.toThrow(/Inbound MMS requires Supabase Storage/)

    expect(prisma.messageMedia.create).not.toHaveBeenCalled()
  })

  it('updates mediaCount when a media item fails after message create', async () => {
    jest.mocked(isSupabaseStorageConfigured).mockReturnValue(true)
    downloadTwilioMediaMock.mockRejectedValueOnce(new Error('network'))
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    const prisma = mockPrisma()
    prisma.contactPoint.findUnique.mockResolvedValue(null)
    prisma.contactPoint.create
      .mockResolvedValueOnce({ id: 1, type: ContactPointType.PHONE, value: '+15559990000', clientId: null })
      .mockResolvedValueOnce({ id: 2, type: ContactPointType.PHONE, value: '+17255774523', clientId: null })
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
    prisma.message.update.mockResolvedValue({})

    await ingestInboundSms(
      prisma,
      {
        From: '+15559990000',
        To: '+17255774523',
        Body: '',
        NumMedia: '1',
        MediaUrl0: 'https://api.twilio.com/bad',
        MediaContentType0: 'image/jpeg',
      },
      { now },
    )

    expect(prisma.message.update).toHaveBeenCalledWith({
      where: { id: 5000 },
      data: { mediaCount: 0 },
    })
    errSpy.mockRestore()
  })
})

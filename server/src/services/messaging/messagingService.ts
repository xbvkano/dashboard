import { randomUUID } from 'crypto'
import type { Prisma, PrismaClient } from '@prisma/client'
import {
  ContactPointType,
  ConversationChannel,
  ConversationStatus,
  MessageDeliveryStatus,
  MessageDirection,
  MessageMediaSource,
  MessageSenderType,
} from '@prisma/client'
import { normalizePhone } from '../../utils/phoneUtils'
import { isSupabaseStorageConfigured, uploadBufferToMessaging } from '../supabaseStorage'
import { ensureOpenSession } from './sessionLifecycle'
import type { TwilioInboundSmsPayload } from './twilioTypes'
import {
  downloadTwilioMedia,
  extractTwilioInboundMediaItems,
  extensionForMime,
} from './twilioInboundMedia'
import type { SmsTransport } from './smsTransport'
import { isTwilioClientConfigured } from '../../utils/twilioSms'
import { MockSmsTransport, TwilioSmsTransport } from './smsTransport'

function parseNumMedia(raw: unknown): number {
  const n = parseInt(String(raw ?? '0'), 10)
  return Number.isFinite(n) ? n : 0
}

function parseNumSegments(raw: unknown): number | undefined {
  const n = parseInt(String(raw ?? ''), 10)
  return Number.isFinite(n) ? n : undefined
}

export async function findOrCreateContactPoint(
  prisma: PrismaClient,
  type: ContactPointType,
  value: string,
  extra?: { displayValue?: string | null; twilioAddress?: string | null; clientId?: number | null }
) {
  const existing = await prisma.contactPoint.findUnique({
    where: { type_value: { type, value } },
  })
  if (existing) {
    if (extra?.clientId != null && existing.clientId == null) {
      return prisma.contactPoint.update({
        where: { id: existing.id },
        data: { clientId: extra.clientId },
      })
    }
    return existing
  }
  return prisma.contactPoint.create({
    data: {
      type,
      value,
      displayValue: extra?.displayValue ?? undefined,
      twilioAddress: extra?.twilioAddress ?? undefined,
      clientId: extra?.clientId ?? undefined,
    },
  })
}

export async function findOrCreateConversation(
  prisma: PrismaClient,
  args: {
    contactPointId: number
    businessNumber: string
    channel?: ConversationChannel
    clientId?: number | null
  }
) {
  const channel = args.channel ?? ConversationChannel.SMS
  const existing = await prisma.conversation.findUnique({
    where: {
      contactPointId_businessNumber: {
        contactPointId: args.contactPointId,
        businessNumber: args.businessNumber,
      },
    },
  })
  if (existing) {
    if (args.clientId != null && existing.clientId == null) {
      return prisma.conversation.update({
        where: { id: existing.id },
        data: { clientId: args.clientId },
      })
    }
    return existing
  }
  return prisma.conversation.create({
    data: {
      channel,
      status: ConversationStatus.OPEN,
      contactPointId: args.contactPointId,
      businessNumber: args.businessNumber,
      clientId: args.clientId ?? undefined,
    },
  })
}

export async function linkContactPointToClient(
  prisma: PrismaClient,
  contactPointId: number,
  clientId: number
) {
  const cp = await prisma.contactPoint.update({
    where: { id: contactPointId },
    data: { clientId },
  })
  await prisma.conversation.updateMany({
    where: { contactPointId, clientId: null },
    data: { clientId },
  })
  return cp
}

function inboundTimestamp(payload: TwilioInboundSmsPayload, fallback: Date): Date {
  const ds = payload.DateSent
  if (typeof ds === 'string' && ds.length > 0) {
    const t = Date.parse(ds)
    if (!Number.isNaN(t)) return new Date(t)
  }
  return fallback
}

export async function ingestInboundSms(
  prisma: PrismaClient,
  payload: TwilioInboundSmsPayload,
  options?: { now?: Date }
): Promise<{ conversationId: number; messageId: number; sessionId: number }> {
  const now = options?.now ?? new Date()
  const fromRaw = String(payload.From ?? '')
  const toRaw = String(payload.To ?? '')
  const fromNorm = normalizePhone(fromRaw)
  const toNorm = normalizePhone(toRaw)
  if (!fromNorm || !toNorm) {
    throw new Error('Invalid From/To phone for inbound SMS')
  }

  const fromCp = await findOrCreateContactPoint(prisma, ContactPointType.PHONE, fromNorm, {
    twilioAddress: fromRaw || undefined,
  })
  const toCp = await findOrCreateContactPoint(prisma, ContactPointType.PHONE, toNorm, {
    twilioAddress: toRaw || undefined,
  })

  const conv = await findOrCreateConversation(prisma, {
    contactPointId: fromCp.id,
    businessNumber: toNorm,
    clientId: fromCp.clientId,
  })

  const { sessionId } = await ensureOpenSession(prisma, conv.id, now)

  const receivedAt = inboundTimestamp(payload, now)
  const body = String(payload.Body ?? '')

  const declaredMedia = parseNumMedia(payload.NumMedia)
  const msg = await prisma.message.create({
    data: {
      conversationId: conv.id,
      sessionId,
      twilioSid: payload.MessageSid ?? payload.SmsMessageSid ?? undefined,
      twilioAccountSid: payload.AccountSid ?? undefined,
      twilioMessagingSid: payload.MessagingServiceSid ?? undefined,
      twilioStatusRaw: payload.SmsStatus ?? undefined,
      direction: MessageDirection.INBOUND,
      senderType: MessageSenderType.CUSTOMER,
      fromContactPointId: fromCp.id,
      toContactPointId: toCp.id,
      clientId: conv.clientId,
      body,
      mediaCount: declaredMedia,
      numSegments: parseNumSegments(payload.NumSegments),
      status: MessageDeliveryStatus.RECEIVED,
      receivedAt,
      rawPayload: payload as unknown as Prisma.InputJsonValue,
    },
  })

  const mediaItems = extractTwilioInboundMediaItems(payload as Record<string, unknown>)
  if (mediaItems.length > 0) {
    if (!isSupabaseStorageConfigured()) {
      throw new Error(
        'Inbound MMS requires Supabase Storage (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_STORAGE_BUCKET)',
      )
    }
    let stored = 0
    for (let i = 0; i < mediaItems.length; i++) {
      const item = mediaItems[i]
      try {
        const { buffer, contentType } = await downloadTwilioMedia(item.url)
        const ext = extensionForMime(contentType)
        const storageKey = `messaging/inbound/${conv.id}/${msg.id}/${i}-${randomUUID().slice(0, 8)}.${ext}`
        const uploaded = await uploadBufferToMessaging(storageKey, buffer, contentType)
        await prisma.messageMedia.create({
          data: {
            messageId: msg.id,
            storageKey: uploaded.storageKey,
            publicUrl: uploaded.publicUrl,
            mimeType: contentType,
            fileSize: buffer.length,
            source: MessageMediaSource.INBOUND_TWILIO,
            sortOrder: i,
          },
        })
        stored += 1
      } catch (e) {
        console.error('[messaging] inbound media item failed', i, e)
      }
    }
    if (stored !== declaredMedia) {
      await prisma.message.update({
        where: { id: msg.id },
        data: { mediaCount: stored },
      })
    }
  }

  await prisma.conversation.update({
    where: { id: conv.id },
    data: { lastMessageAt: receivedAt },
  })

  return { conversationId: conv.id, messageId: msg.id, sessionId }
}

/** After upload to Supabase; Twilio receives `publicUrl` as mediaUrl */
export interface OutboundMediaReady {
  storageKey: string
  publicUrl: string
  mimeType: string
  fileName?: string | null
  fileSize?: number | null
}

export interface SendOutboundSmsInput {
  conversationId: number
  /** Plain text; may be empty when sending image(s) only */
  body: string
  userId?: number | null
  /** Metadata for images already stored in Supabase (URLs passed to Twilio) */
  outboundMedia?: OutboundMediaReady[]
  /** Defaults to Twilio when TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and outbound config are set; otherwise mock */
  transport?: SmsTransport
  now?: Date
}

function defaultOutboundTransport(): MockSmsTransport | TwilioSmsTransport {
  if (isTwilioClientConfigured()) {
    return new TwilioSmsTransport()
  }
  return new MockSmsTransport()
}

export async function sendOutboundSms(
  prisma: PrismaClient,
  input: SendOutboundSmsInput
): Promise<{
  messageId: number
  sessionId: number
  transport: { messageSid: string; status: string }
}> {
  const now = input.now ?? new Date()
  const transport = input.transport ?? defaultOutboundTransport()

  const conv = await prisma.conversation.findUnique({
    where: { id: input.conversationId },
    include: { contactPoint: true },
  })
  if (!conv) {
    throw new Error(`Conversation ${input.conversationId} not found`)
  }

  const trimmedBody = input.body.trim()
  const media = input.outboundMedia ?? []
  if (!trimmedBody && media.length === 0) {
    throw new Error('Message text or at least one image is required')
  }

  const { sessionId } = await ensureOpenSession(prisma, conv.id, now)

  const business = conv.businessNumber
  const customer = conv.contactPoint.value

  const businessCp = await findOrCreateContactPoint(prisma, ContactPointType.PHONE, business)
  const customerCp = await prisma.contactPoint.findUnique({
    where: { type_value: { type: ContactPointType.PHONE, value: customer } },
  })
  if (!customerCp) {
    throw new Error('Conversation contact point missing')
  }

  const mediaUrls = media.map((m) => m.publicUrl).filter(Boolean)
  const sendResult = await transport.send({
    toE164: customer,
    body: trimmedBody,
    mediaPublicUrls: mediaUrls.length ? mediaUrls : undefined,
  })

  const senderType =
    input.userId != null ? MessageSenderType.STAFF : MessageSenderType.SYSTEM

  const msg = await prisma.message.create({
    data: {
      conversationId: conv.id,
      sessionId,
      twilioSid: sendResult.messageSid,
      direction: MessageDirection.OUTBOUND,
      senderType,
      fromContactPointId: businessCp.id,
      toContactPointId: customerCp.id,
      userId: input.userId ?? undefined,
      clientId: conv.clientId ?? undefined,
      body: trimmedBody,
      mediaCount: media.length,
      status: MessageDeliveryStatus.SENT,
      sentAt: now,
      rawPayload: (
        sendResult.source === 'twilio'
          ? { twilio: sendResult.raw ?? { messageSid: sendResult.messageSid, status: sendResult.status } }
          : { mockTransport: sendResult.raw ?? sendResult }
      ) as Prisma.InputJsonValue,
    },
  })

  if (media.length > 0) {
    await prisma.messageMedia.createMany({
      data: media.map((m, i) => ({
        messageId: msg.id,
        storageKey: m.storageKey,
        publicUrl: m.publicUrl,
        mimeType: m.mimeType,
        fileName: m.fileName ?? undefined,
        fileSize: m.fileSize ?? undefined,
        source: MessageMediaSource.OUTBOUND_CRM,
        sortOrder: i,
      })),
    })
  }

  await prisma.conversation.update({
    where: { id: conv.id },
    data: { lastMessageAt: now },
  })

  return {
    messageId: msg.id,
    sessionId,
    transport: { messageSid: sendResult.messageSid, status: sendResult.status },
  }
}

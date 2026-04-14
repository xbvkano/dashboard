import { Request, Response } from 'express'
import { ConversationStatus, PrismaClient, type Prisma } from '@prisma/client'
import {
  ingestInboundSms,
  sendOutboundSms,
  type OutboundMediaReady,
} from '../services/messaging/messagingService'
import { MockSmsTransport } from '../services/messaging/smsTransport'
import { generateMockAppointmentExtraction } from '../services/messaging/appointmentExtractionMock'
import {
  startConversationFromContact,
  updateClientForConversation,
} from '../services/messaging/contactMessagingService'
import { isSupabaseStorageConfigured, uploadBufferToMessaging } from '../services/supabaseStorage'
import { extensionForMime } from '../services/messaging/twilioInboundMedia'
import type { ConversationDetailDto } from '../types/messaging'
import { mapConversationsToInboxDto } from '../utils/messagingDto'
import {
  clampInboxLimit,
  decodeInboxCursor,
  encodeInboxCursor,
  inboxSearchWhere,
} from '../utils/messagingInboxQuery'
import { translateEnToPt } from '../services/googleTranslate'
import { acquireOrRenewInboxLock, releaseInboxLock } from '../services/messagingInboxLock'
import { parseUserIdHeader } from '../utils/httpUser'
import { randomUUID } from 'crypto'
import { calculateAppointmentHours, parseSqft } from '../utils/appointmentUtils'
import { normalizePhone, phoneLookupVariants } from '../utils/phoneUtils'
import { getDefaultTeamSize, getSizeRange } from '../data/teamSizeData'
import { buildConversationStatusUpdateData } from '../services/messaging/conversationStatusUpdate'
import {
  extractAppointmentForConversation,
  extractAppointmentFromConversationImages,
  extractAppointmentFromStandaloneImages,
} from '../services/appointmentExtraction/extractionOrchestrator'

const prisma = new PrismaClient()

type BookAppointmentInput = {
  clientName?: string
  appointmentAddress: string
  price: number
  date: string
  time: string
  notes?: string
  size: string
  serviceType: string
  /** Public Supabase URLs from `appointments/…` after image extraction */
  bookingScreenshotUrls?: string[]
}

function parseBookingScreenshotUrlsFromBody(body: unknown): string[] {
  const raw = (body as { bookingScreenshotUrls?: unknown }).bookingScreenshotUrls
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const u of raw.slice(0, 24)) {
    if (typeof u !== 'string') continue
    const t = u.trim()
    if (t.length === 0 || t.length > 2048) continue
    if (!t.startsWith('http://') && !t.startsWith('https://')) continue
    out.push(t)
  }
  return out
}

async function executeBookAppointmentCore(
  conversationId: number,
  adminId: number,
  input: BookAppointmentInput,
) {
  const {
    clientName,
    appointmentAddress,
    price,
    date,
    time,
    notes,
    size,
    serviceType,
    bookingScreenshotUrls: screenshotUrlsInput,
  } = input
  const bookingScreenshotUrls = screenshotUrlsInput?.length ? screenshotUrlsInput : []

  const parsedSize = parseSqft(size)
  if (parsedSize === null) {
    throw new Error(
      'Invalid size format. Size should be a range (e.g., "1500-2000") or single value (e.g., "3030")',
    )
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      contactPoint: true,
      client: true,
      sessions: {
        where: { closedAt: null },
        orderBy: { openedAt: 'desc' },
        take: 1,
      },
    },
  })
  if (!conversation) {
    throw new Error('Conversation not found')
  }

  const normalizedPhone = normalizePhone(conversation.contactPoint.value)
  if (!normalizedPhone) {
    throw new Error('Conversation phone is invalid')
  }

  const appointmentDate = parseDateStringUTC(date)
  const nextDay = new Date(
    Date.UTC(
      appointmentDate.getUTCFullYear(),
      appointmentDate.getUTCMonth(),
      appointmentDate.getUTCDate() + 1,
    ),
  )

  const activeSession =
    conversation.sessions[0] ??
    (await prisma.conversationSession.create({
      data: { conversationId: conversation.id },
    }))

  let client = conversation.client
  if (!client) {
    if (!clientName) {
      throw new Error('clientName is required when no client is linked')
    }

    client = await prisma.client.findFirst({
      where: {
        number: { in: phoneLookupVariants(normalizedPhone) },
      },
    })

    if (!client) {
      let nameToUse = clientName
      const existingByName = await prisma.client.findFirst({
        where: { name: clientName },
        select: { id: true },
      })
      if (existingByName) {
        const last4 = normalizedPhone.replace(/\D/g, '').slice(-4)
        nameToUse = `${clientName} ${last4}`
      }
      client = await prisma.client.create({
        data: {
          name: nameToUse,
          number: normalizedPhone,
          from: 'MESSAGING',
          notes: 'Client created from messaging booking',
        },
      })
    }

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { clientId: client.id },
    })
    await prisma.contactPoint.update({
      where: { id: conversation.contactPointId },
      data: { clientId: client.id },
    })
  }

  const existingAppointment = await prisma.appointment.findFirst({
    where: {
      clientId: client.id,
      date: { gte: appointmentDate, lt: nextDay },
      status: { notIn: ['DELETED', 'RESCHEDULE_OLD'] },
    },
    select: { id: true, date: true, time: true, address: true },
  })
  if (existingAppointment) {
    const err: Error & { status?: number; existingAppointment?: typeof existingAppointment } = new Error(
      'SAME_DAY_APPOINT',
    ) as any
    err.status = 409
    err.existingAppointment = existingAppointment
    throw err
  }

  const mappedSize = getSizeRange(size)
  let template = await prisma.appointmentTemplate.findFirst({
    where: {
      clientId: client.id,
      address: appointmentAddress,
      price: price,
      size: mappedSize,
    },
  })

  if (!template) {
    template = await prisma.appointmentTemplate.create({
      data: {
        templateName: `Messaging - ${appointmentAddress}`,
        type: serviceType as any,
        size: mappedSize,
        teamSize: getDefaultTeamSize(mappedSize, serviceType),
        address: appointmentAddress,
        price,
        notes: notes ?? null,
        instructions: '',
        clientId: client.id,
      },
    })
  } else if (notes != null) {
    template = await prisma.appointmentTemplate.update({
      where: { id: template.id },
      data: { notes },
    })
  }

  const hours = calculateAppointmentHours(size, serviceType)
  const appt = await prisma.appointment.create({
    data: {
      clientId: client.id,
      adminId,
      templateId: template.id,
      date: appointmentDate,
      time,
      type: serviceType as any,
      address: appointmentAddress,
      size: mappedSize,
      hours,
      price,
      paid: false,
      paymentMethod: 'CASH',
      tip: 0,
      noTeam: false,
      teamSize: (template as any).teamSize ?? getDefaultTeamSize(mappedSize, serviceType),
      notes: notes ?? template.notes ?? undefined,
      status: 'APPOINTED',
      lineage: 'single',
      aiCreated: false,
      conversationSessionId: activeSession.id,
      bookingScreenshotUrls,
    },
    include: {
      client: true,
      employees: true,
      admin: true,
      payrollItems: { include: { extras: true } },
    },
  })

  return {
    success: true as const,
    appointment: appt,
    client,
    template,
    sessionId: activeSession.id,
    message: 'Appointment created successfully',
  }
}

function parseDateStringUTC(dateStr: string): Date {
  const dateParts = dateStr.split('-')
  if (dateParts.length !== 3) throw new Error('Invalid date format. Use YYYY-MM-DD')
  const dt = new Date(
    Date.UTC(
      parseInt(dateParts[0]),
      parseInt(dateParts[1]) - 1,
      parseInt(dateParts[2]),
    ),
  )
  if (Number.isNaN(dt.getTime())) throw new Error('Invalid date')
  return dt
}

/**
 * Honor X-Messaging-Mock-Sms when safe. Local `npm run dev` often leaves NODE_ENV unset,
 * so we must not require NODE_ENV === 'development' only.
 * Production: deny unless ALLOW_MESSAGING_MOCK_SMS=1.
 */
function allowsClientMessagingMockSms(): boolean {
  if (process.env.ALLOW_MESSAGING_MOCK_SMS === '1') return true
  if (process.env.NODE_ENV === 'production') return false
  return true
}

export async function listConversations(req: Request, res: Response) {
  try {
    const userId = parseUserIdHeader(req.headers['x-user-id'])
    const limit = clampInboxLimit(req.query.limit)
    const q = typeof req.query.q === 'string' ? req.query.q : undefined
    const cursorDecoded = decodeInboxCursor(req.query.cursor)
    const offset = cursorDecoded?.o ?? 0

    const searchWhere = inboxSearchWhere(q)
    const rawStatus = typeof req.query.status === 'string' ? req.query.status.trim().toUpperCase() : 'OPEN'
    const convStatus = rawStatus === 'ARCHIVED' ? ConversationStatus.ARCHIVED : ConversationStatus.OPEN
    const baseWhere: Prisma.ConversationWhereInput = { status: convStatus }
    const where: Prisma.ConversationWhereInput = searchWhere ? { AND: [baseWhere, searchWhere] } : baseWhere

    const take = limit + 1
    const rows = await prisma.conversation.findMany({
      where,
      orderBy: [
        { lastMessageAt: { sort: 'desc', nulls: 'last' } },
        { id: 'desc' },
      ],
      skip: offset,
      take,
      include: {
        contactPoint: true,
        client: true,
        sessions: {
          where: { closedAt: null },
          orderBy: { openedAt: 'desc' },
          take: 1,
        },
        messages: {
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 1,
          select: { id: true, body: true, mediaCount: true, direction: true },
        },
        ...(userId != null
          ? {
              userReads: {
                where: { userId },
                take: 1,
                select: { lastReadMessageId: true },
              },
            }
          : {}),
      },
    })

    const hasMore = rows.length > limit
    const page = hasMore ? rows.slice(0, limit) : rows
    const nextCursor = hasMore ? encodeInboxCursor(offset + limit) : null

    res.json({
      items: mapConversationsToInboxDto(page as any),
      nextCursor,
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to list conversations' })
  }
}

export async function getConversationDetail(req: Request, res: Response) {
  const id = parseInt(req.params.id, 10)
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid id' })
  }
  try {
    const c = await prisma.conversation.findUnique({
      where: { id },
      include: {
        contactPoint: true,
        client: true,
        sessions: {
          orderBy: { openedAt: 'desc' },
          include: {
            appointments: {
              select: {
                id: true,
                date: true,
                time: true,
                address: true,
                status: true,
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            media: { orderBy: { sortOrder: 'asc' } },
          },
        },
      },
    })
    if (!c) {
      return res.status(404).json({ error: 'Not found' })
    }

    const senderIds = [...new Set(c.messages.map((m) => m.userId).filter((x): x is number => x != null))]
    const senders =
      senderIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: senderIds } },
            select: { id: true, messageBubbleColor: true },
          })
        : []
    const bubbleByUserId = new Map(senders.map((u) => [u.id, u.messageBubbleColor]))

    const dto: ConversationDetailDto = {
      conversation: {
        id: c.id,
        channel: c.channel,
        status: c.status,
        businessNumber: c.businessNumber,
        lastMessageAt: c.lastMessageAt?.toISOString() ?? null,
        openedAt: c.openedAt.toISOString(),
        archivedAt: c.archivedAt?.toISOString() ?? null,
        clientId: c.clientId,
      },
      contactPoint: {
        id: c.contactPoint.id,
        type: c.contactPoint.type,
        value: c.contactPoint.value,
        displayValue: c.contactPoint.displayValue,
        clientId: c.contactPoint.clientId,
      },
      client: c.client
        ? {
            id: c.client.id,
            name: c.client.name,
            number: c.client.number,
            notes: c.client.notes ?? null,
          }
        : null,
      sessions: c.sessions.map((s) => ({
        id: s.id,
        openedAt: s.openedAt.toISOString(),
        closedAt: s.closedAt?.toISOString() ?? null,
        closeReason: s.closeReason,
        summary: s.summary,
        bookingIntent: s.bookingIntent,
        confidence: s.confidence,
        appointments: s.appointments.map((a) => ({
          id: a.id,
          date: a.date.toISOString(),
          time: a.time,
          address: a.address,
          status: a.status,
        })),
      })),
      messages: c.messages.map((m) => ({
        id: m.id,
        direction: m.direction,
        senderType: m.senderType,
        body: m.body,
        status: m.status,
        createdAt: m.createdAt.toISOString(),
        userId: m.userId,
        senderBubbleColor: m.userId != null ? bubbleByUserId.get(m.userId) ?? null : null,
        sessionId: m.sessionId,
        mediaCount: m.mediaCount,
        media: m.media.map((x) => ({
          id: x.id,
          publicUrl: x.publicUrl,
          mimeType: x.mimeType,
          fileName: x.fileName,
          fileSize: x.fileSize,
          width: x.width,
          height: x.height,
          sortOrder: x.sortOrder,
        })),
      })),
    }

    res.json(dto)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to load conversation' })
  }
}

const parseUserId = parseUserIdHeader

const PRESENCE_TTL_MS = 45_000

/** Mark conversation read through latest message; clears Pushover throttle for this thread */
export async function postMarkConversationRead(req: Request, res: Response) {
  const id = parseInt(req.params.id, 10)
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid id' })
  }
  const userId = parseUserId(req.headers['x-user-id'])
  if (userId == null) {
    return res.status(400).json({ error: 'x-user-id header required' })
  }
  try {
    const latest = await prisma.message.findFirst({
      where: { conversationId: id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true },
    })
    await prisma.$transaction([
      prisma.userConversationRead.upsert({
        where: {
          userId_conversationId: { userId, conversationId: id },
        },
        create: {
          userId,
          conversationId: id,
          lastReadMessageId: latest?.id ?? null,
        },
        update: {
          lastReadMessageId: latest?.id ?? null,
        },
      }),
      prisma.conversation.update({
        where: { id },
        data: { lastPushoverNotifiedAt: null },
      }),
    ])
    res.json({ ok: true, lastReadMessageId: latest?.id ?? null })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to mark read' })
  }
}

/** Clear presence when tab hidden / navigation — allows Pushover + accurate unread */
export async function deleteConversationPresence(req: Request, res: Response) {
  const id = parseInt(req.params.id, 10)
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid id' })
  }
  const userId = parseUserId(req.headers['x-user-id'])
  if (userId == null) {
    return res.status(400).json({ error: 'x-user-id header required' })
  }
  try {
    await prisma.conversationPresence.deleteMany({
      where: { conversationId: id, userId },
    })
    res.json({ ok: true })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to clear presence' })
  }
}

/** Heartbeat: viewer is on this thread — suppress Pushover + optional auto-read */
export async function postConversationPresence(req: Request, res: Response) {
  const id = parseInt(req.params.id, 10)
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid id' })
  }
  const userId = parseUserId(req.headers['x-user-id'])
  if (userId == null) {
    return res.status(400).json({ error: 'x-user-id header required' })
  }
  const expiresAt = new Date(Date.now() + PRESENCE_TTL_MS)
  try {
    await prisma.conversationPresence.upsert({
      where: {
        userId_conversationId: { userId, conversationId: id },
      },
      create: {
        userId,
        conversationId: id,
        expiresAt,
      },
      update: {
        expiresAt,
      },
    })
    res.json({ ok: true, expiresAt: expiresAt.toISOString() })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to update presence' })
  }
}

export async function postOutboundMessage(req: Request, res: Response) {
  const id = parseInt(req.params.id, 10)
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid id' })
  }

  const contentType = String(req.headers['content-type'] ?? '')
  const fromMultipart = contentType.includes('multipart/form-data')
  const multerFiles = (req as Request & { files?: Express.Multer.File[] }).files
  const fileList = Array.isArray(multerFiles) ? multerFiles : []

  let bodyText = ''
  let userId: number | null = null

  if (fromMultipart) {
    const b = (req.body as { body?: string; userId?: unknown })?.body
    bodyText = typeof b === 'string' ? b : ''
    userId = parseUserId((req.body as { userId?: unknown })?.userId)
  } else {
    const { body, userId: uid } = req.body as { body?: string; userId?: number }
    bodyText = typeof body === 'string' ? body : ''
    userId = uid ?? null
  }

  const trimmed = bodyText.trim()
  if (!trimmed && fileList.length === 0) {
    return res.status(400).json({ error: 'body or at least one image (media) is required' })
  }

  if (fileList.length > 0 && !isSupabaseStorageConfigured()) {
    return res.status(503).json({
      error:
        'Image upload requires Supabase Storage (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_STORAGE_BUCKET)',
    })
  }

  try {
    const mockRequested = req.get('x-messaging-mock-sms') === '1'
    const useMockTransport = mockRequested && allowsClientMessagingMockSms()

    const outboundMedia: OutboundMediaReady[] = []
    for (let i = 0; i < fileList.length; i++) {
      const f = fileList[i]
      const mime = f.mimetype || 'application/octet-stream'
      const ext = extensionForMime(mime)
      const storageKey = `messaging/outbound/${id}/${randomUUID()}.${ext}`
      const uploaded = await uploadBufferToMessaging(storageKey, f.buffer, mime)
      outboundMedia.push({
        storageKey: uploaded.storageKey,
        publicUrl: uploaded.publicUrl,
        mimeType: mime,
        fileName: f.originalname || null,
        fileSize: f.size,
      })
    }

    const result = await sendOutboundSms(prisma, {
      conversationId: id,
      body: bodyText,
      userId,
      outboundMedia,
      transport: useMockTransport ? new MockSmsTransport() : undefined,
    })
    const msg = await prisma.message.findUnique({
      where: { id: result.messageId },
      include: { media: { orderBy: { sortOrder: 'asc' } } },
    })
    res.json({
      message: msg,
      sessionId: result.sessionId,
      transport: result.transport,
    })
  } catch (e: any) {
    console.error(e)
    res.status(400).json({ error: e?.message ?? 'Send failed' })
  }
}

export async function postInboundWebhook(req: Request, res: Response) {
  try {
    const out = await ingestInboundSms(prisma, req.body as any)
    res.json({ ok: true, ...out })
  } catch (e: any) {
    console.error(e)
    res.status(400).json({ error: e?.message ?? 'Inbound ingest failed' })
  }
}

export async function postStartConversationFromContact(req: Request, res: Response) {
  const { phoneRaw, name, notes, clientFrom } = req.body as {
    phoneRaw?: string
    name?: string | null
    notes?: string | null
    clientFrom?: string | null
  }
  if (!phoneRaw || typeof phoneRaw !== 'string') {
    return res.status(400).json({ error: 'phoneRaw is required' })
  }
  try {
    const out = await startConversationFromContact(prisma, { phoneRaw, name, notes, clientFrom })
    res.status(201).json(out)
  } catch (e: any) {
    console.error(e)
    res.status(400).json({ error: e?.message ?? 'Failed to start conversation' })
  }
}

export async function patchConversationClient(req: Request, res: Response) {
  const id = parseInt(req.params.id, 10)
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid id' })
  }
  const { name, notes } = req.body as { name?: string | null; notes?: string | null }
  try {
    const out = await updateClientForConversation(prisma, id, { name, notes })
    res.json(out)
  } catch (e: any) {
    console.error(e)
    res.status(400).json({ error: e?.message ?? 'Failed to update contact' })
  }
}

export async function patchConversationStatus(req: Request, res: Response) {
  const id = parseInt(req.params.id, 10)
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid id' })
  }
  const userId = parseUserIdHeader(req.headers['x-user-id'])
  if (userId == null) {
    return res.status(400).json({ error: 'x-user-id header required' })
  }
  const { status } = req.body as { status?: string }
  if (status !== 'OPEN' && status !== 'ARCHIVED') {
    return res.status(400).json({ error: 'status must be OPEN or ARCHIVED' })
  }
  try {
    await prisma.conversation.update({
      where: { id },
      data: buildConversationStatusUpdateData(status, new Date()),
    })
    res.json({ ok: true, status })
  } catch (e: unknown) {
    console.error(e)
    res.status(400).json({ error: e instanceof Error ? e.message : 'Failed to update conversation' })
  }
}

export async function postMockAppointmentExtraction(req: Request, res: Response) {
  const sessionId = parseInt(req.params.sessionId, 10)
  if (Number.isNaN(sessionId)) {
    return res.status(400).json({ error: 'Invalid session id' })
  }
  try {
    const extraction = await generateMockAppointmentExtraction(prisma, sessionId)
    res.json(extraction)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Extraction failed' })
  }
}

export async function postExtractAppointmentFromConversation(req: Request, res: Response) {
  const conversationId = parseInt(req.params.id, 10)
  if (Number.isNaN(conversationId)) {
    return res.status(400).json({ error: 'Invalid id' })
  }
  const userId = parseUserIdHeader(req.headers['x-user-id'])
  if (userId == null) {
    return res.status(400).json({ error: 'x-user-id header required' })
  }
  try {
    const result = await extractAppointmentForConversation(prisma, conversationId)
    res.json(result)
  } catch (e: unknown) {
    console.error(e)
    const msg = e instanceof Error ? e.message : 'Extraction failed'
    res.status(400).json({ error: msg })
  }
}

export async function postExtractAppointmentFromConversationImages(req: Request, res: Response) {
  const conversationId = parseInt(req.params.id, 10)
  if (Number.isNaN(conversationId)) {
    return res.status(400).json({ error: 'Invalid id' })
  }
  const userId = parseUserIdHeader(req.headers['x-user-id'])
  if (userId == null) {
    return res.status(400).json({ error: 'x-user-id header required' })
  }
  const multerFiles = (req as Request & { files?: Express.Multer.File[] }).files
  const fileList = Array.isArray(multerFiles) ? multerFiles : []
  if (fileList.length === 0) {
    return res.status(400).json({ error: 'At least one image is required (field name: images)' })
  }
  try {
    const result = await extractAppointmentFromConversationImages(prisma, conversationId, fileList)
    res.json(result)
  } catch (e: unknown) {
    console.error(e)
    const msg = e instanceof Error ? e.message : 'Extraction failed'
    res.status(400).json({ error: msg })
  }
}

export async function postMessagingTranslate(req: Request, res: Response) {
  const { text } = req.body as { text?: string }
  if (typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'text is required' })
  }
  try {
    const translatedText = await translateEnToPt(text)
    res.json({ translatedText })
  } catch (e: unknown) {
    console.error(e)
    const msg = e instanceof Error ? e.message : 'Translation failed'
    res.status(400).json({ error: msg })
  }
}

export async function postMessagingInboxLease(req: Request, res: Response) {
  const userId = parseUserIdHeader(req.headers['x-user-id'])
  if (userId == null) {
    return res.status(400).json({ error: 'x-user-id required' })
  }
  const { tabId, force } = req.body as { tabId?: string; force?: boolean }
  try {
    const out = await acquireOrRenewInboxLock(prisma, { userId, tabId, force: Boolean(force) })
    if (!out.ok) {
      return res.status(409).json({
        error: 'Messaging inbox is in use',
        holderUserId: out.holderUserId,
        leaseUntil: out.leaseUntil,
      })
    }
    res.json({ ok: true })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Lease failed' })
  }
}

export async function deleteMessagingInboxLease(req: Request, res: Response) {
  const userId = parseUserIdHeader(req.headers['x-user-id'])
  if (userId == null) {
    return res.status(400).json({ error: 'x-user-id required' })
  }
  try {
    await releaseInboxLock(prisma, { userId })
    res.json({ ok: true })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Release failed' })
  }
}

export async function postBookAppointmentFromConversation(req: Request, res: Response) {
  const conversationId = parseInt(req.params.id, 10)
  if (Number.isNaN(conversationId)) {
    return res.status(400).json({ error: 'Invalid id' })
  }
  const adminId = parseUserIdHeader(req.headers['x-user-id'])
  if (adminId == null) {
    return res.status(400).json({ error: 'x-user-id header required' })
  }

  try {
    const {
      clientName,
      appointmentAddress,
      price,
      date,
      time,
      notes,
      size,
      serviceType,
    } = req.body as {
      clientName?: string
      appointmentAddress?: string
      price?: number
      date?: string
      time?: string
      notes?: string
      size?: string
      serviceType?: string
    }
    const bookingScreenshotUrls = parseBookingScreenshotUrlsFromBody(req.body)

    if (!appointmentAddress || price == null || !date || !time || !size || !serviceType) {
      return res.status(400).json({
        error:
          'Missing required fields: appointmentAddress, price, date, time, size, serviceType',
      })
    }

    const out = await executeBookAppointmentCore(conversationId, adminId, {
      clientName,
      appointmentAddress,
      price,
      date,
      time,
      notes,
      size,
      serviceType,
      bookingScreenshotUrls,
    })
    return res.json(out)
  } catch (e: any) {
    if (e?.message === 'SAME_DAY_APPOINT' && e?.status === 409) {
      return res.status(409).json({
        error: 'SAME_DAY_APPOINT',
        message: 'Client already has an appointment on this date',
        existingAppointment: e.existingAppointment,
      })
    }
    if (e?.message === 'Conversation not found') {
      return res.status(404).json({ error: 'Not found' })
    }
    if (
      e?.message?.includes('Invalid size') ||
      e?.message === 'Conversation phone is invalid' ||
      e?.message === 'clientName is required when no client is linked'
    ) {
      return res.status(400).json({ error: e.message })
    }
    console.error(e)
    return res.status(500).json({ error: e?.message ?? 'Booking failed' })
  }
}

/** Book from screenshot flow: resolve / create client by phone, then same appointment pipeline. */
export async function postBookAppointmentFromScreenshot(req: Request, res: Response) {
  const adminId = parseUserIdHeader(req.headers['x-user-id'])
  if (adminId == null) {
    return res.status(400).json({ error: 'x-user-id header required' })
  }

  const {
    phoneRaw,
    clientName,
    appointmentAddress,
    price,
    date,
    time,
    notes,
    size,
    serviceType,
  } = req.body as {
    phoneRaw?: string
    clientName?: string
    appointmentAddress?: string
    price?: number
    date?: string
    time?: string
    notes?: string
    size?: string
    serviceType?: string
  }
  const bookingScreenshotUrls = parseBookingScreenshotUrlsFromBody(req.body)

  if (!phoneRaw || typeof phoneRaw !== 'string' || !phoneRaw.trim()) {
    return res.status(400).json({ error: 'phoneRaw is required' })
  }
  if (!clientName?.trim()) {
    return res.status(400).json({ error: 'clientName is required' })
  }
  if (!appointmentAddress || price == null || !date || !time || !size || !serviceType) {
    return res.status(400).json({
      error:
        'Missing required fields: appointmentAddress, price, date, time, size, serviceType',
    })
  }

  try {
    const { conversationId } = await startConversationFromContact(prisma, {
      phoneRaw: phoneRaw.trim(),
      name: clientName.trim(),
      notes: null,
    })
    const out = await executeBookAppointmentCore(conversationId, adminId, {
      clientName: clientName.trim(),
      appointmentAddress,
      price,
      date,
      time,
      notes,
      size,
      serviceType,
      bookingScreenshotUrls,
    })
    return res.json(out)
  } catch (e: any) {
    if (e?.message === 'SAME_DAY_APPOINT' && e?.status === 409) {
      return res.status(409).json({
        error: 'SAME_DAY_APPOINT',
        message: 'Client already has an appointment on this date',
        existingAppointment: e.existingAppointment,
      })
    }
    if (
      e?.message?.includes('Invalid size') ||
      e?.message === 'Conversation phone is invalid' ||
      e?.message === 'clientName is required when no client is linked'
    ) {
      return res.status(400).json({ error: e.message })
    }
    console.error(e)
    return res.status(400).json({ error: e?.message ?? 'Booking failed' })
  }
}

export async function postExtractAppointmentFromStandaloneImages(req: Request, res: Response) {
  const userId = parseUserIdHeader(req.headers['x-user-id'])
  if (userId == null) {
    return res.status(400).json({ error: 'x-user-id header required' })
  }
  const multerFiles = (req as Request & { files?: Express.Multer.File[] }).files
  const fileList = Array.isArray(multerFiles) ? multerFiles : []
  let reuseParsed: Array<{ publicUrl: string; storageKey?: string }> = []
  const rawReuse = (req as Request & { body?: { reuse?: string } }).body?.reuse
  if (typeof rawReuse === 'string' && rawReuse.trim()) {
    try {
      const j = JSON.parse(rawReuse) as unknown
      if (Array.isArray(j)) {
        reuseParsed = j.filter(
          (x): x is { publicUrl: string; storageKey?: string } =>
            Boolean(x && typeof x === 'object' && typeof (x as { publicUrl?: string }).publicUrl === 'string'),
        )
      }
    } catch {
      /* ignore invalid reuse */
    }
  }
  if (fileList.length === 0 && reuseParsed.length === 0) {
    return res.status(400).json({ error: 'At least one image is required (field name: images)' })
  }
  try {
    const result = await extractAppointmentFromStandaloneImages(fileList, reuseParsed)
    res.json(result)
  } catch (e: unknown) {
    console.error(e)
    const msg = e instanceof Error ? e.message : 'Extraction failed'
    res.status(400).json({ error: msg })
  }
}

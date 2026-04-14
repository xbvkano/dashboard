import { randomUUID } from 'crypto'
import type { PrismaClient } from '@prisma/client'
import { formatMessagesTranscript } from './transcript'
import { extractAppointmentFromImageUrls, extractAppointmentFromTranscript } from './openaiExtraction'
import {
  collectMissingRequiredFields,
  rawAiToDraft,
} from './normalizeDraft'
import { lookupSizeBucketFromAddress } from './rentCast'
import {
  appendRentcastSizeNoteToDraftNotes,
  finalizeExtractionNotFoundNotes,
} from './extractionNotFoundNotes'
import type { ExtractAppointmentResult, ExtractionFieldKey, FieldHighlightReason } from './types'
import {
  deleteAppointmentStorageKeys,
  isAppointmentBucketConfigured,
  uploadBufferToAppointmentBucket,
} from '../supabaseAppointmentStorage'
import {
  buildPermanentAppointmentImageKey,
  buildTempOpenAiImageKey,
  clientFolderFromExtractedContact,
  dayFolderFromDraft,
  sanitizePathSegment,
} from './pathUtils'
import type { Express } from 'express'

export async function extractAppointmentForConversation(
  prisma: PrismaClient,
  conversationId: number,
): Promise<ExtractAppointmentResult> {
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
      client: true,
      contactPoint: true,
    },
  })

  if (!conv) {
    throw new Error('Conversation not found')
  }

  const transcript = formatMessagesTranscript(conv.messages)
  if (!transcript.trim()) {
    throw new Error('No messages in conversation to extract from')
  }

  const raw = await extractAppointmentFromTranscript(transcript)
  let draft = rawAiToDraft(raw)
  const clientLinked = Boolean(conv.clientId && conv.client)

  let sizeSource: 'thread' | 'rentcast' | null = draft.size ? 'thread' : null
  let rentcastAttempted = false
  let rentcastSuccess = false
  const addr = draft.appointmentAddress?.trim() ?? ''
  const hasRentcastKey = Boolean(process.env.RENTCAST_API_KEY?.trim())

  if (!draft.size && addr && hasRentcastKey) {
    rentcastAttempted = true
    const bucket = await lookupSizeBucketFromAddress(addr)
    if (bucket) {
      draft = {
        ...draft,
        size: bucket,
        notes: appendRentcastSizeNoteToDraftNotes(draft.notes),
      }
      sizeSource = 'rentcast'
      rentcastSuccess = true
    }
  }

  const missing = collectMissingRequiredFields(draft, { clientLinked })

  const sizeLookupFailed =
    missing.includes('size') && rentcastAttempted && !rentcastSuccess && Boolean(addr)

  const notFoundNotes = finalizeExtractionNotFoundNotes(
    [...(raw.missingOrUncertain ?? [])].filter(Boolean) as string[],
    {
      hasRentcastKey,
      rentcastAttempted,
      rentcastSuccess,
      hadAddress: Boolean(addr),
      sizeLookupFailed,
    },
  )

  const fieldHighlights = buildFieldHighlights(missing, {
    rentcastAttempted,
    rentcastSuccess,
    hadAddress: Boolean(addr),
  })

  return {
    draft,
    missingRequiredFields: missing,
    notFoundNotes,
    sizeSource,
    sizeLookupFailed,
    fieldHighlights,
  }
}

function buildFieldHighlights(
  missing: ExtractionFieldKey[],
  ctx: {
    rentcastAttempted: boolean
    rentcastSuccess: boolean
    hadAddress: boolean
  },
): Partial<Record<ExtractionFieldKey, FieldHighlightReason>> {
  const out: Partial<Record<ExtractionFieldKey, FieldHighlightReason>> = {}
  for (const f of missing) {
    if (f === 'size') {
      if (ctx.rentcastAttempted && !ctx.rentcastSuccess && ctx.hadAddress) {
        out.size = 'lookup_failed'
      } else {
        out.size = 'ai_missing'
      }
    } else {
      out[f] = 'ai_missing'
    }
  }
  return out
}

export type ImageFile = Pick<Express.Multer.File, 'buffer' | 'mimetype' | 'originalname'>

/**
 * Upload to `temp/openai/…` for vision, run OpenAI, then copy to `appointments/…` and delete temp.
 * `reuseImages` are already stored — their public URLs are passed to vision; they are not re-uploaded.
 * If the bucket is not configured, uses data URLs for new files in vision (storedImages may omit new uploads).
 */
type PermanentPlacement = { kind: 'conversation'; clientFolder: string } | { kind: 'standalone' }

async function extractFromImageFilesWithTempThenPermanent(
  newFiles: ImageFile[],
  reuseImages: Array<{ publicUrl: string; storageKey?: string }> | undefined,
  permanentPlacement: PermanentPlacement,
  collectMissingOptions: { clientLinked: boolean; requireClientPhone?: boolean },
): Promise<ExtractAppointmentResult> {
  const reuse = reuseImages ?? []
  const runId = randomUUID()
  const tempKeys: string[] = []
  const visionUrls: string[] = []

  try {
    if (isAppointmentBucketConfigured()) {
      for (const r of reuse) {
        visionUrls.push(r.publicUrl)
      }
      for (const f of newFiles) {
        const tempKey = buildTempOpenAiImageKey({
          runId,
          mimeType: f.mimetype || 'application/octet-stream',
        })
        const uploaded = await uploadBufferToAppointmentBucket(
          tempKey,
          f.buffer,
          f.mimetype || 'application/octet-stream',
        )
        tempKeys.push(uploaded.storageKey)
        visionUrls.push(uploaded.publicUrl)
      }
    } else {
      for (const r of reuse) {
        visionUrls.push(r.publicUrl)
      }
      for (const f of newFiles) {
        const mime = f.mimetype || 'image/jpeg'
        visionUrls.push(`data:${mime};base64,${f.buffer.toString('base64')}`)
      }
    }

    const totalCount = reuse.length + newFiles.length
    if (visionUrls.length !== totalCount) {
      throw new Error('Vision URL count mismatch')
    }

    const raw = await extractAppointmentFromImageUrls(visionUrls)

    let draft = rawAiToDraft(raw)
    let sizeSource: 'thread' | 'rentcast' | null = draft.size ? 'thread' : null
    let rentcastAttempted = false
    let rentcastSuccess = false
    const addr = draft.appointmentAddress?.trim() ?? ''
    const hasRentcastKey = Boolean(process.env.RENTCAST_API_KEY?.trim())

    if (!draft.size && addr && hasRentcastKey) {
      rentcastAttempted = true
      const bucket = await lookupSizeBucketFromAddress(addr)
      if (bucket) {
        draft = {
          ...draft,
          size: bucket,
          notes: appendRentcastSizeNoteToDraftNotes(draft.notes),
        }
        sizeSource = 'rentcast'
        rentcastSuccess = true
      }
    }

    const missing = collectMissingRequiredFields(draft, collectMissingOptions)

    const sizeLookupFailed =
      missing.includes('size') && rentcastAttempted && !rentcastSuccess && Boolean(addr)

    const notFoundNotes = finalizeExtractionNotFoundNotes(
      [...(raw.missingOrUncertain ?? [])].filter(Boolean) as string[],
      {
        hasRentcastKey,
        rentcastAttempted,
        rentcastSuccess,
        hadAddress: Boolean(addr),
        sizeLookupFailed,
      },
    )

    const fieldHighlights = buildFieldHighlights(missing, {
      rentcastAttempted,
      rentcastSuccess,
      hadAddress: Boolean(addr),
    })

    const dayFolder = dayFolderFromDraft(draft)
    const clientFolder =
      permanentPlacement.kind === 'conversation'
        ? permanentPlacement.clientFolder
        : clientFolderFromExtractedContact(draft)

    const storedImages: Array<{ storageKey: string; publicUrl: string }> = []
    if (isAppointmentBucketConfigured()) {
      for (const r of reuse) {
        storedImages.push({
          publicUrl: r.publicUrl,
          storageKey: r.storageKey?.trim() ? r.storageKey : '',
        })
      }
      for (const f of newFiles) {
        const key = buildPermanentAppointmentImageKey({
          clientFolder,
          dayFolder,
          mimeType: f.mimetype || 'application/octet-stream',
        })
        const uploaded = await uploadBufferToAppointmentBucket(
          key,
          f.buffer,
          f.mimetype || 'application/octet-stream',
        )
        storedImages.push({ storageKey: uploaded.storageKey, publicUrl: uploaded.publicUrl })
      }
      if (tempKeys.length) {
        await deleteAppointmentStorageKeys(tempKeys)
      }
    } else {
      for (const r of reuse) {
        storedImages.push({
          publicUrl: r.publicUrl,
          storageKey: r.storageKey?.trim() ? r.storageKey : '',
        })
      }
    }

    return {
      draft,
      missingRequiredFields: missing,
      notFoundNotes,
      sizeSource,
      sizeLookupFailed,
      fieldHighlights,
      storedImages: storedImages.length ? storedImages : undefined,
    }
  } catch (e) {
    if (tempKeys.length) {
      await deleteAppointmentStorageKeys(tempKeys).catch(() => {})
    }
    throw e
  }
}

export async function extractAppointmentFromConversationImages(
  prisma: PrismaClient,
  conversationId: number,
  files: ImageFile[],
): Promise<ExtractAppointmentResult> {
  if (!files.length) {
    throw new Error('At least one image is required')
  }

  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { client: true, contactPoint: true },
  })
  if (!conv) {
    throw new Error('Conversation not found')
  }

  const clientLinked = Boolean(conv.clientId && conv.client)
  const phoneDisplay = conv.contactPoint.displayValue ?? conv.contactPoint.value ?? 'unknown'
  const clientFolder = sanitizePathSegment(conv.client?.name ?? phoneDisplay)

  return extractFromImageFilesWithTempThenPermanent(
    files,
    undefined,
    { kind: 'conversation', clientFolder },
    { clientLinked },
  )
}

/**
 * Screenshots from chats outside the CRM — no conversation. Assume unlinked client;
 * extraction should infer clientName and clientPhone when possible.
 */
export async function extractAppointmentFromStandaloneImages(
  files: ImageFile[],
  reuse?: Array<{ publicUrl: string; storageKey?: string }>,
): Promise<ExtractAppointmentResult> {
  const reuseList = reuse ?? []
  if (!files.length && !reuseList.length) {
    throw new Error('At least one image is required')
  }

  return extractFromImageFilesWithTempThenPermanent(
    files,
    reuseList.length ? reuseList : undefined,
    { kind: 'standalone' },
    { clientLinked: false, requireClientPhone: true },
  )
}

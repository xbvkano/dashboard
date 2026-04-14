import { randomUUID } from 'crypto'
import { extensionForMime } from '../messaging/twilioInboundMedia'

/** YYYY-MM-DD in UTC */
export function utcDateFolder(d = new Date()): string {
  return d.toISOString().slice(0, 10)
}

/** Prefer appointment date from draft when valid YYYY-MM-DD; otherwise today (UTC). */
export function dayFolderFromDraft(draft: { date?: string | null }): string {
  const raw = draft.date?.trim()
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  return utcDateFolder()
}

/**
 * Safe single path segment for Supabase object keys (client folder name).
 */
export function sanitizePathSegment(raw: string): string {
  const s = raw
    .replace(/[/\\]/g, '-')
    .replace(/[^\p{L}\p{N}\s._-]/gu, '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 80)
  return s.length > 0 ? s : 'unknown'
}

/** Standalone screenshot flow: folder name from AI — client name, else phone, else `unknown`. */
export function clientFolderFromExtractedContact(draft: {
  clientName?: string | null
  clientPhone?: string | null
}): string {
  const name = draft.clientName?.trim()
  const phone = draft.clientPhone?.trim()
  return sanitizePathSegment(name || phone || 'unknown')
}

/** Transient objects for OpenAI vision — deleted after extraction. */
export function buildTempOpenAiImageKey(params: { runId: string; mimeType: string }): string {
  const ext = extensionForMime(params.mimeType)
  const id = randomUUID()
  return `temp/openai/${params.runId}/${id}.${ext}`
}

/** Long-lived booking screenshots: `appointments/{YYYY-MM-DD}/{client}/photos/{uuid}.ext` */
export function buildPermanentAppointmentImageKey(params: {
  clientFolder: string
  dayFolder: string
  mimeType: string
}): string {
  const ext = extensionForMime(params.mimeType)
  const id = randomUUID()
  return `appointments/${params.dayFolder}/${params.clientFolder}/photos/${id}.${ext}`
}

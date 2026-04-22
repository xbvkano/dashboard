/**
 * Appointment screenshot uploads — separate bucket from CRM messaging MMS.
 * Public URLs are used for OpenAI vision and Twilio-style fetch patterns.
 *
 * Object layout:
 * - `temp/openai/{runId}/…` — short-lived; deleted after vision extraction completes.
 * - `appointments/{YYYY-MM-DD}/{client}/photos/…` — date folder from appointment date; client from CRM contact or extracted name/phone; retained for the booking record.
 */
import { randomUUID } from 'crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

export function isAppointmentBucketConfigured(): boolean {
  const url = process.env.SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  const bucket = process.env.SUPABASE_STORAGE_BUCKET_APPOINTMENT?.trim()
  return Boolean(url && key && bucket)
}

function getClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) {
    throw new Error(
      'Supabase is not configured (set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for appointment uploads)',
    )
  }
  if (!client) {
    client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  }
  return client
}

export function getAppointmentStorageBucket(): string {
  const b = process.env.SUPABASE_STORAGE_BUCKET_APPOINTMENT?.trim()
  if (!b) throw new Error('SUPABASE_STORAGE_BUCKET_APPOINTMENT is not set')
  return b
}

function storageErrorHint(bucket: string, message: string): string {
  const m = message.toLowerCase()
  if (!m.includes('bucket') || !m.includes('found')) return ''
  return (
    ` Bucket id "${bucket}" must match Supabase Dashboard → Storage exactly (case-sensitive). ` +
    `Confirm SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are from the same project as that bucket.`
  )
}

export type AppointmentUploadedObject = {
  storageKey: string
  publicUrl: string
}

export async function uploadBufferToAppointmentBucket(
  storageKey: string,
  buffer: Buffer,
  contentType: string,
  options?: { cacheControl?: string },
): Promise<AppointmentUploadedObject> {
  const supabase = getClient()
  const bucket = getAppointmentStorageBucket()
  const { error } = await supabase.storage.from(bucket).upload(storageKey, buffer, {
    contentType,
    upsert: false,
    cacheControl: options?.cacheControl ?? '3600',
  })
  if (error) {
    const hint = storageErrorHint(bucket, error.message)
    throw new Error(`Supabase appointment upload failed: ${error.message}.${hint}`)
  }
  const { data } = supabase.storage.from(bucket).getPublicUrl(storageKey)
  const publicUrl = data.publicUrl
  if (!publicUrl) {
    throw new Error('Supabase getPublicUrl returned no URL; ensure the appointment bucket allows public read')
  }
  return { storageKey, publicUrl }
}

export async function downloadBufferFromAppointmentBucket(
  storageKey: string,
): Promise<{ buffer: Buffer; contentType: string }> {
  const supabase = getClient()
  const bucket = getAppointmentStorageBucket()

  const { data, error } = await supabase.storage.from(bucket).download(storageKey)
  if (error || !data) {
    const msg = error?.message ?? 'download returned empty data'
    throw new Error(`Supabase appointment download failed: ${msg}`)
  }

  // supabase-js returns a Blob in Node. Convert to Buffer.
  const arrayBuffer = await data.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const contentType =
    // Blob.type is best-effort; may be empty depending on runtime.
    (typeof (data as any).type === 'string' && (data as any).type.trim()) || 'application/octet-stream'

  return { buffer, contentType }
}

export async function deleteAppointmentStorageKeys(storageKeys: string[]): Promise<void> {
  if (storageKeys.length === 0) return
  const supabase = getClient()
  const bucket = getAppointmentStorageBucket()
  const { error } = await supabase.storage.from(bucket).remove(storageKeys)
  if (error) {
    console.warn(
      `[supabase-appointment] remove ${storageKeys.length} object(s) failed: ${error.message}. ` +
        `You may need to delete temp/ keys manually in the dashboard.`,
    )
  }
}

async function probeAppointmentBucketAnonymousRead(supabase: SupabaseClient, bucket: string): Promise<void> {
  if (process.env.NODE_ENV === 'test' || process.env.APPOINTMENT_SKIP_BUCKET_PUBLIC_CHECK === '1') {
    return
  }
  if (typeof fetch !== 'function') return
  const key = `temp/health-check/${randomUUID()}.txt`
  const probe = Buffer.from('ok', 'utf8')
  const { error: upErr } = await supabase.storage.from(bucket).upload(key, probe, {
    contentType: 'text/plain',
    upsert: true,
    cacheControl: '60',
  })
  if (upErr) {
    console.warn(`[supabase-appointment] Health-check upload failed: ${upErr.message}`)
    return
  }
  const { data } = supabase.storage.from(bucket).getPublicUrl(key)
  const url = data.publicUrl
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow' })
    if (!res.ok) {
      console.warn(
        `[supabase-appointment] Anonymous HEAD returned HTTP ${res.status} for ${url.slice(0, 80)}… ` +
          `OpenAI vision needs public read. Enable **Public bucket** or anon SELECT on storage.objects.`,
      )
    } else {
      console.log(`[supabase-appointment] Public read probe OK`)
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn(`[supabase-appointment] Public read probe failed: ${msg}`)
  } finally {
    await supabase.storage.from(bucket).remove([key]).catch(() => {})
  }
}

export async function verifySupabaseAppointmentBucketOnStartup(): Promise<void> {
  const url = process.env.SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  const bucket = process.env.SUPABASE_STORAGE_BUCKET_APPOINTMENT?.trim()

  if (!url || !key) {
    console.log(
      '[supabase-appointment] Skipped: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing (set both to run this check).',
    )
    return
  }
  if (!bucket) {
    console.log(
      '[supabase-appointment] Skipped: SUPABASE_STORAGE_BUCKET_APPOINTMENT is not set. ' +
        'Add it to server/.env (bucket id must match Supabase Storage exactly, case-sensitive).',
    )
    return
  }

  try {
    const supabase = getClient()
    const { data: buckets, error } = await supabase.storage.listBuckets()
    if (error) {
      console.warn(
        `[supabase-appointment] listBuckets failed (${error.message}). Uploads may still work if the bucket exists.`,
      )
      return
    }
    const ids = new Set((buckets ?? []).map((b) => b.id))
    if (!ids.has(bucket)) {
      const available = [...ids].join(', ') || '(none)'
      console.warn(
        `[supabase-appointment] Bucket "${bucket}" not found in this Supabase project. ` +
          `Available bucket ids: ${available}. Set SUPABASE_STORAGE_BUCKET_APPOINTMENT (case-sensitive).`,
      )
      return
    }
    console.log(`[supabase-appointment] Bucket "${bucket}" OK`)
    await probeAppointmentBucketAnonymousRead(supabase, bucket)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn(`[supabase-appointment] Startup bucket check failed: ${msg}`)
  }
}

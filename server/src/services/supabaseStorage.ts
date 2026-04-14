/**
 * Supabase Storage integration for CRM messaging attachments.
 *
 * Server-only: uses SUPABASE_SERVICE_ROLE_KEY (never expose to the browser).
 * Files are stored as objects in a bucket; Postgres MessageMedia rows hold metadata + paths.
 *
 * For Twilio MMS, the public URL must be reachable by Twilio's servers — use a bucket with
 * public read for the messaging prefix, or signed URLs with long expiry (tradeoff in README).
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

export function isSupabaseStorageConfigured(): boolean {
  const url = process.env.SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim()
  return Boolean(url && key && bucket)
}

function getClient(): SupabaseClient {
  if (!isSupabaseStorageConfigured()) {
    throw new Error(
      'Supabase Storage is not configured (set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_STORAGE_BUCKET)',
    )
  }
  if (!client) {
    client = createClient(
      process.env.SUPABASE_URL!.trim(),
      process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
  }
  return client
}

export function getSupabaseStorageBucket(): string {
  return process.env.SUPABASE_STORAGE_BUCKET!.trim()
}

function storageErrorHint(bucket: string, message: string): string {
  const m = message.toLowerCase()
  if (!m.includes('bucket') || !m.includes('found')) return ''
  return (
    ` Bucket id "${bucket}" must match Supabase Dashboard → Storage exactly (case-sensitive). ` +
    `Confirm SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are from the same project as that bucket.`
  )
}

/**
 * Call once on server startup: warns if the configured bucket does not exist for this project.
 * Catches typos / wrong project credentials before the first MMS upload.
 */
export async function verifySupabaseMessagingBucketOnStartup(): Promise<void> {
  if (!isSupabaseStorageConfigured()) return
  const bucket = getSupabaseStorageBucket()
  try {
    const supabase = getClient()
    const { data: buckets, error } = await supabase.storage.listBuckets()
    if (error) {
      console.warn(
        `[supabase-storage] listBuckets failed (${error.message}). MMS uploads may still work if the bucket exists.`,
      )
      return
    }
    const ids = new Set((buckets ?? []).map((b) => b.id))
    if (!ids.has(bucket)) {
      const available = [...ids].join(', ') || '(none)'
      console.warn(
        `[supabase-storage] Bucket "${bucket}" not found in this Supabase project. ` +
          `Available bucket ids: ${available}. Set SUPABASE_STORAGE_BUCKET to one of these (case-sensitive).`,
      )
    } else {
      console.log(`[supabase-storage] Bucket "${bucket}" OK`)
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn(`[supabase-storage] Startup bucket check failed: ${msg}`)
  }
}

export type UploadedObject = {
  storageKey: string
  /** Prefer this for Twilio mediaUrl and <img src> when bucket is public */
  publicUrl: string
}

/**
 * Upload a buffer to the configured bucket and return the path + public URL.
 */
export async function uploadBufferToMessaging(
  storageKey: string,
  buffer: Buffer,
  contentType: string,
  options?: { cacheControl?: string },
): Promise<UploadedObject> {
  const supabase = getClient()
  const bucket = getSupabaseStorageBucket()
  const { error } = await supabase.storage.from(bucket).upload(storageKey, buffer, {
    contentType,
    upsert: false,
    cacheControl: options?.cacheControl ?? '3600',
  })
  if (error) {
    const hint = storageErrorHint(bucket, error.message)
    throw new Error(`Supabase upload failed: ${error.message}.${hint}`)
  }
  const { data } = supabase.storage.from(bucket).getPublicUrl(storageKey)
  const publicUrl = data.publicUrl
  if (!publicUrl) {
    throw new Error('Supabase getPublicUrl returned no URL; check bucket public access or use signed URLs')
  }
  await warnIfAnonymousCannotReadMediaUrl(publicUrl)
  return { storageKey, publicUrl }
}

/**
 * Delete objects from the configured bucket. Safe no-op when storage is not configured.
 */
export async function deleteMessagingStorageKeys(storageKeys: string[]): Promise<void> {
  const keys = (storageKeys ?? []).map((k) => String(k)).filter((k) => k.trim().length > 0)
  if (keys.length === 0) return
  if (!isSupabaseStorageConfigured()) return
  const supabase = getClient()
  const bucket = getSupabaseStorageBucket()
  const { error } = await supabase.storage.from(bucket).remove(keys)
  if (error) {
    const hint = storageErrorHint(bucket, error.message)
    console.warn(
      `[supabase-storage] remove ${keys.length} object(s) failed: ${error.message}.${hint} ` +
        `Continuing to delete database rows anyway.`,
    )
  }
}

/**
 * Twilio MMS and the CRM image request fetch this URL **without** Supabase cookies.
 * If HEAD is not OK (often 403), turn on **public** read for this bucket or add a
 * storage.objects SELECT policy for role `anon` in Supabase SQL.
 */
async function warnIfAnonymousCannotReadMediaUrl(publicUrl: string): Promise<void> {
  if (process.env.NODE_ENV === 'test' || process.env.MESSAGING_SKIP_MEDIA_PUBLIC_CHECK === '1') {
    return
  }
  if (typeof fetch !== 'function') return
  try {
    const res = await fetch(publicUrl, { method: 'HEAD', redirect: 'follow' })
    if (res.ok) return
    console.warn(
      `[messaging] Media URL returned HTTP ${res.status} for anonymous HEAD ${publicUrl.slice(0, 80)}… ` +
        `Twilio cannot fetch this file for MMS, and the CRM image will not load. ` +
        `In Supabase: Storage → your bucket → set **Public bucket**, or add RLS policy allowing SELECT on storage.objects for **anon**.`,
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn(`[messaging] Could not verify public media URL (HEAD): ${msg}`)
  }
}

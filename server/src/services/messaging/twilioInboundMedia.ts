/**
 * Parse Twilio webhook form fields for MMS attachments (MediaUrl0, MediaContentType0, …).
 * @see https://www.twilio.com/docs/messaging/guides/webhook-request
 */
export function extractTwilioInboundMediaItems(payload: Record<string, unknown>): Array<{
  url: string
  contentType: string
}> {
  const raw = payload.NumMedia
  const n = parseInt(String(raw ?? '0'), 10)
  const count = Number.isFinite(n) && n > 0 ? Math.min(n, 10) : 0
  const out: Array<{ url: string; contentType: string }> = []
  for (let i = 0; i < count; i++) {
    const url = payload[`MediaUrl${i}`]
    const ct = payload[`MediaContentType${i}`]
    if (typeof url === 'string' && url.length > 0) {
      out.push({
        url,
        contentType: typeof ct === 'string' && ct.length > 0 ? ct : 'application/octet-stream',
      })
    }
  }
  return out
}

/**
 * Download Twilio-hosted media (URLs may require HTTP Basic with Account SID + Auth Token).
 */
export async function downloadTwilioMedia(
  mediaUrl: string,
  options?: { accountSid?: string; authToken?: string },
): Promise<{ buffer: Buffer; contentType: string }> {
  const sid = options?.accountSid ?? process.env.TWILIO_ACCOUNT_SID?.trim()
  const token = options?.authToken ?? process.env.TWILIO_AUTH_TOKEN?.trim()
  if (!sid || !token) {
    throw new Error('TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required to download inbound media')
  }
  const auth = Buffer.from(`${sid}:${token}`).toString('base64')
  const res = await fetch(mediaUrl, {
    headers: {
      Authorization: `Basic ${auth}`,
    },
  })
  if (!res.ok) {
    throw new Error(`Failed to download Twilio media: ${res.status} ${res.statusText}`)
  }
  const arrayBuf = await res.arrayBuffer()
  const buffer = Buffer.from(arrayBuf)
  const contentType = res.headers.get('content-type')?.split(';')[0]?.trim() || 'application/octet-stream'
  return { buffer, contentType }
}

export function extensionForMime(mime: string): string {
  const m = mime.toLowerCase()
  if (m.includes('jpeg') || m === 'image/jpg') return 'jpg'
  if (m.includes('png')) return 'png'
  if (m.includes('gif')) return 'gif'
  if (m.includes('webp')) return 'webp'
  if (m.includes('heic')) return 'heic'
  if (m.includes('heif')) return 'heif'
  return 'bin'
}

export type SmsEncoding = 'GSM7' | 'UCS2'
export type RiskLevel = 'SAFE' | 'WARNING' | 'BLOCK'

export type MediaKind = 'image' | 'other'

export type MediaItemForValidation = {
  url?: string
  contentType?: string | null
  sizeBytes?: number | null
}

export type MediaValidationResult = {
  mediaCount: number
  totalBytes: number
  maxBytes: number
  kindCounts: Record<MediaKind, number>
  warnings: string[]
  blocks: string[]
}

export type MessagePreflightResult = {
  overall: RiskLevel
  encoding: SmsEncoding
  /**
   * For GSM7 this is septets (extended chars count as 2).
   * For UCS2 this is unicode codepoints (spread length).
   */
  lengthUnits: number
  segments: number
  warnings: string[]
  blocks: string[]
  media: MediaValidationResult
}

export const MESSAGE_PREFLIGHT_DEFAULTS = {
  // Text
  warnGsm7CharsOver: 320,
  warnUcs2CharsOver: 140,
  blockSegmentsOver: 6,

  // Media count
  warnMediaCountOverOrEqual: 2,
  blockMediaCountOverOrEqual: 4,

  // Per-item practical caps (carrier reality)
  imageWarnBytesOver: 300 * 1024,
  imageBlockBytesOver: 600 * 1024,
  otherWarnBytesOver: 250 * 1024,
  otherBlockBytesOver: 400 * 1024,

  // Total media
  totalMediaWarnBytesOver: 600 * 1024,
  totalMediaBlockBytesOver: 1000 * 1024,
} as const

const GSM7_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\u001BÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡" +
  'ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà'

const GSM7_EXT = '^{}\\[~]|€'

function isGsm7Char(ch: string): boolean {
  return GSM7_BASIC.includes(ch) || GSM7_EXT.includes(ch)
}

export function detectSmsEncoding(text: string): SmsEncoding {
  for (const ch of text) {
    if (!isGsm7Char(ch)) return 'UCS2'
  }
  return 'GSM7'
}

export function gsm7SeptetLength(text: string): number {
  let len = 0
  for (const ch of text) {
    len += GSM7_EXT.includes(ch) ? 2 : 1
  }
  return len
}

export function calculateSmsSegments(text: string): { encoding: SmsEncoding; segments: number; lengthUnits: number } {
  const encoding = detectSmsEncoding(text)

  if (encoding === 'UCS2') {
    const units = [...text].length
    if (units <= 70) return { encoding, segments: 1, lengthUnits: units }
    return { encoding, segments: Math.ceil(units / 67), lengthUnits: units }
  }

  const septets = gsm7SeptetLength(text)
  if (septets <= 160) return { encoding, segments: 1, lengthUnits: septets }
  return { encoding, segments: Math.ceil(septets / 153), lengthUnits: septets }
}

function mediaKindFromContentType(ct?: string | null): MediaKind {
  if (!ct) return 'other'
  return ct.toLowerCase().startsWith('image/') ? 'image' : 'other'
}

export function validateOutboundMedia(
  media: MediaItemForValidation[],
  policy: typeof MESSAGE_PREFLIGHT_DEFAULTS = MESSAGE_PREFLIGHT_DEFAULTS,
): MediaValidationResult {
  const warnings: string[] = []
  const blocks: string[] = []

  const mediaCount = media.length
  if (mediaCount >= policy.blockMediaCountOverOrEqual) {
    blocks.push('Too many attachments (4+ is often rejected by carriers).')
  } else if (mediaCount >= policy.warnMediaCountOverOrEqual) {
    warnings.push('Multiple attachments can fail on some carriers.')
  }

  let totalBytes = 0
  let maxBytes = 0
  const kindCounts: Record<MediaKind, number> = { image: 0, other: 0 }

  for (const it of media) {
    const kind = mediaKindFromContentType(it.contentType ?? undefined)
    kindCounts[kind]++

    const size = Math.max(0, Number(it.sizeBytes ?? 0) || 0)
    totalBytes += size
    maxBytes = Math.max(maxBytes, size)

    if (size > 0) {
      if (kind === 'image') {
        if (size > policy.imageBlockBytesOver) blocks.push(`Image is too large (${Math.round(size / 1024)} KB).`)
        else if (size > policy.imageWarnBytesOver)
          warnings.push(`Large image (${Math.round(size / 1024)} KB) may fail on some carriers.`)
      } else {
        if (size > policy.otherBlockBytesOver)
          blocks.push(`Attachment is too large (${Math.round(size / 1024)} KB).`)
        else if (size > policy.otherWarnBytesOver)
          warnings.push(`Large attachment (${Math.round(size / 1024)} KB) may fail on some carriers.`)
      }
    }
  }

  if (totalBytes > policy.totalMediaBlockBytesOver) blocks.push('Total attachment size is too large.')
  else if (totalBytes > policy.totalMediaWarnBytesOver) warnings.push('Total attachment size is high and may fail.')

  return { mediaCount, totalBytes, maxBytes, kindCounts, warnings, blocks }
}

export function preflightOutboundMessage(
  args: { body: string; outboundMedia?: MediaItemForValidation[] },
  policy: typeof MESSAGE_PREFLIGHT_DEFAULTS = MESSAGE_PREFLIGHT_DEFAULTS,
): MessagePreflightResult {
  const body = args.body ?? ''
  const outboundMedia = args.outboundMedia ?? []

  const warnings: string[] = []
  const blocks: string[] = []

  const seg = calculateSmsSegments(body)

  if (seg.encoding === 'UCS2') {
    warnings.push('Message contains emojis/special characters (UCS-2), which reduces allowed length.')
    const chars = [...body].length
    if (chars > policy.warnUcs2CharsOver) warnings.push('Long UCS-2 message can fail on some carriers.')
  } else {
    const chars = [...body].length
    if (chars > policy.warnGsm7CharsOver) warnings.push('Long SMS (more than ~2 segments) can reduce deliverability.')
  }

  if (seg.segments > policy.blockSegmentsOver) blocks.push('Text is too long to reliably deliver (more than 6 segments).')

  const mediaValidation = validateOutboundMedia(outboundMedia, policy)
  warnings.push(...mediaValidation.warnings)
  blocks.push(...mediaValidation.blocks)

  const overall: RiskLevel = blocks.length ? 'BLOCK' : warnings.length ? 'WARNING' : 'SAFE'

  return {
    overall,
    encoding: seg.encoding,
    lengthUnits: seg.lengthUnits,
    segments: seg.segments,
    warnings,
    blocks,
    media: mediaValidation,
  }
}


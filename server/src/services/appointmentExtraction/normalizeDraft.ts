import { parseSqft } from '../../utils/appointmentUtils'
import { getSizeRange } from '../../data/teamSizeData'
import type {
  AppointmentExtractionDraft,
  ExtractionFieldKey,
  ExtractionServiceType,
  RawAiExtraction,
} from './types'

const SERVICE_TYPES: ExtractionServiceType[] = ['STANDARD', 'DEEP', 'MOVE_IN_OUT']

function normalizeServiceType(raw: string | null | undefined): '' | ExtractionServiceType {
  if (!raw || typeof raw !== 'string') return ''
  const u = raw.trim().toUpperCase().replace(/[\s-]+/g, '_')
  if (u === 'MOVE_IN' || u === 'MOVE_OUT' || u === 'MOVE_IN_OUT' || u === 'MOVE_IN/OUT') {
    return 'MOVE_IN_OUT'
  }
  if (u === 'DEEP' || u === 'DEEP_CLEANING') return 'DEEP'
  if (u === 'STANDARD' || u === 'REGULAR') return 'STANDARD'
  if (SERVICE_TYPES.includes(u as ExtractionServiceType)) return u as ExtractionServiceType
  return ''
}

/**
 * Normalize a size string from the model into a UI bucket (hyphen ranges).
 */
export function normalizeSizeString(raw: string | null | undefined): string {
  if (!raw || typeof raw !== 'string') return ''
  let s = raw.trim()
  if (!s) return ''

  // "1501 - 2000 sqft" -> extract range
  const rangeMatch = s.match(/\b(\d{3,5})\s*[-–]\s*(\d{3,5})\b/)
  if (rangeMatch) {
    const a = parseInt(rangeMatch[1], 10)
    const b = parseInt(rangeMatch[2], 10)
    const lo = Math.min(a, b)
    const hi = Math.max(a, b)
    const mid = Math.round((lo + hi) / 2)
    return getSizeRange(String(mid))
  }

  // "~1750 sf" or "1179 square feet"
  const sqftMatch = s.match(/~?\s*(\d{3,5})\s*(?:sq\s*ft|sqft|sf|square\s*feet)?/i)
  if (sqftMatch) {
    return getSizeRange(sqftMatch[1])
  }

  // Already a range like 1500-2000
  if (s.includes('-')) {
    const parts = s.split('-').map((p) => p.replace(/\D/g, '')).filter(Boolean)
    if (parts.length >= 2) {
      const lo = parseInt(parts[0], 10)
      const hi = parseInt(parts[1], 10)
      if (!Number.isNaN(lo) && !Number.isNaN(hi)) {
        return getSizeRange(`${Math.min(lo, hi)}-${Math.max(lo, hi)}`)
      }
    }
  }

  return getSizeRange(s)
}

function normalizeTime(raw: string | null | undefined): string {
  if (!raw || typeof raw !== 'string') return ''
  const u = raw.trim()
  if (!u) return ''
  // Already HH:mm
  if (/^\d{1,2}:\d{2}$/.test(u)) {
    const [h, m] = u.split(':').map((x) => parseInt(x, 10))
    if (Number.isFinite(h) && Number.isFinite(m)) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    }
  }
  // 9am / 9:30 AM
  const ampm = u.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*$/i)
  if (ampm) {
    let h = parseInt(ampm[1], 10)
    const m = ampm[2] ? parseInt(ampm[2], 10) : 0
    const mer = ampm[3].toLowerCase()
    if (mer === 'pm' && h < 12) h += 12
    if (mer === 'am' && h === 12) h = 0
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }
  return u
}

function normalizeDate(raw: string | null | undefined): string {
  if (!raw || typeof raw !== 'string') return ''
  const u = raw.trim()
  if (!u) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(u)) return u
  return u
}

export function rawAiToDraft(raw: RawAiExtraction): AppointmentExtractionDraft {
  const price = raw.price
  let priceStr = ''
  if (typeof price === 'number' && Number.isFinite(price)) priceStr = String(price)
  else if (typeof price === 'string' && price.trim()) {
    const n = parseFloat(price.replace(/[^0-9.]/g, ''))
    if (Number.isFinite(n)) priceStr = String(n)
  }

  const sizeNorm = normalizeSizeString(raw.size ?? undefined)
  const phoneRaw =
    typeof raw.clientPhone === 'string' && raw.clientPhone.trim() ? raw.clientPhone.trim() : undefined
  return {
    clientName: typeof raw.clientName === 'string' ? raw.clientName.trim() : undefined,
    clientPhone: phoneRaw,
    appointmentAddress:
      typeof raw.appointmentAddress === 'string' ? raw.appointmentAddress.trim() : undefined,
    price: priceStr || undefined,
    date: normalizeDate(raw.date ?? undefined) || undefined,
    time: normalizeTime(raw.time ?? undefined) || undefined,
    notes: typeof raw.notes === 'string' ? raw.notes.trim() : undefined,
    size: sizeNorm || undefined,
    serviceType: normalizeServiceType(raw.serviceType ?? undefined),
  }
}

export function collectMissingRequiredFields(
  draft: AppointmentExtractionDraft,
  options: { clientLinked: boolean; requireClientPhone?: boolean },
): ExtractionFieldKey[] {
  const missing: ExtractionFieldKey[] = []
  if (!options.clientLinked && !(draft.clientName && draft.clientName.trim())) {
    missing.push('clientName')
  }
  if (options.requireClientPhone && !(draft.clientPhone && draft.clientPhone.trim())) {
    missing.push('clientPhone')
  }
  if (!draft.serviceType) missing.push('serviceType')
  if (!draft.size || parseSqft(draft.size) === null) missing.push('size')
  if (!draft.price?.trim()) missing.push('price')
  if (!draft.appointmentAddress?.trim()) missing.push('appointmentAddress')
  if (!draft.date?.trim()) missing.push('date')
  if (!draft.time?.trim()) missing.push('time')
  return missing
}

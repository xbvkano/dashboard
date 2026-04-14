/**
 * User-facing copy for when RentCast was called with an address but no sqft was returned.
 * Only shown when RENTCAST_API_KEY is set and lookup ran (see sizeLookupFailed).
 */
export const RENTCAST_SIZE_LOOKUP_FAILED_NOTE =
  'RentCast did not return square footage for this address (enter home size manually).'

/** Appended to appointment notes when size bucket came from RentCast property lookup. */
export const RENTCAST_SIZE_SOURCE_NOTE =
  'Home size (sq ft range) from RentCast property lookup by address.'

export type RentcastNotesContext = {
  hasRentcastKey: boolean
  rentcastAttempted: boolean
  rentcastSuccess: boolean
  hadAddress: boolean
  sizeLookupFailed: boolean
}

/**
 * Filters AI "missingOrUncertain" lines so we do not imply an address/property lookup failure
 * unless RentCast actually ran and failed to return square footage (sizeLookupFailed).
 * When sizeLookupFailed, adds a single explicit RentCast line.
 */
export function finalizeExtractionNotFoundNotes(
  aiNotes: string[],
  ctx: RentcastNotesContext,
): string[] {
  const out: string[] = []
  for (const note of aiNotes) {
    const trimmed = note?.trim()
    if (!trimmed) continue
    if (shouldDropAiNote(trimmed, ctx)) continue
    out.push(trimmed)
  }

  if (ctx.sizeLookupFailed && ctx.hasRentcastKey && ctx.hadAddress) {
    if (!out.some((x) => x.includes('RentCast'))) {
      out.push(RENTCAST_SIZE_LOOKUP_FAILED_NOTE)
    }
  }

  return out
}

function shouldDropAiNote(note: string, ctx: RentcastNotesContext): boolean {
  if (ctx.rentcastSuccess && /size|sqft|square\s*foot|footage/i.test(note)) {
    return true
  }

  if (ctx.sizeLookupFailed) {
    return false
  }

  // Without a RentCast failure, do not show AI lines that blame address/property lookup for missing size.
  const uncertain =
    /could not|couldn't|unable to|fail|uncertain|not find|not found|not determine|unknown|missing|omit/i.test(
      note,
    )
  if (!uncertain) return false

  const linksAddressToSize =
    /address|property|location|rentcast|lookup|assessor|parcel|mls|zillow|records/i.test(note) &&
    /size|sqft|sq\.?\s*ft|square|footage|sq\s*feet/i.test(note)

  return linksAddressToSize
}

export function appendRentcastSizeNoteToDraftNotes(notes: string | undefined): string {
  const base = notes?.trim() ?? ''
  if (base.includes(RENTCAST_SIZE_SOURCE_NOTE)) {
    return base
  }
  return base ? `${base}\n\n${RENTCAST_SIZE_SOURCE_NOTE}` : RENTCAST_SIZE_SOURCE_NOTE
}

import {
  appendRentcastSizeNoteToDraftNotes,
  finalizeExtractionNotFoundNotes,
  RENTCAST_SIZE_LOOKUP_FAILED_NOTE,
  RENTCAST_SIZE_SOURCE_NOTE,
} from '../../src/services/appointmentExtraction/extractionNotFoundNotes'

const baseCtx = {
  hasRentcastKey: true,
  rentcastAttempted: false,
  rentcastSuccess: false,
  hadAddress: true,
  sizeLookupFailed: false,
}

describe('finalizeExtractionNotFoundNotes', () => {
  it('adds explicit RentCast failure line only when sizeLookupFailed with API key', () => {
    const out = finalizeExtractionNotFoundNotes(['Uncertain: price'], {
      ...baseCtx,
      sizeLookupFailed: true,
      rentcastAttempted: true,
    })
    expect(out.some((x) => x.includes('RentCast'))).toBe(true)
    expect(out).toContain(RENTCAST_SIZE_LOOKUP_FAILED_NOTE)
  })

  it('does not add RentCast failure when API key is absent', () => {
    const out = finalizeExtractionNotFoundNotes([], {
      ...baseCtx,
      hasRentcastKey: false,
      sizeLookupFailed: true,
      rentcastAttempted: false,
    })
    expect(out).toEqual([])
  })

  it('drops AI notes that blame address/property for missing size when RentCast did not fail', () => {
    const out = finalizeExtractionNotFoundNotes(
      ['Could not determine home size from the property address'],
      {
        ...baseCtx,
        sizeLookupFailed: false,
      },
    )
    expect(out).toEqual([])
  })

  it('keeps unrelated AI uncertainty notes', () => {
    const out = finalizeExtractionNotFoundNotes(['Uncertain: exact time (am vs pm)'], {
      ...baseCtx,
    })
    expect(out).toEqual(['Uncertain: exact time (am vs pm)'])
  })

  it('drops AI size complaints when RentCast supplied the size', () => {
    const out = finalizeExtractionNotFoundNotes(['Size not mentioned in thread'], {
      ...baseCtx,
      rentcastSuccess: true,
    })
    expect(out).toEqual([])
  })
})

describe('appendRentcastSizeNoteToDraftNotes', () => {
  it('appends RentCast source note once', () => {
    expect(appendRentcastSizeNoteToDraftNotes('Gate code 1234')).toContain(RENTCAST_SIZE_SOURCE_NOTE)
    const twice = appendRentcastSizeNoteToDraftNotes(
      `Prior\n\n${RENTCAST_SIZE_SOURCE_NOTE}`,
    )
    expect(twice.split(RENTCAST_SIZE_SOURCE_NOTE).length - 1).toBe(1)
  })
})

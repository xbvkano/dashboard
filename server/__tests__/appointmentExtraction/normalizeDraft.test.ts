import { normalizeSizeString, rawAiToDraft } from '../../src/services/appointmentExtraction/normalizeDraft'

describe('normalizeSizeString', () => {
  it('maps explicit range to bucket', () => {
    expect(normalizeSizeString('1501 - 2000 sqft')).toBe('1500-2000')
  })

  it('maps single sqft mention', () => {
    expect(normalizeSizeString('1179 square feet')).toBe('1000-1500')
  })

  it('passes through hyphen ranges compatible with getSizeRange', () => {
    expect(normalizeSizeString('1500-2000')).toBe('1500-2000')
  })

  it('returns empty for unknown / non-bucket values', () => {
    expect(normalizeSizeString('')).toBe('')
    expect(normalizeSizeString(null)).toBe('')
    expect(normalizeSizeString('unknown')).toBe('')
    expect(normalizeSizeString('N/A')).toBe('')
  })

  it('maps bare numeric sqft to a bucket', () => {
    expect(normalizeSizeString('800')).toBe('0-1000')
    expect(normalizeSizeString('2200')).toBe('2000-2500')
  })
})

describe('rawAiToDraft size handling', () => {
  it('clears size when model lists size as uncertain even if a bucket was guessed', () => {
    const draft = rawAiToDraft({
      size: '0-1000',
      missingOrUncertain: ['size'],
    })
    expect(draft.size).toBeUndefined()
  })

  it('keeps a confident size bucket', () => {
    const draft = rawAiToDraft({
      size: '2000-2500',
      missingOrUncertain: [],
    })
    expect(draft.size).toBe('2000-2500')
  })
})

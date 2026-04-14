import { normalizeSizeString } from '../../src/services/appointmentExtraction/normalizeDraft'

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
})

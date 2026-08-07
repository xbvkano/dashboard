import {
  isSupersededTemplateName,
  nextOldTemplateName,
  stripSupersededSuffix,
} from '../../src/utils/templateVersioning'

describe('templateVersioning', () => {
  it('detects superseded names', () => {
    expect(isSupersededTemplateName('Weekly Clean old(1)')).toBe(true)
    expect(isSupersededTemplateName('Weekly Clean')).toBe(false)
  })

  it('strips the old(n) suffix', () => {
    expect(stripSupersededSuffix('Weekly Clean old(2)')).toBe('Weekly Clean')
  })

  it('increments old(n) based on existing names', () => {
    expect(nextOldTemplateName('Weekly Clean', ['Weekly Clean'])).toBe('Weekly Clean old(1)')
    expect(
      nextOldTemplateName('Weekly Clean', [
        'Weekly Clean',
        'Weekly Clean old(1)',
        'Weekly Clean old(3)',
      ]),
    ).toBe('Weekly Clean old(4)')
  })
})

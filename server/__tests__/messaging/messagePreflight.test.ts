import {
  MESSAGE_PREFLIGHT_DEFAULTS,
  calculateSmsSegments,
  detectSmsEncoding,
  gsm7SeptetLength,
  preflightOutboundMessage,
  validateOutboundMedia,
} from '../../src/services/messaging/messagePreflight'

describe('messagePreflight', () => {
  describe('detectSmsEncoding', () => {
    it('detects GSM7 for plain ascii', () => {
      expect(detectSmsEncoding('Hello there! 123')).toBe('GSM7')
    })

    it('detects UCS2 when emoji present', () => {
      expect(detectSmsEncoding('Hello 😊')).toBe('UCS2')
    })

    it('detects UCS2 when accented char present', () => {
      expect(detectSmsEncoding('Olá')).toBe('UCS2')
    })

    it('treats GSM-7 extended table chars as GSM7', () => {
      expect(detectSmsEncoding('Price is 10€')).toBe('GSM7')
      expect(detectSmsEncoding('Use braces {} and carets ^')).toBe('GSM7')
    })
  })

  describe('gsm7SeptetLength', () => {
    it('counts basic chars as 1 septet', () => {
      expect(gsm7SeptetLength('abcXYZ')).toBe(6)
    })

    it('counts GSM-7 extended chars as 2 septets', () => {
      // € is extended
      expect(gsm7SeptetLength('€')).toBe(2)
      expect(gsm7SeptetLength('a€b')).toBe(1 + 2 + 1)
      // { } are extended
      expect(gsm7SeptetLength('{}')).toBe(4)
    })
  })

  describe('calculateSmsSegments', () => {
    it('GSM7: <=160 septets => 1 segment', () => {
      const text = 'a'.repeat(160)
      const out = calculateSmsSegments(text)
      expect(out.encoding).toBe('GSM7')
      expect(out.segments).toBe(1)
      expect(out.lengthUnits).toBe(160)
    })

    it('GSM7: >160 septets => concatenated segments of 153', () => {
      const text = 'a'.repeat(161)
      const out = calculateSmsSegments(text)
      expect(out.encoding).toBe('GSM7')
      expect(out.segments).toBe(2)
      expect(out.lengthUnits).toBe(161)
    })

    it('UCS2: <=70 chars => 1 segment', () => {
      const text = '😀'.repeat(70)
      const out = calculateSmsSegments(text)
      expect(out.encoding).toBe('UCS2')
      expect(out.segments).toBe(1)
      expect(out.lengthUnits).toBe(70)
    })

    it('UCS2: >70 chars => concatenated segments of 67', () => {
      const text = '😀'.repeat(71)
      const out = calculateSmsSegments(text)
      expect(out.encoding).toBe('UCS2')
      expect(out.segments).toBe(2)
      expect(out.lengthUnits).toBe(71)
    })
  })

  describe('validateOutboundMedia', () => {
    it('SAFE for 1 small image', () => {
      const out = validateOutboundMedia([
        { contentType: 'image/jpeg', sizeBytes: 200 * 1024 },
      ])
      expect(out.blocks).toHaveLength(0)
      expect(out.warnings).toHaveLength(0)
      expect(out.kindCounts.image).toBe(1)
      expect(out.mediaCount).toBe(1)
    })

    it('WARNING for multiple attachments (2-3)', () => {
      const out = validateOutboundMedia([
        { contentType: 'image/jpeg', sizeBytes: 100 * 1024 },
        { contentType: 'image/png', sizeBytes: 100 * 1024 },
      ])
      expect(out.blocks).toHaveLength(0)
      expect(out.warnings.join(' ')).toContain('Multiple attachments')
    })

    it('BLOCK for 4+ attachments', () => {
      const out = validateOutboundMedia([
        { contentType: 'image/jpeg', sizeBytes: 50 * 1024 },
        { contentType: 'image/jpeg', sizeBytes: 50 * 1024 },
        { contentType: 'image/jpeg', sizeBytes: 50 * 1024 },
        { contentType: 'image/jpeg', sizeBytes: 50 * 1024 },
      ])
      expect(out.blocks.join(' ')).toContain('Too many attachments')
    })

    it('WARNING for large image > 300KB, BLOCK > 600KB', () => {
      const warnOut = validateOutboundMedia([
        { contentType: 'image/jpeg', sizeBytes: MESSAGE_PREFLIGHT_DEFAULTS.imageWarnBytesOver + 1 },
      ])
      expect(warnOut.warnings.join(' ')).toContain('Large image')
      expect(warnOut.blocks).toHaveLength(0)

      const blockOut = validateOutboundMedia([
        { contentType: 'image/jpeg', sizeBytes: MESSAGE_PREFLIGHT_DEFAULTS.imageBlockBytesOver + 1 },
      ])
      expect(blockOut.blocks.join(' ')).toContain('Image is too large')
    })

    it('WARNING/BLOCK for large non-image media', () => {
      const warnOut = validateOutboundMedia([
        { contentType: 'application/pdf', sizeBytes: MESSAGE_PREFLIGHT_DEFAULTS.otherWarnBytesOver + 1 },
      ])
      expect(warnOut.warnings.join(' ')).toContain('Large attachment')

      const blockOut = validateOutboundMedia([
        { contentType: 'application/pdf', sizeBytes: MESSAGE_PREFLIGHT_DEFAULTS.otherBlockBytesOver + 1 },
      ])
      expect(blockOut.blocks.join(' ')).toContain('Attachment is too large')
    })

    it('total media bytes WARNING > 600KB and BLOCK > 1000KB', () => {
      const warnOut = validateOutboundMedia([
        { contentType: 'image/jpeg', sizeBytes: 400 * 1024 },
        { contentType: 'image/jpeg', sizeBytes: 250 * 1024 },
      ])
      expect(warnOut.warnings.join(' ')).toContain('Total attachment size')
      expect(warnOut.blocks).toHaveLength(0)

      const blockOut = validateOutboundMedia([
        { contentType: 'image/jpeg', sizeBytes: 700 * 1024 },
        { contentType: 'image/jpeg', sizeBytes: 400 * 1024 },
      ])
      expect(blockOut.blocks.join(' ')).toContain('Total attachment size is too large')
    })
  })

  describe('preflightOutboundMessage', () => {
    it('SAFE for short GSM7 and no media', () => {
      const out = preflightOutboundMessage({ body: 'Hello', outboundMedia: [] })
      expect(out.overall).toBe('SAFE')
      expect(out.warnings).toHaveLength(0)
      expect(out.blocks).toHaveLength(0)
    })

    it('WARNING for UCS2 text even when short', () => {
      const out = preflightOutboundMessage({ body: 'Hi 😊', outboundMedia: [] })
      expect(out.overall).toBe('WARNING')
      expect(out.warnings.join(' ')).toContain('UCS-2')
    })

    it('BLOCK when segments > 6', () => {
      const text = 'a'.repeat(153 * 7) // 7 segments GSM7
      const out = preflightOutboundMessage({ body: text, outboundMedia: [] })
      expect(out.segments).toBeGreaterThan(6)
      expect(out.overall).toBe('BLOCK')
      expect(out.blocks.join(' ')).toContain('more than 6 segments')
    })
  })
})


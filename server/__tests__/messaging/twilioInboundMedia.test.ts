import {
  downloadTwilioMedia,
  extractTwilioInboundMediaItems,
  extensionForMime,
} from '../../src/services/messaging/twilioInboundMedia'

describe('twilioInboundMedia', () => {
  it('extracts MediaUrl/MediaContentType pairs from Twilio webhook fields', () => {
    const payload = {
      NumMedia: '2',
      MediaUrl0: 'https://api.twilio.com/2010-04-01/Accounts/ACxxx/Messages/MMxxx/Media/MExxx0',
      MediaContentType0: 'image/jpeg',
      MediaUrl1: 'https://api.twilio.com/2010-04-01/Accounts/ACxxx/Messages/MMxxx/Media/MExxx1',
      MediaContentType1: 'image/png',
    }
    const items = extractTwilioInboundMediaItems(payload)
    expect(items).toHaveLength(2)
    expect(items[0].url).toContain('MExxx0')
    expect(items[0].contentType).toBe('image/jpeg')
    expect(items[1].contentType).toBe('image/png')
  })

  it('returns empty array when NumMedia is 0', () => {
    expect(extractTwilioInboundMediaItems({ NumMedia: '0' })).toEqual([])
  })

  it('defaults content type when MediaContentType is missing', () => {
    const items = extractTwilioInboundMediaItems({
      NumMedia: '1',
      MediaUrl0: 'https://api.twilio.com/media/0',
    })
    expect(items).toEqual([
      { url: 'https://api.twilio.com/media/0', contentType: 'application/octet-stream' },
    ])
  })

  it('extensionForMime maps common image types', () => {
    expect(extensionForMime('image/jpeg')).toBe('jpg')
    expect(extensionForMime('image/jpg')).toBe('jpg')
    expect(extensionForMime('image/png')).toBe('png')
    expect(extensionForMime('image/webp')).toBe('webp')
    expect(extensionForMime('application/octet-stream')).toBe('bin')
  })

  describe('downloadTwilioMedia', () => {
    const origFetch = global.fetch
    let savedSid: string | undefined
    let savedToken: string | undefined

    beforeEach(() => {
      savedSid = process.env.TWILIO_ACCOUNT_SID
      savedToken = process.env.TWILIO_AUTH_TOKEN
      process.env.TWILIO_ACCOUNT_SID = 'AC_test'
      process.env.TWILIO_AUTH_TOKEN = 'auth_test'
    })

    afterEach(() => {
      global.fetch = origFetch
      if (savedSid !== undefined) process.env.TWILIO_ACCOUNT_SID = savedSid
      else delete process.env.TWILIO_ACCOUNT_SID
      if (savedToken !== undefined) process.env.TWILIO_AUTH_TOKEN = savedToken
      else delete process.env.TWILIO_AUTH_TOKEN
    })

    it('downloads with Basic auth and returns buffer + content type', async () => {
      const buf = new Uint8Array([1, 2, 3]).buffer
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => buf,
        headers: {
          get: (name: string) => (name.toLowerCase() === 'content-type' ? 'image/jpeg; charset=utf-8' : null),
        },
      }) as unknown as typeof fetch

      const out = await downloadTwilioMedia('https://api.twilio.com/2010/Media/ME123')
      expect(out.buffer.equals(Buffer.from([1, 2, 3]))).toBe(true)
      expect(out.contentType).toBe('image/jpeg')
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.twilio.com/2010/Media/ME123',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.stringMatching(/^Basic /),
          }),
        }),
      )
    })

    it('throws when response is not ok', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      }) as unknown as typeof fetch

      await expect(downloadTwilioMedia('https://x')).rejects.toThrow(/403/)
    })

    it('throws when Twilio credentials are missing', async () => {
      delete process.env.TWILIO_ACCOUNT_SID
      global.fetch = jest.fn()
      await expect(downloadTwilioMedia('https://x')).rejects.toThrow(/TWILIO_ACCOUNT_SID/)
      expect(global.fetch).not.toHaveBeenCalled()
    })
  })
})

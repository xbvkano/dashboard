/**
 * Supabase Storage helpers — mocked client so tests do not hit the network.
 */
describe('supabaseStorage', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('isSupabaseStorageConfigured is false when any required var is missing', async () => {
    process.env.SUPABASE_URL = 'https://x.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'k'
    delete process.env.SUPABASE_STORAGE_BUCKET

    const { isSupabaseStorageConfigured } = await import('../../src/services/supabaseStorage')
    expect(isSupabaseStorageConfigured()).toBe(false)
  })

  it('isSupabaseStorageConfigured is true when URL, service key, and bucket are set', async () => {
    process.env.SUPABASE_URL = 'https://x.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'k'
    process.env.SUPABASE_STORAGE_BUCKET = 'messaging'

    const { isSupabaseStorageConfigured } = await import('../../src/services/supabaseStorage')
    expect(isSupabaseStorageConfigured()).toBe(true)
  })

  it('uploadBufferToMessaging uploads buffer and returns storageKey and publicUrl', async () => {
    process.env.SUPABASE_URL = 'https://x.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'k'
    process.env.SUPABASE_STORAGE_BUCKET = 'messaging'

    const upload = jest.fn().mockResolvedValue({ error: null })
    const getPublicUrl = jest.fn().mockReturnValue({
      data: { publicUrl: 'https://x.supabase.co/storage/v1/object/public/messaging/a/b.jpg' },
    })
    const from = jest.fn(() => ({ upload, getPublicUrl }))

    jest.doMock('@supabase/supabase-js', () => ({
      createClient: jest.fn(() => ({
        storage: { from },
      })),
    }))

    const { uploadBufferToMessaging } = await import('../../src/services/supabaseStorage')
    const buf = Buffer.from([0xff, 0xd8, 0xff])
    const out = await uploadBufferToMessaging('messaging/out/1/x.jpg', buf, 'image/jpeg')

    expect(out.storageKey).toBe('messaging/out/1/x.jpg')
    expect(out.publicUrl).toContain('object/public')
    expect(from).toHaveBeenCalledWith('messaging')
    expect(upload).toHaveBeenCalledWith(
      'messaging/out/1/x.jpg',
      buf,
      expect.objectContaining({ contentType: 'image/jpeg', upsert: false }),
    )
    expect(getPublicUrl).toHaveBeenCalledWith('messaging/out/1/x.jpg')
  })

  it('uploadBufferToMessaging throws when Supabase upload returns error', async () => {
    process.env.SUPABASE_URL = 'https://x.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'k'
    process.env.SUPABASE_STORAGE_BUCKET = 'messaging'

    const upload = jest.fn().mockResolvedValue({ error: { message: 'quota' } })
    const getPublicUrl = jest.fn()

    jest.doMock('@supabase/supabase-js', () => ({
      createClient: jest.fn(() => ({
        storage: {
          from: jest.fn(() => ({ upload, getPublicUrl })),
        },
      })),
    }))

    const { uploadBufferToMessaging } = await import('../../src/services/supabaseStorage')
    await expect(
      uploadBufferToMessaging('k', Buffer.from([1]), 'image/png'),
    ).rejects.toThrow(/Supabase upload failed/)
    expect(getPublicUrl).not.toHaveBeenCalled()
  })
})

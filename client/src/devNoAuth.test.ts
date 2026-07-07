import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { API_ACCESS_TOKEN_KEY } from './api'
import { ensureNoAuthDevSession, NO_AUTH_JWT_ADMIN } from './devNoAuth'

function mockLocalStorage(): void {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v)
    },
    removeItem: (k: string) => {
      store.delete(k)
    },
    clear: () => store.clear(),
  })
}

describe('ensureNoAuthDevSession', () => {
  beforeEach(() => {
    mockLocalStorage()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('POST /login and stores JWT when no session exists', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          role: 'OWNER',
          userName: NO_AUTH_JWT_ADMIN.userName,
          user: { id: 3, safe: true },
          accessToken: 'test-jwt',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    const role = await ensureNoAuthDevSession()
    expect(role).toBe('OWNER')
    expect(localStorage.getItem(API_ACCESS_TOKEN_KEY)).toBe('test-jwt')
    expect(localStorage.getItem('userId')).toBe('3')
    expect(localStorage.getItem('userName')).toBe(NO_AUTH_JWT_ADMIN.userName)
    expect(localStorage.getItem('loginMethod')).toBe('password')

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/login'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          userName: NO_AUTH_JWT_ADMIN.userName,
          password: NO_AUTH_JWT_ADMIN.password,
        }),
      }),
    )
  })

  it('refreshes token when already logged in as JWT owner', async () => {
    localStorage.setItem(API_ACCESS_TOKEN_KEY, 'existing')
    localStorage.setItem('userName', NO_AUTH_JWT_ADMIN.userName)
    localStorage.setItem('role', 'OWNER')
    localStorage.setItem('loginMethod', 'password')

    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ accessToken: 'refreshed' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await ensureNoAuthDevSession()
    expect(localStorage.getItem(API_ACCESS_TOKEN_KEY)).toBe('refreshed')
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/auth/refresh'),
      expect.objectContaining({ method: 'POST' }),
    )
  })
})

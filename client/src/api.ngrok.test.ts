import { afterEach, describe, expect, it, vi } from 'vitest'
import { isNgrokBrowserContext, resolveApiBaseUrl } from './api'

describe('resolveApiBaseUrl (ngrok)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses /api proxy on ngrok-free.app hostnames', () => {
    vi.stubGlobal('window', {
      location: { hostname: 'abc123.ngrok-free.app', protocol: 'https:' },
    })
    expect(isNgrokBrowserContext()).toBe(true)
    expect(resolveApiBaseUrl()).toBe('/api')
  })

  it('uses /api proxy on ngrok.app hostnames', () => {
    vi.stubGlobal('window', {
      location: { hostname: 'abc123.ngrok.app', protocol: 'https:' },
    })
    expect(isNgrokBrowserContext()).toBe(true)
    expect(resolveApiBaseUrl()).toBe('/api')
  })

  it('does not use /api on localhost', () => {
    vi.stubGlobal('window', {
      location: { hostname: 'localhost', protocol: 'http:' },
    })
    expect(isNgrokBrowserContext()).toBe(false)
    expect(resolveApiBaseUrl()).not.toBe('/api')
  })
})

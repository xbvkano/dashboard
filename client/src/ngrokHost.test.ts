import { describe, expect, it } from 'vitest'
import { isNgrokHostname } from './ngrokHost'

describe('isNgrokHostname', () => {
  it('matches common ngrok domains', () => {
    expect(isNgrokHostname('abc.ngrok-free.app')).toBe(true)
    expect(isNgrokHostname('abc.ngrok.io')).toBe(true)
    expect(isNgrokHostname('abc.ngrok.app')).toBe(true)
    expect(isNgrokHostname('abc.ngrok-free.dev')).toBe(true)
  })

  it('matches Cloudflare Tunnel domains', () => {
    expect(isNgrokHostname('random-words.trycloudflare.com')).toBe(true)
    expect(isNgrokHostname('abc.cfargotunnel.com')).toBe(true)
  })

  it('does not match localhost or LAN hosts', () => {
    expect(isNgrokHostname('localhost')).toBe(false)
    expect(isNgrokHostname('192.168.1.5')).toBe(false)
    expect(isNgrokHostname('example.com')).toBe(false)
  })
})

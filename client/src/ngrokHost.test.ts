import { describe, expect, it } from 'vitest'
import { isNgrokHostname } from './ngrokHost'

describe('isNgrokHostname', () => {
  it('matches common ngrok domains', () => {
    expect(isNgrokHostname('abc.ngrok-free.app')).toBe(true)
    expect(isNgrokHostname('abc.ngrok.io')).toBe(true)
    expect(isNgrokHostname('abc.ngrok.app')).toBe(true)
    expect(isNgrokHostname('abc.ngrok-free.dev')).toBe(true)
  })

  it('does not match localhost', () => {
    expect(isNgrokHostname('localhost')).toBe(false)
    expect(isNgrokHostname('192.168.1.5')).toBe(false)
  })
})

import {
  clampInboxLimit,
  decodeInboxCursor,
  digitsOnly,
  encodeInboxCursor,
  inboxSearchWhere,
} from '../../src/utils/messagingInboxQuery'

describe('messagingInboxQuery', () => {
  it('clampInboxLimit defaults and caps', () => {
    expect(clampInboxLimit(undefined)).toBe(50)
    expect(clampInboxLimit('100')).toBe(100)
    expect(clampInboxLimit(200)).toBe(100)
  })

  it('digitsOnly strips non-digits', () => {
    expect(digitsOnly('+1 (555) 222-3333')).toBe('15552223333')
  })

  it('encode/decode cursor round-trip', () => {
    const c = encodeInboxCursor(150)
    expect(decodeInboxCursor(c)).toEqual({ o: 150 })
  })

  it('inboxSearchWhere returns undefined for empty q', () => {
    expect(inboxSearchWhere('')).toBeUndefined()
    expect(inboxSearchWhere('   ')).toBeUndefined()
  })

  it('inboxSearchWhere builds OR for name and digits', () => {
    const w = inboxSearchWhere('john 555')
    expect(w?.OR).toBeDefined()
    expect(Array.isArray(w?.OR)).toBe(true)
  })
})

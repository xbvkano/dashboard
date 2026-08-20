import { describe, expect, it } from 'vitest'
import { formatUnreadBadge } from './unreadBadge'
import {
  EMPTY_ACTION_COUNTS,
  actionCountNotification,
  messagesHomeHref,
  normalizeActionCounts,
} from './actionCounts'

describe('formatUnreadBadge', () => {
  it('hides zero and caps at 99+', () => {
    expect(formatUnreadBadge(0)).toBeNull()
    expect(formatUnreadBadge(-1)).toBeNull()
    expect(formatUnreadBadge(1)).toBe('1')
    expect(formatUnreadBadge(99)).toBe('99')
    expect(formatUnreadBadge(100)).toBe('99+')
  })
})

describe('actionCountNotification', () => {
  const previous = EMPTY_ACTION_COUNTS
  const next = normalizeActionCounts({
    messages: { client: 2, employee: 0 },
    leads: { forms: 0, calls: 0 },
  })

  it('skips notify when the tab is visible or this is the first fetch', () => {
    expect(actionCountNotification({ previous, next, tabHidden: false })).toBeNull()
    expect(actionCountNotification({ previous: null, next, tabHidden: true })).toBeNull()
    expect(actionCountNotification({ previous, next: previous, tabHidden: true })).toBeNull()
  })

  it('notifies when unread counts increase while hidden', () => {
    const note = actionCountNotification({ previous, next, tabHidden: true })
    expect(note).toEqual({
      title: 'New messages',
      body: 'Client inbox: 2',
      href: '/dashboard/messages/inbox',
    })
  })

  it('routes lead-only increases to the leads page', () => {
    const leadNext = normalizeActionCounts({
      messages: { client: 0, employee: 0 },
      leads: { forms: 1, calls: 0 },
    })
    const note = actionCountNotification({ previous, next: leadNext, tabHidden: true })
    expect(note?.title).toBe('New lead')
    expect(note?.href).toBe('/dashboard/messages/leads')
    expect(note?.body).toBe('Forms: 1')
  })
})

describe('messagesHomeHref', () => {
  it('opens the inbox that has unread threads', () => {
    expect(messagesHomeHref({ client: 1, employee: 0, total: 1 })).toBe('/dashboard/messages/inbox')
    expect(messagesHomeHref({ client: 0, employee: 2, total: 2 })).toBe(
      '/dashboard/messages/employee-inbox',
    )
    expect(messagesHomeHref({ client: 1, employee: 1, total: 2 })).toBe('/dashboard/messages')
  })
})

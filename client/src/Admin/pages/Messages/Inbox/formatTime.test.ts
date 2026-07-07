import { describe, expect, it } from 'vitest'
import {
  formatChatDayLabel,
  formatMessageTime,
  groupMessagesByDay,
  isSameCalendarDay,
} from './formatTime'
import type { ThreadMessage } from './types'

function msg(id: number, createdAt: string): ThreadMessage {
  return {
    id,
    direction: 'INBOUND',
    body: 'hi',
    createdAt,
    senderBubbleColor: null,
    media: [],
  }
}

describe('formatMessageTime', () => {
  it('returns time only for today', () => {
    const now = new Date()
    const iso = now.toISOString()
    const result = formatMessageTime(iso)
    const expected = now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    expect(result).toBe(expected)
  })

  it('includes date for messages not from today', () => {
    const d = new Date()
    d.setDate(d.getDate() - 2)
    const result = formatMessageTime(d.toISOString())
    const datePart = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    expect(result).toContain(datePart)
    expect(result).toContain(',')
  })
})

describe('formatChatDayLabel', () => {
  it('returns Today for today', () => {
    expect(formatChatDayLabel(new Date().toISOString())).toBe('Today')
  })

  it('returns Yesterday for yesterday', () => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    expect(formatChatDayLabel(d.toISOString())).toBe('Yesterday')
  })

  it('returns weekday for same year older dates', () => {
    const d = new Date()
    d.setDate(d.getDate() - 10)
    const label = formatChatDayLabel(d.toISOString())
    expect(label).not.toBe('Today')
    expect(label).not.toBe('Yesterday')
    expect(label.length).toBeGreaterThan(0)
  })
})

describe('isSameCalendarDay', () => {
  it('matches same calendar day', () => {
    const a = new Date(2025, 5, 15, 9, 0)
    const b = new Date(2025, 5, 15, 22, 30)
    expect(isSameCalendarDay(a, b)).toBe(true)
  })

  it('does not match different days', () => {
    const a = new Date(2025, 5, 15, 9, 0)
    const b = new Date(2025, 5, 16, 9, 0)
    expect(isSameCalendarDay(a, b)).toBe(false)
  })
})

describe('groupMessagesByDay', () => {
  it('groups consecutive messages by calendar day', () => {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    const messages = [
      msg(1, yesterday.toISOString()),
      msg(2, yesterday.toISOString()),
      msg(3, today.toISOString()),
    ]

    const groups = groupMessagesByDay(messages)
    expect(groups).toHaveLength(2)
    expect(groups[0].messages).toHaveLength(2)
    expect(groups[1].messages).toHaveLength(1)
    expect(groups[1].label).toBe('Today')
  })
})

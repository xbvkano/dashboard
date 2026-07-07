import type { ThreadMessage } from './types'

function startOfCalendarDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

export function isSameCalendarDay(a: Date, b: Date): boolean {
  return startOfCalendarDay(a) === startOfCalendarDay(b)
}

function diffCalendarDays(from: Date, to: Date): number {
  return Math.round((startOfCalendarDay(from) - startOfCalendarDay(to)) / (24 * 60 * 60 * 1000))
}

/** Short time label for message bubbles */
export function formatMessageTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const t = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

  if (isSameCalendarDay(d, now)) return t

  const datePart = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return `${datePart}, ${t}`
}

/** Centered pill label between message day groups */
export function formatChatDayLabel(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffDays = diffCalendarDays(now, d)

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'

  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  }

  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export type MessageDayGroup = {
  dayKey: string
  label: string
  messages: ThreadMessage[]
}

export function groupMessagesByDay(messages: ThreadMessage[]): MessageDayGroup[] {
  const groups: MessageDayGroup[] = []

  for (const message of messages) {
    const d = new Date(message.createdAt)
    const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    const last = groups[groups.length - 1]

    if (last && last.dayKey === dayKey) {
      last.messages.push(message)
    } else {
      groups.push({
        dayKey,
        label: formatChatDayLabel(message.createdAt),
        messages: [message],
      })
    }
  }

  return groups
}

/** Relative day + time for conversation list */
export function formatConversationTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffDays = diffCalendarDays(now, d)

  const t = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

  if (diffDays === 0) return t
  if (diffDays === 1) return `Yesterday`
  if (diffDays < 7) return d.toLocaleDateString(undefined, { weekday: 'short' })
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

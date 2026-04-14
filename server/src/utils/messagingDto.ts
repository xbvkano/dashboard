import type { ConversationInboxItemDto } from '../types/messaging'

export function previewBody(body: string, max = 140): string {
  const t = body.trim()
  if (t.length <= max) return t
  return t.slice(0, max - 1) + '…'
}

type InboxRow = {
  id: number
  channel: string
  status: string
  businessNumber: string
  lastMessageAt: Date | null
  contactPoint: {
    id: number
    type: string
    value: string
    displayValue: string | null
    blocked: boolean
  }
  client: { id: number; name: string; number: string; notes: string | null } | null
  sessions: Array<{ id: number; openedAt: Date }>
  messages: Array<{ id: number; body: string; mediaCount?: number; direction?: string }>
  userReads?: Array<{ lastReadMessageId: number | null }>
}

export function computeUnread(
  lastMessageId: number | undefined,
  lastReadMessageId: number | null | undefined
): boolean {
  if (lastMessageId == null) return false
  if (lastReadMessageId == null) return true
  return lastMessageId > lastReadMessageId
}

export function lastMessagePreviewText(last: { body: string; mediaCount?: number } | undefined): string | null {
  if (!last) return null
  const t = last.body.trim()
  if (t.length > 0) return previewBody(t)
  if ((last.mediaCount ?? 0) > 0) return '📷 Photo'
  return null
}

export function mapConversationsToInboxDto(rows: InboxRow[]): ConversationInboxItemDto[] {
  return rows.map((c) => {
    const last = c.messages[0]
    const open = c.sessions[0]
    const lastReadMessageId = c.userReads?.[0]?.lastReadMessageId ?? null
    const lastMessageId = last?.id ?? null
    /** Staff outbound does not count as unread — only inbound customer messages do. */
    let unread = false
    if (last) {
      if (last.direction === 'OUTBOUND') {
        unread = false
      } else {
        unread = computeUnread(last.id, lastReadMessageId)
      }
    }
    return {
      id: c.id,
      channel: c.channel,
      status: c.status,
      businessNumber: c.businessNumber,
      lastMessageAt: c.lastMessageAt?.toISOString() ?? null,
      lastMessageId,
      unread,
      contactPoint: {
        id: c.contactPoint.id,
        type: c.contactPoint.type,
        value: c.contactPoint.value,
        displayValue: c.contactPoint.displayValue,
        blocked: c.contactPoint.blocked,
      },
      client: c.client
        ? {
            id: c.client.id,
            name: c.client.name,
            number: c.client.number,
            notes: c.client.notes ?? null,
          }
        : null,
      lastMessagePreview: lastMessagePreviewText(last),
      openSession: open
        ? { id: open.id, openedAt: open.openedAt.toISOString() }
        : null,
    }
  })
}

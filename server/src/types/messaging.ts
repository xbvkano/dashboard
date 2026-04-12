/** API DTOs for messaging routes */

export interface ConversationInboxItemDto {
  id: number
  channel: string
  status: string
  businessNumber: string
  lastMessageAt: string | null
  contactPoint: {
    id: number
    type: string
    value: string
    displayValue: string | null
    blocked: boolean
  }
  client: { id: number; name: string; number: string; notes: string | null } | null
  lastMessagePreview: string | null
  openSession: { id: number; openedAt: string } | null
}

export interface ConversationDetailDto {
  conversation: {
    id: number
    channel: string
    status: string
    businessNumber: string
    lastMessageAt: string | null
    openedAt: string
    archivedAt: string | null
    clientId: number | null
  }
  contactPoint: {
    id: number
    type: string
    value: string
    displayValue: string | null
    clientId: number | null
  }
  client: { id: number; name: string; number: string; notes: string | null } | null
  sessions: Array<{
    id: number
    openedAt: string
    closedAt: string | null
    closeReason: string | null
    summary: string | null
    bookingIntent: string | null
    confidence: number | null
    appointments: Array<{
      id: number
      date: string
      time: string
      address: string
      status: string
    }>
  }>
  messages: Array<{
    id: number
    direction: string
    senderType: string
    body: string
    status: string
    createdAt: string
    userId: number | null
    sessionId: number | null
    mediaCount: number
    media: Array<{
      id: number
      publicUrl: string | null
      mimeType: string
      fileName: string | null
      fileSize: number | null
      width: number | null
      height: number | null
      sortOrder: number
    }>
  }>
}

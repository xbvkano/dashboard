import { API_BASE_URL, fetchJson } from '../../../../api'

const skipNgrokWarning =
  import.meta.env.VITE_NGROK === 'true' || import.meta.env.VITE_NGROK === '1'

/** Mirrors server ConversationInboxItemDto */
export type ConversationInboxItem = {
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

/** Mirrors server ConversationDetailDto */
export type ConversationDetail = {
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

export async function fetchConversations(): Promise<ConversationInboxItem[]> {
  return fetchJson(`${API_BASE_URL}/messaging/conversations`)
}

export async function fetchConversationDetail(id: number): Promise<ConversationDetail> {
  return fetchJson(`${API_BASE_URL}/messaging/conversations/${id}`)
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text()
  const contentType = response.headers.get('content-type') || ''
  if (!response.ok) {
    console.error('Request failed', response.status, text)
    throw new Error(text || `Request failed with status ${response.status}`)
  }
  if (!contentType.includes('application/json')) {
    throw new Error('Invalid JSON response')
  }
  return JSON.parse(text)
}

export async function postOutboundMessage(
  conversationId: number,
  body: string,
  options?: { mockSms?: boolean; files?: File[] }
): Promise<{ message: Record<string, unknown> }> {
  const url = `${API_BASE_URL}/messaging/conversations/${conversationId}/messages`
  const files = options?.files?.filter(Boolean) ?? []

  if (files.length > 0) {
    const form = new FormData()
    const t = body.trim()
    if (t) form.append('body', t)
    for (const f of files) {
      form.append('media', f)
    }
    const headers: Record<string, string> = {}
    if (options?.mockSms) headers['X-Messaging-Mock-Sms'] = '1'
    if (skipNgrokWarning) headers['ngrok-skip-browser-warning'] = '1'
    const response = await fetch(url, { method: 'POST', headers, body: form })
    return parseJsonResponse(response) as Promise<{ message: Record<string, unknown> }>
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (options?.mockSms) {
    headers['X-Messaging-Mock-Sms'] = '1'
  }
  return fetchJson(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ body }),
  })
}

export async function startConversationFromContact(input: {
  phoneRaw: string
  name?: string | null
  notes?: string | null
}): Promise<{ conversationId: number; contactPointId: number; clientId: number | null }> {
  return fetchJson(`${API_BASE_URL}/messaging/contacts/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export async function patchConversationClient(
  conversationId: number,
  input: { name?: string | null; notes?: string | null }
): Promise<{ clientId: number }> {
  return fetchJson(`${API_BASE_URL}/messaging/conversations/${conversationId}/client`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export function formatApiError(e: unknown): string {
  if (e instanceof Error) {
    try {
      const p = JSON.parse(e.message) as { error?: string }
      if (p?.error) return p.error
    } catch {
      /* ignore */
    }
    return e.message
  }
  return 'Something went wrong'
}

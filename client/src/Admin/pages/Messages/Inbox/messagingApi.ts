import { API_BASE_URL, attachDashboardUserHeaders, fetchJson } from '../../../../api'
import type { ThreadContact } from './types'

const skipNgrokWarning =
  import.meta.env.VITE_NGROK === 'true' || import.meta.env.VITE_NGROK === '1'

function currentUserIdBody(): { userId?: number } {
  try {
    const uid = localStorage.getItem('userId')
    if (uid && /^\d+$/.test(uid)) return { userId: parseInt(uid, 10) }
  } catch {
    /* ignore */
  }
  return {}
}

/** Mirrors server ConversationInboxItemDto */
export type ConversationInboxItem = {
  id: number
  channel: string
  status: string
  businessNumber: string
  lastMessageAt: string | null
  lastMessageId: number | null
  unread: boolean
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

export type ConversationsPageResponse = {
  items: ConversationInboxItem[]
  nextCursor: string | null
}

/** Map API inbox row → thread list item (shared by Inbox + dev simulate UI) */
export function conversationInboxItemToThreadContact(row: ConversationInboxItem): ThreadContact {
  return {
    id: row.id,
    businessNumber: row.businessNumber,
    phoneE164: row.contactPoint.value,
    contactName: row.client?.name ?? null,
    clientNotes: row.client?.notes ?? null,
    clientId: row.client?.id ?? null,
    lastPreview: row.lastMessagePreview,
    lastAt: row.lastMessageAt,
    unread: row.unread,
  }
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
    senderBubbleColor: string | null
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

export async function fetchConversationsPage(options?: {
  limit?: number
  cursor?: string | null
  q?: string
  /** Default OPEN. Use ARCHIVED for archived threads. */
  status?: 'OPEN' | 'ARCHIVED'
}): Promise<ConversationsPageResponse> {
  const params = new URLSearchParams()
  if (options?.limit != null) params.set('limit', String(options.limit))
  if (options?.cursor) params.set('cursor', options.cursor)
  if (options?.q?.trim()) params.set('q', options.q.trim())
  if (options?.status === 'ARCHIVED') params.set('status', 'ARCHIVED')
  const qs = params.toString()
  const url = `${API_BASE_URL}/messaging/conversations${qs ? `?${qs}` : ''}`
  return fetchJson(url)
}

export async function patchConversationStatus(
  conversationId: number,
  status: 'OPEN' | 'ARCHIVED',
): Promise<{ ok: boolean; status: string }> {
  return fetchJson(`${API_BASE_URL}/messaging/conversations/${conversationId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  })
}

export async function fetchConversationDetail(id: number): Promise<ConversationDetail> {
  return fetchJson(`${API_BASE_URL}/messaging/conversations/${id}`)
}

/** Dev: POST Twilio-shaped payload to `/messaging/inbound` (same path as Twilio webhook). */
export async function postSimulateInboundMessage(input: {
  fromE164: string
  toE164: string
  body: string
}): Promise<{ ok: boolean; conversationId: number; messageId: number; sessionId: number }> {
  return fetchJson(`${API_BASE_URL}/messaging/inbound`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      From: input.fromE164,
      To: input.toE164,
      Body: input.body,
      MessageSid: `SM_SIM_${Date.now()}`,
      NumMedia: '0',
    }),
  })
}

export async function postMarkConversationRead(conversationId: number): Promise<void> {
  await fetchJson(`${API_BASE_URL}/messaging/conversations/${conversationId}/read`, {
    method: 'POST',
  })
}

export async function postConversationPresence(conversationId: number): Promise<void> {
  await fetchJson(`${API_BASE_URL}/messaging/conversations/${conversationId}/presence`, {
    method: 'POST',
  })
}

export async function deleteConversationPresence(conversationId: number): Promise<void> {
  await fetchJson(`${API_BASE_URL}/messaging/conversations/${conversationId}/presence`, {
    method: 'DELETE',
  })
}

export type InboxLeaseResult =
  | { ok: true }
  | { ok: false; conflict: true; holderUserId?: number; leaseUntil?: string }

export async function postInboxLeaseRequest(options?: {
  tabId?: string
  force?: boolean
}): Promise<InboxLeaseResult> {
  const headers = new Headers({ 'Content-Type': 'application/json' })
  attachDashboardUserHeaders(headers)
  if (skipNgrokWarning) headers.set('ngrok-skip-browser-warning', '1')
  const res = await fetch(`${API_BASE_URL}/messaging/inbox/lease`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      tabId: options?.tabId,
      force: options?.force,
    }),
  })
  const text = await res.text()
  if (res.ok) {
    return { ok: true }
  }
  if (res.status === 409) {
    try {
      const j = JSON.parse(text) as { holderUserId?: number; leaseUntil?: string }
      return { ok: false, conflict: true, holderUserId: j.holderUserId, leaseUntil: j.leaseUntil }
    } catch {
      return { ok: false, conflict: true }
    }
  }
  throw new Error(text || `Lease failed (${res.status})`)
}

export async function deleteInboxLease(): Promise<void> {
  await fetchJson(`${API_BASE_URL}/messaging/inbox/lease`, {
    method: 'DELETE',
  })
}

export async function postTranslateMessage(text: string): Promise<{ translatedText: string }> {
  return fetchJson(`${API_BASE_URL}/messaging/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
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
  const uid = currentUserIdBody().userId

  if (files.length > 0) {
    const form = new FormData()
    const t = body.trim()
    if (t) form.append('body', t)
    if (uid != null) form.append('userId', String(uid))
    for (const f of files) {
      form.append('media', f)
    }
    const headers = new Headers()
    attachDashboardUserHeaders(headers)
    if (options?.mockSms) headers.set('X-Messaging-Mock-Sms', '1')
    if (skipNgrokWarning) headers.set('ngrok-skip-browser-warning', '1')
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
    body: JSON.stringify({ body, ...currentUserIdBody() }),
  })
}

export async function startConversationFromContact(input: {
  phoneRaw: string
  name?: string | null
  notes?: string | null
  /** Stored on new Client.from (e.g. Form, Call). */
  clientFrom?: string | null
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

export type MessagingBookAppointmentInput = {
  clientName?: string
  appointmentAddress: string
  price: number
  date: string
  time: string
  notes?: string
  size: string
  serviceType: 'STANDARD' | 'DEEP' | 'MOVE_IN_OUT'
  bookingScreenshotUrls?: string[]
}

export type MessagingBookAppointmentResponse = {
  success: true
  message: string
  sessionId: number
  appointment: Record<string, unknown>
  client: Record<string, unknown>
  template: Record<string, unknown>
}

export async function postBookAppointmentFromConversation(
  conversationId: number,
  input: MessagingBookAppointmentInput,
): Promise<MessagingBookAppointmentResponse> {
  return fetchJson(`${API_BASE_URL}/messaging/conversations/${conversationId}/book-appointment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export type MessagingScreenshotBookAppointmentInput = {
  phoneRaw: string
  clientName: string
  appointmentAddress: string
  price: number
  date: string
  time: string
  notes?: string
  size: string
  serviceType: 'STANDARD' | 'DEEP' | 'MOVE_IN_OUT'
  bookingScreenshotUrls?: string[]
}

export async function postBookAppointmentFromScreenshot(
  input: MessagingScreenshotBookAppointmentInput,
): Promise<MessagingBookAppointmentResponse> {
  return fetchJson(`${API_BASE_URL}/messaging/book-appointment/screenshot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export type AppointmentExtractionFieldKey =
  | 'clientName'
  | 'clientPhone'
  | 'appointmentAddress'
  | 'price'
  | 'date'
  | 'time'
  | 'notes'
  | 'size'
  | 'serviceType'

export type AppointmentExtractionResult = {
  draft: {
    clientName?: string
    clientPhone?: string
    appointmentAddress?: string
    price?: string
    date?: string
    time?: string
    notes?: string
    size?: string
    serviceType?: '' | 'STANDARD' | 'DEEP' | 'MOVE_IN_OUT'
  }
  missingRequiredFields: AppointmentExtractionFieldKey[]
  notFoundNotes: string[]
  sizeSource: 'thread' | 'rentcast' | null
  sizeLookupFailed: boolean
  fieldHighlights: Partial<Record<AppointmentExtractionFieldKey, 'ai_missing' | 'lookup_failed'>>
  storedImages?: Array<{ storageKey: string; publicUrl: string }>
}

export async function postExtractAppointmentFromConversation(
  conversationId: number,
): Promise<AppointmentExtractionResult> {
  return fetchJson(`${API_BASE_URL}/messaging/conversations/${conversationId}/extract-appointment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
}

export async function postExtractAppointmentFromImages(
  conversationId: number,
  files: File[],
): Promise<AppointmentExtractionResult> {
  const url = `${API_BASE_URL}/messaging/conversations/${conversationId}/extract-appointment/images`
  const form = new FormData()
  for (const f of files) {
    form.append('images', f)
  }
  const headers = new Headers()
  attachDashboardUserHeaders(headers)
  if (skipNgrokWarning) headers.set('ngrok-skip-browser-warning', '1')
  const res = await fetch(url, { method: 'POST', headers, body: form })
  const text = await res.text()
  if (!res.ok) {
    console.error('Extract images failed', res.status, text)
    throw new Error(text || `Request failed with status ${res.status}`)
  }
  return JSON.parse(text) as AppointmentExtractionResult
}

/** Screenshots from outside the CRM — no conversation id. */
export async function postExtractAppointmentFromStandaloneImages(
  files: File[],
  reuse?: Array<{ publicUrl: string; storageKey?: string }>,
): Promise<AppointmentExtractionResult> {
  const url = `${API_BASE_URL}/messaging/extract-appointment/screenshots`
  const form = new FormData()
  for (const f of files) {
    form.append('images', f)
  }
  if (reuse?.length) {
    form.append('reuse', JSON.stringify(reuse))
  }
  const headers = new Headers()
  attachDashboardUserHeaders(headers)
  if (skipNgrokWarning) headers.set('ngrok-skip-browser-warning', '1')
  const res = await fetch(url, { method: 'POST', headers, body: form })
  const text = await res.text()
  if (!res.ok) {
    console.error('Standalone extract failed', res.status, text)
    throw new Error(text || `Request failed with status ${res.status}`)
  }
  return JSON.parse(text) as AppointmentExtractionResult
}

export type ClientAppointment = {
  id: number
  date: string
  time: string
  address: string | null
  type: 'STANDARD' | 'DEEP' | 'MOVE_IN_OUT'
  size: string | null
  price: number
  notes: string | null
}

/** Draft key for screenshot booking (no CRM conversation). */
export const SCREENSHOT_BOOKING_CONVERSATION_ID = 0

export async function fetchClientAppointments(clientId: number, take = 25): Promise<ClientAppointment[]> {
  const params = new URLSearchParams()
  params.set('take', String(take))
  const qs = params.toString()
  return fetchJson(`${API_BASE_URL}/clients/${clientId}/appointments?${qs}`)
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

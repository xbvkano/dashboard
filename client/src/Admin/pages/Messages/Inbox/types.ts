/** UI thread header + list row (backed by API client + contact point) */
export type ThreadContact = {
  id: number
  phoneE164: string
  contactName: string | null
  clientNotes: string | null
  clientId: number | null
  lastPreview: string | null
  lastAt: string | null
}

export type ThreadMessageMedia = {
  id: number
  publicUrl: string | null
  mimeType: string
  fileName: string | null
  sortOrder: number
}

export type ThreadMessage = {
  id: number
  direction: string
  body: string
  createdAt: string
  media: ThreadMessageMedia[]
}

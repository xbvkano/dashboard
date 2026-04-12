import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ConversationList from './components/ConversationList'
import ChatThread from './components/ChatThread'
import NewConversationModal from './components/NewConversationModal'
import EditContactModal from './components/EditContactModal'
import { useMediaQuery } from './useMediaQuery'
import type { ConversationDetail, ConversationInboxItem } from './messagingApi'
import {
  fetchConversationDetail,
  fetchConversations,
  postOutboundMessage,
} from './messagingApi'
import type { ThreadContact, ThreadMessage } from './types'
import { isDevToolsEnabled } from '../../../../devTools'

const MESSAGING_MOCK_SESSION_KEY = 'messagingMockSms'

function shouldShowInboxMockingToggle(): boolean {
  if (!isDevToolsEnabled) return false
  if (typeof window === 'undefined') return false
  const r = localStorage.getItem('role')
  return r === 'ADMIN' || r === 'OWNER'
}

function readInitialMockingEnabled(): boolean {
  if (!isDevToolsEnabled) return false
  try {
    const v = sessionStorage.getItem(MESSAGING_MOCK_SESSION_KEY)
    if (v === null) return true
    return v === '1'
  } catch {
    return true
  }
}

/** Poll open thread for new inbound messages without full page refresh */
const DETAIL_POLL_MS = 2500
/** Keep conversation list previews / order in sync */
const LIST_POLL_MS = 5000

function rowToThread(row: ConversationInboxItem): ThreadContact {
  return {
    id: row.id,
    phoneE164: row.contactPoint.value,
    contactName: row.client?.name ?? null,
    clientNotes: row.client?.notes ?? null,
    clientId: row.client?.id ?? null,
    lastPreview: row.lastMessagePreview,
    lastAt: row.lastMessageAt,
  }
}

function detailToMessages(detail: ConversationDetail): ThreadMessage[] {
  return detail.messages.map((m) => ({
    id: m.id,
    direction: m.direction,
    body: m.body,
    createdAt: m.createdAt,
    media: (m.media ?? []).map((x) => ({
      id: x.id,
      publicUrl: x.publicUrl,
      mimeType: x.mimeType,
      fileName: x.fileName,
      sortOrder: x.sortOrder,
    })),
  }))
}

function mergedThread(
  row: ConversationInboxItem | undefined,
  detail: ConversationDetail | null,
  selectedId: number | null
): ThreadContact | null {
  if (!selectedId || !row) return null
  const d = detail?.conversation.id === selectedId ? detail : null
  const client = d?.client ?? row.client
  return {
    id: selectedId,
    phoneE164: d?.contactPoint.value ?? row.contactPoint.value,
    contactName: client?.name ?? null,
    clientNotes: client?.notes ?? null,
    clientId: client?.id ?? row.client?.id ?? null,
    lastPreview: row.lastMessagePreview,
    lastAt: row.lastMessageAt,
  }
}

export default function Inbox() {
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const [list, setList] = useState<ConversationInboxItem[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<ConversationDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [mockingEnabled, setMockingEnabled] = useState(readInitialMockingEnabled)
  const didInitSelect = useRef(false)
  const selectedIdRef = useRef<number | null>(null)
  selectedIdRef.current = selectedId

  const showMockingToggle = shouldShowInboxMockingToggle()

  useEffect(() => {
    if (!isDevToolsEnabled) {
      setMockingEnabled(false)
      try {
        sessionStorage.removeItem(MESSAGING_MOCK_SESSION_KEY)
      } catch {
        /* ignore */
      }
    }
  }, [])

  useEffect(() => {
    try {
      sessionStorage.setItem(MESSAGING_MOCK_SESSION_KEY, mockingEnabled ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [mockingEnabled])

  /**
   * Inbox scrolls inside the thread/list only. Without this, new photos / poll updates can grow
   * the main column and scroll the whole document (negative html offset in devtools).
   */
  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const prevHtml = html.style.overflow
    const prevBody = body.style.overflow
    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    return () => {
      html.style.overflow = prevHtml
      body.style.overflow = prevBody
    }
  }, [])

  const refreshList = useCallback(async () => {
    const rows = await fetchConversations()
    setList(rows)
    return rows
  }, [])

  useEffect(() => {
    let cancelled = false
    setListLoading(true)
    setListError(null)
    fetchConversations()
      .then((rows) => {
        if (!cancelled) {
          setList(rows)
        }
      })
      .catch((e) => {
        console.error(e)
        if (!cancelled) setListError('Could not load conversations')
      })
      .finally(() => {
        if (!cancelled) setListLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (didInitSelect.current || !isDesktop || list.length === 0) return
    setSelectedId(list[0].id)
    didInitSelect.current = true
  }, [list, isDesktop])

  useEffect(() => {
    if (selectedId == null) {
      setDetail(null)
      return
    }
    setDetail(null)
    let cancelled = false
    setDetailLoading(true)
    fetchConversationDetail(selectedId)
      .then((d) => {
        if (!cancelled) setDetail(d)
      })
      .catch((e) => {
        console.error(e)
        if (!cancelled) setDetail(null)
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedId])

  /** Background poll: new inbound SMS appears without manual refresh */
  useEffect(() => {
    if (selectedId == null) return

    const pollDetail = () => {
      if (document.visibilityState === 'hidden') return
      const id = selectedIdRef.current
      if (id == null) return
      fetchConversationDetail(id)
        .then((d) => {
          if (d.conversation.id === selectedIdRef.current) {
            setDetail(d)
          }
        })
        .catch(() => {
          /* offline / transient; next tick retries */
        })
    }

    const interval = setInterval(pollDetail, DETAIL_POLL_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') pollDetail()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [selectedId])

  /** Refresh list periodically so previews and new threads update */
  useEffect(() => {
    const pollList = () => {
      if (document.visibilityState === 'hidden') return
      fetchConversations()
        .then(setList)
        .catch(() => {})
    }
    const interval = setInterval(pollList, LIST_POLL_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') pollList()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  const threadRows = useMemo(() => list.map(rowToThread), [list])
  const selectedRow = useMemo(
    () => list.find((r) => r.id === selectedId),
    [list, selectedId]
  )
  const threadContact = useMemo(
    () => mergedThread(selectedRow, detail, selectedId),
    [selectedRow, detail, selectedId]
  )
  const messages = useMemo(() => {
    if (!detail || detail.conversation.id !== selectedId) return []
    return detailToMessages(detail)
  }, [detail, selectedId])

  useEffect(() => {
    const chatOpen = Boolean(selectedId && !isDesktop)
    if (chatOpen) document.body.classList.add('messages-inbox-chat-open')
    else document.body.classList.remove('messages-inbox-chat-open')
    return () => document.body.classList.remove('messages-inbox-chat-open')
  }, [selectedId, isDesktop])

  const handleSend = useCallback(
    async (text: string, files?: File[]) => {
      if (!selectedId) return
      try {
        const mockSms = Boolean(isDevToolsEnabled && showMockingToggle && mockingEnabled)
        if (mockSms) {
          console.log(
            '[messaging-mock-sms] outbound not sent via Twilio (mock); see server log for payload',
            { conversationId: selectedId },
          )
        }
        await postOutboundMessage(selectedId, text, {
          mockSms,
          files,
        })
        const d = await fetchConversationDetail(selectedId)
        setDetail(d)
        await refreshList()
      } catch (e) {
        console.error(e)
      }
    },
    [selectedId, refreshList, showMockingToggle, mockingEnabled]
  )

  const handleBack = useCallback(() => {
    setSelectedId(null)
  }, [])

  const handleSelect = useCallback((id: number) => {
    setSelectedId(id)
  }, [])

  const handleNewCreated = useCallback(
    async (conversationId: number) => {
      await refreshList()
      setSelectedId(conversationId)
    },
    [refreshList]
  )

  const handleEditSaved = useCallback(async () => {
    await refreshList()
    if (selectedId != null) {
      try {
        const d = await fetchConversationDetail(selectedId)
        setDetail(d)
      } catch (e) {
        console.error(e)
      }
    }
  }, [selectedId, refreshList])

  return (
    <div className="messages-inbox-root flex min-h-0 flex-col overflow-hidden md:flex-row h-[calc(100dvh-3.5rem)] max-h-[calc(100dvh-3.5rem)] md:h-[calc(100vh-3.5rem)] md:max-h-[calc(100vh-3.5rem)]">
      {listError && (
        <div className="px-3 py-2 text-sm text-red-700 bg-red-50 border-b border-red-100 shrink-0">
          {listError}
        </div>
      )}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row md:gap-0 md:px-2">
        <div
          className={`flex flex-col min-h-0 md:w-[min(100%,22rem)] md:shrink-0 ${
            selectedId && !isDesktop ? 'hidden' : 'flex flex-1 md:flex-none md:h-full'
          }`}
        >
          <div className="flex-1 min-h-0 md:h-full border-0 md:border md:border-slate-200 md:rounded-l-xl overflow-hidden shadow-none md:shadow-sm">
            <ConversationList
              conversations={threadRows}
              selectedId={selectedId}
              onSelect={handleSelect}
              onNewConversation={() => setNewOpen(true)}
              listLoading={listLoading}
              showMockingToggle={showMockingToggle}
              mockingEnabled={mockingEnabled}
              onMockingChange={setMockingEnabled}
            />
          </div>
        </div>

        <div className="hidden md:flex flex-1 flex-col min-h-0 min-w-0 border border-l-0 border-slate-200 rounded-r-xl overflow-hidden bg-[#e5e5ea] shadow-sm">
          {threadContact ? (
            <ChatThread
              conversation={threadContact}
              messages={messages}
              showBack={false}
              onBack={() => {}}
              onSend={handleSend}
              onEditContact={() => setEditOpen(true)}
              detailLoading={detailLoading}
              showMockingToggle={showMockingToggle}
              mockingEnabled={mockingEnabled}
              onMockingChange={setMockingEnabled}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-sm px-6">
              <p className="font-medium text-slate-700">Select a conversation</p>
              <p className="mt-1 text-center">Choose a thread on the left to read messages.</p>
            </div>
          )}
        </div>
      </div>

      {selectedId && !isDesktop && threadContact && (
        <div className="fixed inset-0 z-[100] flex flex-col md:hidden bg-[#e5e5ea]">
          <ChatThread
            conversation={threadContact}
            messages={messages}
            showBack
            onBack={handleBack}
            onSend={handleSend}
            onEditContact={() => setEditOpen(true)}
            detailLoading={detailLoading}
            showMockingToggle={showMockingToggle}
            mockingEnabled={mockingEnabled}
            onMockingChange={setMockingEnabled}
          />
        </div>
      )}

      <NewConversationModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={handleNewCreated}
      />
      {selectedId != null && threadContact && (
        <EditContactModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          conversationId={selectedId}
          initialName={threadContact.contactName ?? ''}
          initialNotes={threadContact.clientNotes ?? ''}
          onSaved={handleEditSaved}
        />
      )}
    </div>
  )
}

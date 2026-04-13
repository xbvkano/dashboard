import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ConversationList from './components/ConversationList'
import ChatThread from './components/ChatThread'
import InboxTakeOverConfirmModal from './components/InboxTakeOverConfirmModal'
import NewConversationModal from './components/NewConversationModal'
import EditContactModal from './components/EditContactModal'
import { useMediaQuery } from './useMediaQuery'
import {
  type ConversationDetail,
  type ConversationInboxItem,
  conversationInboxItemToThreadContact,
} from './messagingApi'
import {
  deleteConversationPresence,
  deleteInboxLease,
  fetchConversationDetail,
  fetchConversationsPage,
  postConversationPresence,
  postInboxLeaseRequest,
  postMarkConversationRead,
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

const rowToThread = conversationInboxItemToThreadContact

function detailToMessages(detail: ConversationDetail): ThreadMessage[] {
  return detail.messages.map((m) => ({
    id: m.id,
    direction: m.direction,
    body: m.body,
    createdAt: m.createdAt,
    senderBubbleColor: m.senderBubbleColor ?? null,
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
    businessNumber: d?.conversation.businessNumber ?? row.businessNumber,
    phoneE164: d?.contactPoint.value ?? row.contactPoint.value,
    contactName: client?.name ?? null,
    clientNotes: client?.notes ?? null,
    clientId: client?.id ?? row.client?.id ?? null,
    lastPreview: row.lastMessagePreview,
    lastAt: row.lastMessageAt,
    unread: row.unread,
  }
}

export default function Inbox() {
  const navigate = useNavigate()
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const [list, setList] = useState<ConversationInboxItem[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [listLoadingMore, setListLoadingMore] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [leaseBlocked, setLeaseBlocked] = useState(false)
  const [takeOverModalOpen, setTakeOverModalOpen] = useState(false)
  const [takeOverSubmitting, setTakeOverSubmitting] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<ConversationDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [mockingEnabled, setMockingEnabled] = useState(readInitialMockingEnabled)
  const didInitSelect = useRef(false)
  const selectedIdRef = useRef<number | null>(null)
  const markedReadForConversationRef = useRef<number | null>(null)
  const lastDetailMaxMessageIdRef = useRef<number | null>(null)
  const tabIdRef = useRef(
    typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now())
  )
  selectedIdRef.current = selectedId

  const showMockingToggle = shouldShowInboxMockingToggle()
  const role = typeof window !== 'undefined' ? localStorage.getItem('role') : null
  const canTakeOverLease = role === 'OWNER' || role === 'ADMIN'

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchInput), 350)
    return () => window.clearTimeout(t)
  }, [searchInput])

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
    const res = await fetchConversationsPage({ limit: 50, q: debouncedSearch || undefined })
    setList(res.items)
    setNextCursor(res.nextCursor)
    return res.items
  }, [debouncedSearch])

  useEffect(() => {
    let cancelled = false
    setListLoading(true)
    setListError(null)
    setNextCursor(null)
    fetchConversationsPage({ limit: 50, q: debouncedSearch || undefined })
      .then((res) => {
        if (!cancelled) {
          setList(res.items)
          setNextCursor(res.nextCursor)
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
  }, [debouncedSearch])

  /** Global inbox lease (single active viewer) */
  useEffect(() => {
    const run = async () => {
      try {
        const r = await postInboxLeaseRequest({ tabId: tabIdRef.current })
        setLeaseBlocked(!r.ok && r.conflict)
      } catch {
        /* ignore transient */
      }
    }
    run()
    const interval = window.setInterval(run, 25_000)
    return () => {
      window.clearInterval(interval)
      deleteInboxLease().catch(() => {})
    }
  }, [])

  const handleGoHomeFromLeaseGate = useCallback(() => {
    navigate('/dashboard')
  }, [navigate])

  const handleTakeOverInboxConfirm = useCallback(async () => {
    setTakeOverSubmitting(true)
    try {
      const r = await postInboxLeaseRequest({ tabId: tabIdRef.current, force: true })
      setLeaseBlocked(!r.ok && r.conflict)
      setTakeOverModalOpen(false)
    } catch (e) {
      console.error(e)
    } finally {
      setTakeOverSubmitting(false)
    }
  }, [])

  useEffect(() => {
    if (!leaseBlocked) setTakeOverModalOpen(false)
  }, [leaseBlocked])

  useEffect(() => {
    if (!takeOverModalOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !takeOverSubmitting) {
        setTakeOverModalOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [takeOverModalOpen, takeOverSubmitting])

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

  useEffect(() => {
    markedReadForConversationRef.current = null
    lastDetailMaxMessageIdRef.current = null
  }, [selectedId])

  /** Keep max message id in sync for poll-based “new inbound while thread open” mark-read */
  useEffect(() => {
    if (!detail || detail.conversation.id !== selectedId) return
    const ids = detail.messages.map((m) => m.id)
    lastDetailMaxMessageIdRef.current = ids.length ? Math.max(...ids) : null
  }, [detail, selectedId])

  /** Mark read when thread detail loads */
  useEffect(() => {
    if (selectedId == null || !detail || detail.conversation.id !== selectedId) return
    if (markedReadForConversationRef.current === selectedId) return
    markedReadForConversationRef.current = selectedId
    postMarkConversationRead(selectedId)
      .then(() => {
        setList((prev) => prev.map((r) => (r.id === selectedId ? { ...r, unread: false } : r)))
      })
      .catch(() => {})
  }, [selectedId, detail])

  /**
   * Presence heartbeat while this thread is open *and* the tab is visible.
   * When hidden, clear presence so inbound SMS can notify (Pushover) and stay unread.
   */
  useEffect(() => {
    if (selectedId == null) return
    const id = selectedId
    const tick = () => {
      if (document.visibilityState === 'hidden') return
      postConversationPresence(id).catch(() => {})
    }
    tick()
    const interval = window.setInterval(tick, 15_000)
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        deleteConversationPresence(id).catch(() => {})
      } else {
        tick()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
      deleteConversationPresence(id).catch(() => {})
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
          if (d.conversation.id !== selectedIdRef.current) return
          const ids = d.messages.map((m) => m.id)
          const maxId = ids.length === 0 ? null : Math.max(...ids)
          const prevMax = lastDetailMaxMessageIdRef.current
          setDetail(d)
          if (
            maxId != null &&
            prevMax != null &&
            maxId > prevMax &&
            selectedIdRef.current != null
          ) {
            postMarkConversationRead(selectedIdRef.current)
              .then(() => {
                setList((prevList) =>
                  prevList.map((r) =>
                    r.id === selectedIdRef.current ? { ...r, unread: false } : r,
                  ),
                )
              })
              .catch(() => {})
          }
        })
        .catch(() => {
          /* offline / transient; next tick retries */
        })
    }

    const interval = window.setInterval(pollDetail, DETAIL_POLL_MS)
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
      fetchConversationsPage({ limit: 50, q: debouncedSearch || undefined })
        .then((res) => {
          setList(res.items)
          setNextCursor(res.nextCursor)
        })
        .catch(() => {})
    }
    const interval = window.setInterval(pollList, LIST_POLL_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') pollList()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [debouncedSearch])

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

  const handleLoadMore = useCallback(async () => {
    if (!nextCursor || listLoadingMore) return
    setListLoadingMore(true)
    try {
      const res = await fetchConversationsPage({
        limit: 50,
        cursor: nextCursor,
        q: debouncedSearch || undefined,
      })
      setList((prev) => {
        const seen = new Set(prev.map((p) => p.id))
        return [...prev, ...res.items.filter((i) => !seen.has(i.id))]
      })
      setNextCursor(res.nextCursor)
    } catch (e) {
      console.error(e)
    } finally {
      setListLoadingMore(false)
    }
  }, [nextCursor, listLoadingMore, debouncedSearch])

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

  const handleSimulateInboundSuccess = useCallback(async () => {
    await refreshList()
    const id = selectedIdRef.current
    if (id == null) return
    try {
      const d = await fetchConversationDetail(id)
      if (d.conversation.id === selectedIdRef.current) {
        setDetail(d)
      }
    } catch {
      /* ignore */
    }
  }, [refreshList])

  return (
    <div className="messages-inbox-root flex min-h-0 flex-col overflow-hidden md:flex-row h-[calc(100dvh-3.5rem)] max-h-[calc(100dvh-3.5rem)] md:h-[calc(100vh-3.5rem)] md:max-h-[calc(100vh-3.5rem)]">
      {leaseBlocked && (
        <>
          <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-slate-900/75 backdrop-blur-sm p-4 text-center">
            <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200/90 px-6 py-8">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
                <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.75}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-slate-900">Messaging is open elsewhere</h2>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Another tab or browser session is using the inbox. Close it when you’re done, go back to
                the dashboard, or take over if you need access here.
              </p>
              <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center sm:flex-wrap">
                <button
                  type="button"
                  onClick={handleGoHomeFromLeaseGate}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
                >
                  Back to home
                </button>
                {canTakeOverLease && (
                  <button
                    type="button"
                    onClick={() => setTakeOverModalOpen(true)}
                    className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
                  >
                    Take over
                  </button>
                )}
              </div>
            </div>
          </div>
          <InboxTakeOverConfirmModal
            open={takeOverModalOpen}
            onClose={() => {
              if (!takeOverSubmitting) setTakeOverModalOpen(false)
            }}
            onConfirm={handleTakeOverInboxConfirm}
            confirming={takeOverSubmitting}
          />
        </>
      )}
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
              listLoadingMore={listLoadingMore}
              hasMore={Boolean(nextCursor)}
              onLoadMore={handleLoadMore}
              searchQuery={searchInput}
              onSearchChange={setSearchInput}
              showMockingToggle={showMockingToggle}
              mockingEnabled={mockingEnabled}
              onMockingChange={setMockingEnabled}
              showSimulateInbound={isDevToolsEnabled}
              simulateInboundRows={list.map(conversationInboxItemToThreadContact)}
              onSimulateInboundSuccess={handleSimulateInboundSuccess}
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

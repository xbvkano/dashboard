import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import ConversationList from './components/ConversationList'
import ChatThread from './components/ChatThread'
import InboxTakeOverConfirmModal from './components/InboxTakeOverConfirmModal'
import NewConversationModal from './components/NewConversationModal'
import EditContactModal from './components/EditContactModal'
import AiChatExtractingOverlay from './components/AiChatExtractingOverlay'
import BookAppointmentModal, { defaultDraft, type BookAppointmentDraft } from './components/BookAppointmentModal'
import DeleteContactConfirmModal from './components/DeleteContactConfirmModal'
import { useMediaQuery } from './useMediaQuery'
import { useBookAppointmentDrafts } from '../BookAppointmentDraftsContext'
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
  deleteConversationContact,
  patchConversationStatus,
  postConversationPresence,
  postExtractAppointmentFromConversation,
  postInboxLeaseRequest,
  postMarkConversationRead,
  postOutboundMessage,
} from './messagingApi'
import type { ThreadContact, ThreadMessage } from './types'
import { isDevToolsEnabled } from '../../../../devTools'
import { inboxListAfterStatusPatch } from './inboxArchiveListPlan'

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

/** Pill shown at top of chat column — keeps composer usable (not fixed to bottom). */
function AppointmentBookedPill({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onDone, 2500)
    return () => window.clearTimeout(t)
  }, [onDone])
  return (
    <div className="max-w-[min(100%,20rem)] rounded-full bg-slate-900 text-center text-white text-sm px-4 py-2 shadow-lg">
      {message}
    </div>
  )
}

function mergedThread(
  row: ConversationInboxItem | undefined,
  detail: ConversationDetail | null,
  selectedId: number | null
): ThreadContact | null {
  if (!selectedId) return null
  const d = detail?.conversation.id === selectedId ? detail : null
  if (row) {
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
  if (d) {
    const lastMsg = d.messages.length ? d.messages[d.messages.length - 1] : null
    return {
      id: selectedId,
      businessNumber: d.conversation.businessNumber,
      phoneE164: d.contactPoint.value,
      contactName: d.client?.name ?? null,
      clientNotes: d.client?.notes ?? null,
      clientId: d.client?.id ?? null,
      lastPreview: lastMsg?.body ? lastMsg.body.slice(0, 160) : null,
      lastAt: d.conversation.lastMessageAt,
      unread: false,
    }
  }
  return null
}

export default function Inbox() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const {
    draftsByConversationId,
    highlightsByConversationId,
    bookModalOpen,
    activeBookConversationId,
    setInboxSelectedConversationId,
    setDraftForConversation,
    setHighlightsForConversation,
    setBookingScreenshotUrlsForConversation,
    openBookModal,
    ensureDraft,
    closeBookModal,
    cancelBookModal,
    completeBookModal,
  } = useBookAppointmentDrafts()
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
  const [generateConfirmOpen, setGenerateConfirmOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [inboxMobileTab, setInboxMobileTab] = useState<'chat' | 'booking'>('chat')
  const [bookToast, setBookToast] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [archiveBusy, setArchiveBusy] = useState(false)
  const [mockingEnabled, setMockingEnabled] = useState(readInitialMockingEnabled)
  const didInitSelect = useRef(false)
  const openedFromQueryRef = useRef(false)
  const selectedIdRef = useRef<number | null>(null)
  /** Previous selectedId — detect transition to null (mobile back to list) to close booking modal. */
  const prevSelectedIdForBookModalRef = useRef<number | null>(null)
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
    const res = await fetchConversationsPage({
      limit: 50,
      q: debouncedSearch || undefined,
      status: showArchived ? 'ARCHIVED' : 'OPEN',
    })
    setList(res.items)
    setNextCursor(res.nextCursor)
    return res.items
  }, [debouncedSearch, showArchived])

  useEffect(() => {
    let cancelled = false
    setListLoading(true)
    setListError(null)
    setNextCursor(null)
    fetchConversationsPage({
      limit: 50,
      q: debouncedSearch || undefined,
      status: showArchived ? 'ARCHIVED' : 'OPEN',
    })
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
  }, [debouncedSearch, showArchived])

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
    const raw = searchParams.get('conversation')
    if (raw != null && raw !== '') {
      const id = parseInt(raw, 10)
      if (!Number.isNaN(id)) {
        setSelectedId(id)
        openedFromQueryRef.current = true
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev)
            next.delete('conversation')
            return next
          },
          { replace: true },
        )
      }
    }
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (didInitSelect.current || !isDesktop || list.length === 0 || openedFromQueryRef.current) return
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
      fetchConversationsPage({
        limit: 50,
        q: debouncedSearch || undefined,
        status: showArchived ? 'ARCHIVED' : 'OPEN',
      })
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
  }, [debouncedSearch, showArchived])

  const handleToggleArchivedView = useCallback(() => {
    setShowArchived((v) => !v)
    setSelectedId(null)
  }, [])

  const handleConversationArchiveToggle = useCallback(async () => {
    if (selectedId == null) return
    const fromDetail = detail?.conversation.id === selectedId ? detail.conversation.status : undefined
    const fromList = list.find((r) => r.id === selectedId)?.status
    const current = (fromDetail ?? fromList) as 'OPEN' | 'ARCHIVED' | undefined
    if (current !== 'OPEN' && current !== 'ARCHIVED') return
    const next: 'OPEN' | 'ARCHIVED' = current === 'ARCHIVED' ? 'OPEN' : 'ARCHIVED'
    setArchiveBusy(true)
    try {
      await patchConversationStatus(selectedId, next)
      if (detail?.conversation.id === selectedId) {
        setDetail({
          ...detail,
          conversation: {
            ...detail.conversation,
            status: next,
            archivedAt: next === 'ARCHIVED' ? new Date().toISOString() : null,
          },
        })
      }
      const plan = inboxListAfterStatusPatch(next, showArchived)
      if (plan) {
        setShowArchived(plan.setShowArchived)
        const res = await fetchConversationsPage({
          limit: 50,
          q: debouncedSearch || undefined,
          status: plan.fetchStatus,
        })
        setList(res.items)
        setNextCursor(res.nextCursor)
      } else {
        await refreshList()
      }
    } catch (e) {
      console.error(e)
    } finally {
      setArchiveBusy(false)
    }
  }, [selectedId, detail, list, refreshList, showArchived, debouncedSearch])

  const handleDeleteContact = useCallback(async () => {
    if (selectedIdRef.current == null) return
    setDeleteConfirmOpen(true)
  }, [refreshList])

  const handleConfirmDeleteContact = useCallback(async () => {
    const id = selectedIdRef.current
    if (id == null) return
    if (deleteSubmitting) return
    setDeleteSubmitting(true)
    try {
      await deleteConversationContact(id)
      setDeleteConfirmOpen(false)
      setSelectedId(null)
      setDetail(null)
      await refreshList()
    } catch (e) {
      console.error(e)
    } finally {
      setDeleteSubmitting(false)
    }
  }, [refreshList, deleteSubmitting])

  const headerConversationStatus = useMemo(
    () =>
      selectedId == null
        ? undefined
        : (detail?.conversation.id === selectedId
            ? detail.conversation.status
            : list.find((r) => r.id === selectedId)?.status) as 'OPEN' | 'ARCHIVED' | undefined,
    [selectedId, detail, list],
  )

  const threadRows = useMemo(() => list.map(rowToThread), [list])
  const selectedRow = useMemo(
    () => list.find((r) => r.id === selectedId),
    [list, selectedId]
  )
  const threadContact = useMemo(
    () => mergedThread(selectedRow, detail, selectedId),
    [selectedRow, detail, selectedId]
  )
  const showSplitBooking = useMemo(() => {
    if (selectedId == null) return false
    if (!bookModalOpen || activeBookConversationId !== selectedId) return false
    return Boolean(draftsByConversationId[selectedId])
  }, [selectedId, bookModalOpen, activeBookConversationId, draftsByConversationId])
  const messages = useMemo(() => {
    if (!detail || detail.conversation.id !== selectedId) return []
    return detailToMessages(detail)
  }, [detail, selectedId])

  useEffect(() => {
    setInboxSelectedConversationId(selectedId)
    return () => setInboxSelectedConversationId(null)
  }, [selectedId, setInboxSelectedConversationId])

  /** Leaving Inbox (e.g. Messages home / another dashboard route) must close booking — otherwise Host shows the modal. */
  useEffect(() => {
    return () => {
      closeBookModal()
    }
  }, [closeBookModal])

  /** Mobile: back to conversation list clears selection — close booking so it does not pop open via MessagesBookAppointmentModalHost. */
  useEffect(() => {
    const prev = prevSelectedIdForBookModalRef.current
    prevSelectedIdForBookModalRef.current = selectedId
    if (prev != null && selectedId == null) {
      closeBookModal()
    }
  }, [selectedId, closeBookModal])

  useEffect(() => {
    if (!showSplitBooking) setInboxMobileTab('chat')
  }, [showSplitBooking])

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
        status: showArchived ? 'ARCHIVED' : 'OPEN',
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
  }, [nextCursor, listLoadingMore, debouncedSearch, showArchived])

  const handleBack = useCallback(() => {
    setSelectedId(null)
  }, [])

  const handleViewClient = useCallback(() => {
    const cid = threadContact?.clientId
    if (cid != null) navigate(`/dashboard/contacts/clients/${cid}`)
  }, [navigate, threadContact?.clientId])

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

  const openBookingModal = useCallback(() => {
    if (!selectedIdRef.current) return
    const id = selectedIdRef.current
    ensureDraft(id)
    openBookModal(id)
    if (!isDesktop) setInboxMobileTab('booking')
  }, [ensureDraft, openBookModal, isDesktop])

  const handleGenerateAppointment = useCallback(() => {
    if (!selectedIdRef.current) return
    setGenerateConfirmOpen(true)
  }, [])

  const handleConfirmGenerate = useCallback(async () => {
    const id = selectedIdRef.current
    if (id == null) return
    setGenerateConfirmOpen(false)
    setExtracting(true)
    try {
      const res = await postExtractAppointmentFromConversation(id)
      const base = draftsByConversationId[id] ?? defaultDraft()
      setDraftForConversation(id, {
        ...base,
        clientName: res.draft.clientName ?? base.clientName,
        clientPhone: res.draft.clientPhone ?? base.clientPhone,
        appointmentAddress: res.draft.appointmentAddress ?? base.appointmentAddress,
        price: res.draft.price ?? base.price,
        date: res.draft.date ?? base.date,
        time: res.draft.time ?? base.time,
        notes: res.draft.notes ?? base.notes,
        size: res.draft.size ?? base.size,
        serviceType: (res.draft.serviceType ?? base.serviceType) as BookAppointmentDraft['serviceType'],
      })
      setHighlightsForConversation(id, {
        fieldHighlights: res.fieldHighlights,
        notFoundNotes: res.notFoundNotes,
        sizeLookupFailed: res.sizeLookupFailed,
      })
      setBookingScreenshotUrlsForConversation(
        id,
        (res.storedImages ?? []).map((s) => s.publicUrl),
      )
      openBookModal(id)
      if (!isDesktop) setInboxMobileTab('booking')
    } catch (e) {
      console.error(e)
    } finally {
      setExtracting(false)
    }
  }, [
    draftsByConversationId,
    isDesktop,
    openBookModal,
    setDraftForConversation,
    setHighlightsForConversation,
    setBookingScreenshotUrlsForConversation,
  ])

  useEffect(() => {
    const onBooked = () => {
      void refreshList()
      const sid = selectedIdRef.current
      if (sid == null) return
      void fetchConversationDetail(sid)
        .then((d) => {
          if (d.conversation.id === selectedIdRef.current) setDetail(d)
        })
        .catch(() => {})
    }
    window.addEventListener('messaging:appointment-booked', onBooked)
    return () => window.removeEventListener('messaging:appointment-booked', onBooked)
  }, [refreshList])

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

  const bookedToastStrip =
    bookToast != null ? (
      <div className="shrink-0 flex justify-center border-b border-slate-200/70 bg-[#e5e5ea] px-4 py-2">
        <AppointmentBookedPill message={bookToast} onDone={() => setBookToast(null)} />
      </div>
    ) : null

  return (
    <div className="messages-inbox-root flex min-h-0 flex-col overflow-hidden md:flex-row h-[calc(100dvh-3.5rem)] max-h-[calc(100dvh-3.5rem)]">
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
              showArchived={showArchived}
              onToggleArchivedView={handleToggleArchivedView}
            />
          </div>
        </div>

        <div
          className={`hidden md:flex flex-1 min-h-0 min-w-0 border border-l-0 border-slate-200 rounded-r-xl overflow-hidden bg-[#e5e5ea] shadow-sm ${
            showSplitBooking && threadContact ? 'flex-row' : 'flex-col'
          }`}
        >
          {threadContact ? (
            showSplitBooking ? (
              <>
                <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
                  <ChatThread
                    conversation={threadContact}
                    messages={messages}
                    showBack={false}
                    onBack={() => {}}
                    onSend={handleSend}
                    onEditContact={() => setEditOpen(true)}
                    onBookAppointment={openBookingModal}
                    onGenerateAppointment={handleGenerateAppointment}
                    onDeleteContact={handleDeleteContact}
                    extractAppointmentBusy={extracting}
                    detailLoading={detailLoading}
                    linkedClientId={threadContact.clientId}
                    onViewClient={handleViewClient}
                    conversationStatus={headerConversationStatus}
                    onArchiveToggle={handleConversationArchiveToggle}
                    archiveBusy={archiveBusy}
                    showMockingToggle={showMockingToggle}
                    mockingEnabled={mockingEnabled}
                    onMockingChange={setMockingEnabled}
                    belowHeader={bookedToastStrip}
                  />
                </div>
                <div className="w-[min(440px,42%)] min-w-[300px] shrink-0 flex flex-col min-h-0 bg-slate-100/90 p-2 border-l border-slate-200/80">
                  {selectedId != null && draftsByConversationId[selectedId] != null && (
                    <BookAppointmentModal
                      open
                      variant="inline"
                      conversationId={selectedId}
                      detail={detail?.conversation.id === selectedId ? detail : null}
                      draft={draftsByConversationId[selectedId]}
                      highlights={highlightsByConversationId[selectedId]}
                      onDraftChange={(next) => setDraftForConversation(selectedId, next)}
                      onClose={closeBookModal}
                      onCancel={cancelBookModal}
                      onBooked={async () => {
                        completeBookModal(selectedId)
                        setBookToast('Appointment booked')
                        setInboxMobileTab('chat')
                      }}
                    />
                  )}
                </div>
              </>
            ) : (
              <ChatThread
                conversation={threadContact}
                messages={messages}
                showBack={false}
                onBack={() => {}}
                onSend={handleSend}
                onEditContact={() => setEditOpen(true)}
                onBookAppointment={openBookingModal}
                onGenerateAppointment={handleGenerateAppointment}
                onDeleteContact={handleDeleteContact}
                extractAppointmentBusy={extracting}
                detailLoading={detailLoading}
                linkedClientId={threadContact.clientId}
                onViewClient={handleViewClient}
                conversationStatus={headerConversationStatus}
                onArchiveToggle={handleConversationArchiveToggle}
                archiveBusy={archiveBusy}
                showMockingToggle={showMockingToggle}
                mockingEnabled={mockingEnabled}
                onMockingChange={setMockingEnabled}
                belowHeader={bookedToastStrip}
              />
            )
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-sm px-6">
              <p className="font-medium text-slate-700">Select a conversation</p>
              <p className="mt-1 text-center">Choose a thread on the left to read messages.</p>
            </div>
          )}
        </div>
      </div>

      {selectedId && !isDesktop && threadContact && (
        <div className="fixed inset-0 z-[100] flex flex-col md:hidden bg-[#e5e5ea] min-h-0 overflow-x-hidden">
          {showSplitBooking ? (
            <>
              <div className="flex shrink-0 border-b border-slate-200 bg-white">
                <button
                  type="button"
                  onClick={() => setInboxMobileTab('chat')}
                  className={`flex-1 py-3 text-sm font-medium transition-colors ${
                    inboxMobileTab === 'chat'
                      ? 'text-slate-900 border-b-2 border-slate-900'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Chat
                </button>
                <button
                  type="button"
                  onClick={() => setInboxMobileTab('booking')}
                  className={`flex-1 py-3 text-sm font-medium transition-colors ${
                    inboxMobileTab === 'booking'
                      ? 'text-slate-900 border-b-2 border-slate-900'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Booking
                </button>
              </div>
              {inboxMobileTab === 'booking' && bookedToastStrip}
              <div className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden overflow-x-hidden">
                {inboxMobileTab === 'chat' ? (
                  <ChatThread
                    conversation={threadContact}
                    messages={messages}
                    showBack
                    onBack={handleBack}
                    onSend={handleSend}
                    onEditContact={() => setEditOpen(true)}
                    onBookAppointment={openBookingModal}
                    onGenerateAppointment={handleGenerateAppointment}
                    onDeleteContact={handleDeleteContact}
                    extractAppointmentBusy={extracting}
                    detailLoading={detailLoading}
                    linkedClientId={threadContact.clientId}
                    onViewClient={handleViewClient}
                    conversationStatus={headerConversationStatus}
                    onArchiveToggle={handleConversationArchiveToggle}
                    archiveBusy={archiveBusy}
                    showMockingToggle={showMockingToggle}
                    mockingEnabled={mockingEnabled}
                    onMockingChange={setMockingEnabled}
                    belowHeader={bookedToastStrip}
                  />
                ) : (
                  <div className="flex-1 min-h-0 min-w-0 p-2 overflow-hidden overflow-x-hidden flex flex-col">
                    {draftsByConversationId[selectedId] != null && (
                      <BookAppointmentModal
                        open
                        variant="inline"
                        conversationId={selectedId}
                        detail={detail?.conversation.id === selectedId ? detail : null}
                        draft={draftsByConversationId[selectedId]}
                        highlights={highlightsByConversationId[selectedId]}
                        onDraftChange={(next) => setDraftForConversation(selectedId, next)}
                        onClose={closeBookModal}
                        onCancel={cancelBookModal}
                        onBooked={async () => {
                          completeBookModal(selectedId)
                          setBookToast('Appointment booked')
                          setInboxMobileTab('chat')
                        }}
                      />
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <ChatThread
              conversation={threadContact}
              messages={messages}
              showBack
              onBack={handleBack}
              onSend={handleSend}
              onEditContact={() => setEditOpen(true)}
              onBookAppointment={openBookingModal}
              onGenerateAppointment={handleGenerateAppointment}
              onDeleteContact={handleDeleteContact}
              extractAppointmentBusy={extracting}
              detailLoading={detailLoading}
              linkedClientId={threadContact.clientId}
              onViewClient={handleViewClient}
              conversationStatus={headerConversationStatus}
              onArchiveToggle={handleConversationArchiveToggle}
              archiveBusy={archiveBusy}
              showMockingToggle={showMockingToggle}
              mockingEnabled={mockingEnabled}
              onMockingChange={setMockingEnabled}
              belowHeader={bookedToastStrip}
            />
          )}
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

      <AiChatExtractingOverlay open={extracting} />

      <DeleteContactConfirmModal
        open={deleteConfirmOpen}
        confirming={deleteSubmitting}
        onClose={() => {
          if (!deleteSubmitting) setDeleteConfirmOpen(false)
        }}
        onConfirm={handleConfirmDeleteContact}
      />

      {generateConfirmOpen && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 p-5">
            <h3 className="text-base font-semibold text-slate-900">Generate appointment</h3>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Use the latest messages in this thread to fill the booking form? You can review and edit everything
              before confirming.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setGenerateConfirmOpen(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmGenerate()}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

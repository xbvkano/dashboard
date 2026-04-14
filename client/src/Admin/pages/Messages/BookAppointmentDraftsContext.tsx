import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { BookAppointmentDraft, BookAppointmentHighlightState } from './Inbox/components/BookAppointmentModal'
import { defaultDraft } from './Inbox/components/BookAppointmentModal'

const MESSAGING_BOOK_DRAFTS_KEY = 'messagingBookAppointmentDrafts'

export type { BookAppointmentHighlightState }

type Ctx = {
  draftsByConversationId: Record<number, BookAppointmentDraft>
  highlightsByConversationId: Record<number, BookAppointmentHighlightState | undefined>
  /** Public URLs from last image extraction — sent when booking so they attach to the appointment. */
  bookingScreenshotUrlsByConversationId: Record<number, string[]>
  bookModalOpen: boolean
  activeBookConversationId: number | null
  /** When on Inbox, the currently selected thread id — used to show chat + booking side-by-side. */
  inboxSelectedConversationId: number | null
  setInboxSelectedConversationId: (id: number | null) => void
  setDraftForConversation: (conversationId: number, draft: BookAppointmentDraft) => void
  mergeDraftForConversation: (conversationId: number, partial: Partial<BookAppointmentDraft>) => void
  setHighlightsForConversation: (conversationId: number, next: BookAppointmentHighlightState | null) => void
  setBookingScreenshotUrlsForConversation: (conversationId: number, urls: string[]) => void
  openBookModal: (conversationId: number) => void
  closeBookModal: () => void
  cancelBookModal: () => void
  /** After successful booking: remove draft/highlights and close. */
  completeBookModal: (conversationId: number) => void
  ensureDraft: (conversationId: number) => void
}

const BookAppointmentDraftsContext = createContext<Ctx | null>(null)

function readInitialDrafts(): Record<number, BookAppointmentDraft> {
  try {
    const raw = localStorage.getItem(MESSAGING_BOOK_DRAFTS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, BookAppointmentDraft>
    const out: Record<number, BookAppointmentDraft> = {}
    const def = defaultDraft()
    for (const [k, v] of Object.entries(parsed || {})) {
      const id = parseInt(k, 10)
      if (!Number.isNaN(id) && v && typeof v === 'object') out[id] = { ...def, ...(v as BookAppointmentDraft) }
    }
    return out
  } catch {
    return {}
  }
}

export function BookAppointmentDraftsProvider({ children }: { children: ReactNode }) {
  const [draftsByConversationId, setDraftsByConversationId] =
    useState<Record<number, BookAppointmentDraft>>(readInitialDrafts)
  const [highlightsByConversationId, setHighlightsByConversationId] = useState<
    Record<number, BookAppointmentHighlightState | undefined>
  >({})
  const [bookingScreenshotUrlsByConversationId, setBookingScreenshotUrlsByConversationId] = useState<
    Record<number, string[]>
  >({})
  const [bookModalOpen, setBookModalOpen] = useState(false)
  const [activeBookConversationId, setActiveBookConversationId] = useState<number | null>(null)
  const [inboxSelectedConversationId, setInboxSelectedConversationId] = useState<number | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem(MESSAGING_BOOK_DRAFTS_KEY, JSON.stringify(draftsByConversationId))
    } catch {
      /* ignore */
    }
  }, [draftsByConversationId])

  const setDraftForConversation = useCallback((conversationId: number, draft: BookAppointmentDraft) => {
    setDraftsByConversationId((prev) => ({ ...prev, [conversationId]: draft }))
  }, [])

  const mergeDraftForConversation = useCallback(
    (conversationId: number, partial: Partial<BookAppointmentDraft>) => {
      setDraftsByConversationId((prev) => {
        const cur = prev[conversationId] ?? defaultDraft()
        return { ...prev, [conversationId]: { ...cur, ...partial } }
      })
    },
    [],
  )

  const setHighlightsForConversation = useCallback(
    (conversationId: number, next: BookAppointmentHighlightState | null) => {
      setHighlightsByConversationId((prev) => {
        if (next == null) {
          const { [conversationId]: _o, ...rest } = prev
          return rest
        }
        return { ...prev, [conversationId]: next }
      })
    },
    [],
  )

  const setBookingScreenshotUrlsForConversation = useCallback((conversationId: number, urls: string[]) => {
    setBookingScreenshotUrlsByConversationId((prev) => ({ ...prev, [conversationId]: urls }))
  }, [])

  const ensureDraft = useCallback((conversationId: number) => {
    setDraftsByConversationId((prev) => {
      if (prev[conversationId]) return prev
      return { ...prev, [conversationId]: defaultDraft() }
    })
  }, [])

  const openBookModal = useCallback((conversationId: number) => {
    setActiveBookConversationId(conversationId)
    setBookModalOpen(true)
  }, [])

  const closeBookModal = useCallback(() => {
    setBookModalOpen(false)
    setActiveBookConversationId(null)
  }, [])

  const cancelBookModal = useCallback(() => {
    const id = activeBookConversationId
    if (id != null) {
      setDraftsByConversationId((prev) => {
        const { [id]: _omit, ...rest } = prev
        return rest
      })
      setHighlightsByConversationId((prev) => {
        const { [id]: _h, ...rest } = prev
        return rest
      })
      setBookingScreenshotUrlsByConversationId((prev) => {
        const { [id]: _s, ...rest } = prev
        return rest
      })
    }
    setBookModalOpen(false)
    setActiveBookConversationId(null)
  }, [activeBookConversationId])

  const completeBookModal = useCallback((conversationId: number) => {
    setDraftsByConversationId((prev) => {
      const { [conversationId]: _omit, ...rest } = prev
      return rest
    })
    setHighlightsByConversationId((prev) => {
      const { [conversationId]: _h, ...rest } = prev
      return rest
    })
    setBookingScreenshotUrlsByConversationId((prev) => {
      const { [conversationId]: _s, ...rest } = prev
      return rest
    })
    setBookModalOpen(false)
    setActiveBookConversationId(null)
    try {
      window.dispatchEvent(new CustomEvent('messaging:appointment-booked', { detail: { conversationId } }))
    } catch {
      /* ignore */
    }
  }, [])

  const value = useMemo(
    () =>
      ({
        draftsByConversationId,
        highlightsByConversationId,
        bookingScreenshotUrlsByConversationId,
        bookModalOpen,
        activeBookConversationId,
        inboxSelectedConversationId,
        setInboxSelectedConversationId,
        setDraftForConversation,
        mergeDraftForConversation,
        setHighlightsForConversation,
        setBookingScreenshotUrlsForConversation,
        openBookModal,
        closeBookModal,
        cancelBookModal,
        completeBookModal,
        ensureDraft,
      }) satisfies Ctx,
    [
      draftsByConversationId,
      highlightsByConversationId,
      bookingScreenshotUrlsByConversationId,
      bookModalOpen,
      activeBookConversationId,
      inboxSelectedConversationId,
      setDraftForConversation,
      mergeDraftForConversation,
      setHighlightsForConversation,
      setBookingScreenshotUrlsForConversation,
      openBookModal,
      closeBookModal,
      cancelBookModal,
      completeBookModal,
      ensureDraft,
      setInboxSelectedConversationId,
    ],
  )

  return (
    <BookAppointmentDraftsContext.Provider value={value}>{children}</BookAppointmentDraftsContext.Provider>
  )
}

export function useBookAppointmentDrafts(): Ctx {
  const ctx = useContext(BookAppointmentDraftsContext)
  if (!ctx) {
    throw new Error('useBookAppointmentDrafts must be used within BookAppointmentDraftsProvider')
  }
  return ctx
}

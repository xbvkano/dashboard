import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import BookAppointmentModal, {
  defaultDraft,
  type BookAppointmentDraft,
  type BookAppointmentHighlightState,
} from './Inbox/components/BookAppointmentModal'
import AiChatExtractingOverlay from './Inbox/components/AiChatExtractingOverlay'
import { useMediaQuery } from './Inbox/useMediaQuery'
import { useBookAppointmentDrafts } from './BookAppointmentDraftsContext'
import {
  postExtractAppointmentFromStandaloneImages,
  SCREENSHOT_BOOKING_CONVERSATION_ID,
} from './Inbox/messagingApi'

const SID = SCREENSHOT_BOOKING_CONVERSATION_ID

/** Stable id — React `useId()` can produce `:` which breaks label/htmlFor → file input in some browsers. */
const SCREENSHOT_FILE_INPUT_ID = 'screenshot-booking-file-input'

/** Set in handleBooked so the next visit to this page can hard-reset modal/draft if context/localStorage were stale. */
const SESSION_BOOKING_FINISHED_KEY = 'screenshot-booking-finished'

/** UI state that does not live in BookAppointmentDraftsContext (lost on refresh). Draft itself persists via `messagingBookAppointmentDrafts`. */
const SCREENSHOT_UI_STORAGE_KEY = 'messagingScreenshotBookingUi'

type ScreenshotPersistedUi = {
  highlights: BookAppointmentHighlightState | null
  extractOnce: boolean
  mobileTab?: 'photos' | 'booking'
}

function loadScreenshotUi(): ScreenshotPersistedUi | null {
  try {
    const raw = localStorage.getItem(SCREENSHOT_UI_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as ScreenshotPersistedUi
  } catch {
    return null
  }
}

function saveScreenshotUi(data: ScreenshotPersistedUi) {
  try {
    localStorage.setItem(SCREENSHOT_UI_STORAGE_KEY, JSON.stringify(data))
  } catch {
    /* ignore quota / private mode */
  }
}

function clearScreenshotUi() {
  try {
    localStorage.removeItem(SCREENSHOT_UI_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

function hasMeaningfulDraft(d: BookAppointmentDraft | undefined): boolean {
  if (!d) return false
  const def = defaultDraft()
  return (
    d.clientName !== def.clientName ||
    d.clientPhone !== def.clientPhone ||
    d.appointmentAddress !== def.appointmentAddress ||
    d.price !== def.price ||
    d.date !== def.date ||
    d.time !== def.time ||
    d.notes !== def.notes ||
    d.size !== def.size ||
    d.serviceType !== def.serviceType
  )
}

function hasHighlightContent(h: BookAppointmentHighlightState | null | undefined): boolean {
  if (!h) return false
  if (h.sizeLookupFailed) return true
  if (h.notFoundNotes?.length) return true
  return Object.keys(h.fieldHighlights ?? {}).length > 0
}

type PhotoSlot =
  | { kind: 'local'; file: File; previewUrl: string }
  | { kind: 'saved'; publicUrl: string; storageKey?: string }

export default function ScreenshotBooking() {
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const [mobileTab, setMobileTab] = useState<'photos' | 'booking'>('photos')
  const [photoSlots, setPhotoSlots] = useState<PhotoSlot[]>([])
  const [extracting, setExtracting] = useState(false)
  const [extractOnce, setExtractOnce] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** After restore from localStorage — avoids persisting empty state before highlights/extractOnce are applied */
  const [uiHydrated, setUiHydrated] = useState(false)
  const screenshotRestoreDoneRef = useRef(false)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const {
    draftsByConversationId,
    highlightsByConversationId,
    bookModalOpen,
    activeBookConversationId,
    setDraftForConversation,
    setHighlightsForConversation,
    setBookingScreenshotUrlsForConversation,
    openBookModal,
    ensureDraft,
    closeBookModal,
    cancelBookModal,
    completeBookModal,
  } = useBookAppointmentDrafts()

  const draft = draftsByConversationId[SID]
  const highlights = highlightsByConversationId[SID]
  const showSplit = bookModalOpen && activeBookConversationId === SID && Boolean(draft)

  /**
   * After a successful book we navigate away; on return, context/localStorage can still have SID draft + modal flags.
   * Run before useEffect restore so we do not reopen the booking panel from a stale draft when `p` was cleared on book.
   */
  useLayoutEffect(() => {
    try {
      if (sessionStorage.getItem(SESSION_BOOKING_FINISHED_KEY) !== '1') return
      sessionStorage.removeItem(SESSION_BOOKING_FINISHED_KEY)
      completeBookModal(SID)
      setExtractOnce(false)
      setMobileTab('photos')
      clearScreenshotUi()
      ensureDraft(SID)
    } catch {
      /* ignore */
    }
  }, [completeBookModal, ensureDraft])

  useEffect(() => {
    ensureDraft(SID)
  }, [ensureDraft])

  /** Restore booking panel + highlights after refresh (e.g. mobile switching to Photos and back). Waits for ensureDraft so SID draft exists. */
  useEffect(() => {
    if (screenshotRestoreDoneRef.current) return
    const d = draftsByConversationId[SID]
    if (d === undefined) return

    screenshotRestoreDoneRef.current = true
    const p = loadScreenshotUi()
    /** Do not open from `hasMeaningfulDraft(d)` alone — stale draft "0" in LS could reopen after book when `p` was cleared. */
    const shouldOpenBooking =
      Boolean(p?.extractOnce) ||
      hasHighlightContent(p?.highlights ?? null) ||
      (Boolean(p) && hasMeaningfulDraft(d))

    if (p?.highlights && hasHighlightContent(p.highlights)) {
      setHighlightsForConversation(SID, p.highlights)
    }
    if (p?.extractOnce) {
      setExtractOnce(true)
    }
    if (shouldOpenBooking) {
      openBookModal(SID)
      if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) {
        const tab =
          p?.mobileTab === 'photos' || p?.mobileTab === 'booking' ? p.mobileTab : 'booking'
        setMobileTab(tab)
      }
    }
    setUiHydrated(true)
  }, [draftsByConversationId, openBookModal, setHighlightsForConversation])

  /** Persist highlights + extract-once + mobile tab (draft already persists via BookAppointmentDraftsContext). */
  useEffect(() => {
    if (!uiHydrated) return
    const h = highlightsByConversationId[SID] ?? null
    const hasPersistableUi =
      extractOnce || hasHighlightContent(h) || mobileTab !== 'photos'
    if (!hasPersistableUi) {
      clearScreenshotUi()
      return
    }
    saveScreenshotUi({
      highlights: h,
      extractOnce,
      mobileTab,
    })
  }, [uiHydrated, highlightsByConversationId, extractOnce, mobileTab])

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const arr = Array.from(incoming as File[])
    setPhotoSlots((prev) => [
      ...prev,
      ...arr.map((file) => ({
        kind: 'local' as const,
        file,
        previewUrl: URL.createObjectURL(file),
      })),
    ])
  }, [])

  const runExtract = useCallback(
    async (
      newFiles: File[],
      reuse?: Array<{ publicUrl: string; storageKey?: string }>,
    ) => {
      if (newFiles.length === 0) {
        setError('Add at least one screenshot.')
        return
      }
      setError(null)
      setExtracting(true)
      try {
        const res = await postExtractAppointmentFromStandaloneImages(newFiles, reuse)
        const base = draftsByConversationId[SID] ?? defaultDraft()
        setDraftForConversation(SID, {
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
        setHighlightsForConversation(SID, {
          fieldHighlights: res.fieldHighlights,
          notFoundNotes: res.notFoundNotes,
          sizeLookupFailed: res.sizeLookupFailed,
        })
        setBookingScreenshotUrlsForConversation(
          SID,
          (res.storedImages ?? []).map((s) => s.publicUrl),
        )
        setPhotoSlots((prev) => {
          prev.forEach((s) => {
            if (s.kind === 'local') URL.revokeObjectURL(s.previewUrl)
          })
          return (res.storedImages ?? []).map((s) => ({
            kind: 'saved' as const,
            publicUrl: s.publicUrl,
            storageKey: s.storageKey,
          }))
        })
        setExtractOnce(true)
        openBookModal(SID)
        if (!isDesktop) setMobileTab('booking')
      } catch (e) {
        console.error(e)
        setError(e instanceof Error ? e.message : 'Extraction failed')
      } finally {
        setExtracting(false)
      }
    },
    [
      draftsByConversationId,
      isDesktop,
      openBookModal,
      setDraftForConversation,
      setHighlightsForConversation,
      setBookingScreenshotUrlsForConversation,
    ],
  )

  const hasPendingNewPhotos = extractOnce && photoSlots.some((s) => s.kind === 'local')

  const handleExtract = useCallback(() => {
    const newFiles = photoSlots
      .filter((s): s is Extract<PhotoSlot, { kind: 'local' }> => s.kind === 'local')
      .map((s) => s.file)
    void runExtract(newFiles, undefined)
  }, [photoSlots, runExtract])

  const handleExtractAgain = useCallback(() => {
    const reuse = photoSlots
      .filter((s): s is Extract<PhotoSlot, { kind: 'saved' }> => s.kind === 'saved')
      .map((s) => ({ publicUrl: s.publicUrl, storageKey: s.storageKey || undefined }))
    const newFiles = photoSlots
      .filter((s): s is Extract<PhotoSlot, { kind: 'local' }> => s.kind === 'local')
      .map((s) => s.file)
    if (newFiles.length === 0) {
      setError('Add at least one new photo before re-analyzing.')
      return
    }
    void runExtract(newFiles, reuse)
  }, [photoSlots, runExtract])

  const onPhotoInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const input = e.target
      const list = input.files
      if (!list?.length) return
      addFiles(list)
      input.value = ''
    },
    [addFiles],
  )

  const removePhotoAtIndex = useCallback(
    (index: number) => {
      setPhotoSlots((prev) => {
        if (index < 0 || index >= prev.length) return prev
        const slot = prev[index]
        const next = prev.filter((_, i) => i !== index)
        if (slot.kind === 'local') {
          URL.revokeObjectURL(slot.previewUrl)
        }
        if (extractOnce) {
          const urls = next.filter((s): s is Extract<PhotoSlot, { kind: 'saved' }> => s.kind === 'saved').map((s) => s.publicUrl)
          setBookingScreenshotUrlsForConversation(SID, urls)
        }
        return next
      })
    },
    [extractOnce, setBookingScreenshotUrlsForConversation],
  )

  const handleResetPhotosFirstView = useCallback(() => {
    setPhotoSlots((prev) => {
      prev.forEach((s) => {
        if (s.kind === 'local') URL.revokeObjectURL(s.previewUrl)
      })
      return []
    })
    setError(null)
  }, [])

  const handleCancelBooking = useCallback(() => {
    setPhotoSlots((prev) => {
      prev.forEach((s) => {
        if (s.kind === 'local') URL.revokeObjectURL(s.previewUrl)
      })
      return []
    })
    setExtractOnce(false)
    clearScreenshotUi()
    cancelBookModal()
  }, [cancelBookModal])

  const handleBooked = useCallback(async () => {
    try {
      sessionStorage.setItem(SESSION_BOOKING_FINISHED_KEY, '1')
    } catch {
      /* ignore */
    }
    completeBookModal(SID)
    setPhotoSlots((prev) => {
      prev.forEach((s) => {
        if (s.kind === 'local') URL.revokeObjectURL(s.previewUrl)
      })
      return []
    })
    setExtractOnce(false)
    setError(null)
    setMobileTab('photos')
    clearScreenshotUi()
  }, [completeBookModal])

  const photosPanel = (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to="/dashboard/messages" className="text-blue-600 hover:underline">
          Messages
        </Link>
        <span aria-hidden>/</span>
        <span className="text-slate-800">Screenshot booking</span>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-slate-900">Screenshots</h2>
        <p className="text-sm text-slate-600 mt-1">
          Conversation happened outside this app. Add screenshots, run extraction once to fill the booking form, then
          review and submit. After the first run you can add more photos and tap <span className="font-medium text-slate-800">Extract again</span> to
          re-analyze everything together. Your form state is saved in this browser if you refresh; image previews here are
          session-only unless you re-extract.
        </p>
      </div>

      <div>
        <p className="block text-xs font-medium text-slate-700 mb-2">Photos</p>
        <input
          ref={photoInputRef}
          id={SCREENSHOT_FILE_INPUT_ID}
          name={SCREENSHOT_FILE_INPUT_ID}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          aria-label={extractOnce ? 'Add more screenshots' : 'Choose screenshots'}
          disabled={extracting}
          onChange={onPhotoInputChange}
        />
        {photoSlots.length > 0 && (
          <div className="mb-3 grid min-h-0 grid-cols-2 gap-2 sm:grid-cols-3">
            {photoSlots.map((slot, i) => (
              <div
                key={
                  slot.kind === 'local'
                    ? `local-${slot.file.name}-${slot.file.size}-${slot.file.lastModified}-${i}`
                    : `saved-${slot.publicUrl}-${i}`
                }
                className="relative aspect-square min-h-[96px] overflow-hidden rounded-lg border border-slate-200 bg-slate-100 shadow-sm"
              >
                <img
                  src={slot.kind === 'local' ? slot.previewUrl : slot.publicUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
                <span
                  className={`absolute left-1 top-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-white shadow-sm ${
                    slot.kind === 'local' ? 'bg-amber-600/95' : 'bg-slate-900/70'
                  }`}
                >
                  {slot.kind === 'local' ? 'New' : 'Saved'}
                </span>
                <button
                  type="button"
                  onClick={() => removePhotoAtIndex(i)}
                  disabled={extracting}
                  className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white shadow-sm backdrop-blur-sm hover:bg-black/70 disabled:opacity-40"
                  aria-label={`Remove photo ${i + 1}`}
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {!extractOnce ? (
          <>
            <button
              type="button"
              onClick={() => {
                if (extracting) return
                photoInputRef.current?.click()
              }}
              className="inline-flex select-none items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50"
              disabled={extracting}
            >
              <svg
                className="h-4 w-4 shrink-0 text-slate-500"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3A1.5 1.5 0 001.5 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                />
              </svg>
              Add photos
            </button>
            <button
              type="button"
              onClick={handleExtract}
              disabled={extracting || photoSlots.length === 0}
              className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {extracting ? 'Analyzing…' : 'Extract booking details'}
            </button>
            <button
              type="button"
              onClick={handleResetPhotosFirstView}
              disabled={extracting || photoSlots.length === 0}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Reset photos
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => {
                setError(null)
                setMobileTab('photos')
                handleCancelBooking()
              }}
              disabled={extracting}
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
            >
              Clear & reset
            </button>
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              disabled={extracting}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50"
            >
              <svg className="h-4 w-4 shrink-0 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
              Add more photos
            </button>
            {hasPendingNewPhotos && (
              <button
                type="button"
                onClick={handleExtractAgain}
                disabled={extracting}
                className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {extracting ? 'Analyzing…' : 'Extract again'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )

  const bookingPanel = showSplit && draft ? (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-2">
      <BookAppointmentModal
        open
        variant="inline"
        bookingSource="screenshot"
        conversationId={SID}
        detail={null}
        draft={draft}
        highlights={highlights}
        onDraftChange={(next) => setDraftForConversation(SID, next)}
        onClose={closeBookModal}
        onCancel={handleCancelBooking}
        onBooked={handleBooked}
      />
    </div>
  ) : (
    <div className="flex h-full min-h-0 flex-col items-center justify-center p-6 text-center text-sm text-slate-500">
      <p className="max-w-[20rem]">
        Upload screenshots and tap <span className="font-medium text-slate-700">Extract booking details</span> once to
        fill the form here.
      </p>
    </div>
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:h-[calc(100dvh-3.5rem)] md:max-h-[calc(100dvh-3.5rem)]">
      {isDesktop ? (
        <div className="flex min-h-0 flex-1 flex-row overflow-hidden md:px-2">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border border-slate-200 bg-white md:rounded-l-xl md:shadow-sm">
            {photosPanel}
          </div>
          <div className="flex min-h-0 w-[min(440px,42%)] min-w-[300px] shrink-0 flex-col overflow-hidden border border-l-0 border-slate-200 bg-slate-100/90 md:rounded-r-xl md:shadow-sm">
            {bookingPanel}
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {showSplit ? (
            <>
              <div className="flex shrink-0 border-b border-slate-200 bg-white">
                <button
                  type="button"
                  onClick={() => setMobileTab('photos')}
                  className={`flex-1 py-3 text-sm font-medium transition-colors ${
                    mobileTab === 'photos'
                      ? 'border-b-2 border-slate-900 text-slate-900'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Screenshots
                </button>
                <button
                  type="button"
                  onClick={() => setMobileTab('booking')}
                  className={`flex-1 py-3 text-sm font-medium transition-colors ${
                    mobileTab === 'booking'
                      ? 'border-b-2 border-slate-900 text-slate-900'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Booking
                </button>
              </div>
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                {mobileTab === 'photos' ? photosPanel : bookingPanel}
              </div>
            </>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">{photosPanel}</div>
          )}
        </div>
      )}
      <AiChatExtractingOverlay open={extracting} />
    </div>
  )
}

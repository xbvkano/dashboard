import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import BookAppointmentModal from './Inbox/components/BookAppointmentModal'
import { useBookAppointmentDrafts } from './BookAppointmentDraftsContext'
import {
  fetchConversationDetail,
  SCREENSHOT_BOOKING_CONVERSATION_ID,
  type ConversationDetail,
} from './Inbox/messagingApi'

function BookSuccessToast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onDone, 2500)
    return () => window.clearTimeout(t)
  }, [onDone])
  return (
    <div className="fixed left-1/2 z-[220] -translate-x-1/2 px-4 top-[max(0.75rem,env(safe-area-inset-top)+0.5rem)] md:top-[calc(3.5rem+0.75rem)]">
      <div className="max-w-[min(100vw-2rem,20rem)] rounded-full bg-slate-900 text-center text-white text-sm px-4 py-2 shadow-lg">
        {message}
      </div>
    </div>
  )
}

export default function MessagesBookAppointmentModalHost() {
  const location = useLocation()
  const {
    bookModalOpen,
    activeBookConversationId,
    draftsByConversationId,
    setDraftForConversation,
    highlightsByConversationId,
    inboxSelectedConversationId,
    closeBookModal,
    cancelBookModal,
    completeBookModal,
  } = useBookAppointmentDrafts()

  const [detail, setDetail] = useState<ConversationDetail | null>(null)
  const [bookToast, setBookToast] = useState<string | null>(null)

  const id = activeBookConversationId
  const draft = id != null ? draftsByConversationId[id] : null
  const highlights = id != null ? highlightsByConversationId[id] : undefined

  /** Inbox renders chat + booking side-by-side; avoid duplicate full-screen modal. */
  const useInboxSplitPanel =
    bookModalOpen &&
    id != null &&
    inboxSelectedConversationId === id &&
    /\/messages\/inbox\/?$/.test(location.pathname)

  const useScreenshotSplitPanel =
    bookModalOpen &&
    id === SCREENSHOT_BOOKING_CONVERSATION_ID &&
    /\/messages\/screenshot-booking\/?$/.test(location.pathname)

  useEffect(() => {
    if (!bookModalOpen || id == null || useInboxSplitPanel || useScreenshotSplitPanel || id === SCREENSHOT_BOOKING_CONVERSATION_ID) {
      setDetail(null)
      return
    }
    let cancelled = false
    fetchConversationDetail(id)
      .then((d) => {
        if (!cancelled) setDetail(d)
      })
      .catch((e) => {
        console.error(e)
        if (!cancelled) setDetail(null)
      })
    return () => {
      cancelled = true
    }
  }, [bookModalOpen, id, useInboxSplitPanel, useScreenshotSplitPanel])

  return (
    <>
      {bookModalOpen && id != null && draft != null && !useInboxSplitPanel && !useScreenshotSplitPanel && (
        <BookAppointmentModal
          open
          conversationId={id}
          detail={detail?.conversation.id === id ? detail : null}
          draft={draft}
          highlights={highlights}
          bookingSource={id === SCREENSHOT_BOOKING_CONVERSATION_ID ? 'screenshot' : 'conversation'}
          onDraftChange={(next) => setDraftForConversation(id, next)}
          onClose={closeBookModal}
          onCancel={cancelBookModal}
          onBooked={async () => {
            completeBookModal(id)
            setBookToast('Appointment booked')
          }}
        />
      )}
      {bookToast && <BookSuccessToast message={bookToast} onDone={() => setBookToast(null)} />}
    </>
  )
}

import { useCallback, useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import ChatHeader from './ChatHeader'
import MessageBubble from './MessageBubble'
import MessageComposer from './MessageComposer'
import ChatDayDivider from './ChatDayDivider'
import { groupMessagesByDay } from '../formatTime'
import type { ThreadContact, ThreadMessage } from '../types'

type Props = {
  conversation: ThreadContact
  messages: ThreadMessage[]
  showBack: boolean
  onBack: () => void
  onSend: (text: string, files?: File[]) => void | Promise<void>
  onEditContact: () => void
  onBookAppointment: () => void
  onGenerateAppointment: () => void
  onDeleteContact?: () => void | Promise<void>
  extractAppointmentBusy?: boolean
  detailLoading?: boolean
  linkedClientId?: number | null
  onViewClient?: () => void
  linkedEmployeeId?: number | null
  onViewEmployee?: () => void
  conversationStatus?: 'OPEN' | 'ARCHIVED' | string
  onArchiveToggle?: () => void | Promise<void>
  archiveBusy?: boolean
  showMockingToggle?: boolean
  mockingEnabled?: boolean
  onMockingChange?: (enabled: boolean) => void
  /** e.g. “Appointment booked” pill — rendered directly under the thread header */
  belowHeader?: ReactNode
  conversationId?: number | null
  messageBankInitialValues?: Record<string, string>
  showClientBookingActions?: boolean
  callHref?: string | null
  /** Employee inbox uses a purple chat surface so it’s easy to tell apart from client. */
  employeeChat?: boolean
}

/** Pixels from bottom to still count as "at bottom" for auto-scroll */
const NEAR_BOTTOM_PX = 96

function flushScrollToBottom(el: HTMLDivElement | null): void {
  if (!el) return
  el.scrollTop = el.scrollHeight
}

export default function ChatThread({
  conversation,
  messages,
  showBack,
  onBack,
  onSend,
  onEditContact,
  onBookAppointment,
  onGenerateAppointment,
  onDeleteContact,
  extractAppointmentBusy,
  detailLoading,
  linkedClientId,
  onViewClient,
  linkedEmployeeId,
  onViewEmployee,
  conversationStatus,
  onArchiveToggle,
  archiveBusy,
  showMockingToggle,
  mockingEnabled,
  onMockingChange,
  belowHeader,
  conversationId,
  messageBankInitialValues,
  showClientBookingActions = true,
  callHref,
  employeeChat = false,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  /** If true, new messages / image layout changes keep the view pinned to the bottom */
  const pinnedToBottomRef = useRef(true)
  const prevDetailLoadingRef = useRef(detailLoading)
  const prevLastMessageIdRef = useRef<number | string | null>(null)
  const prevMessageCountRef = useRef(0)
  const prevContentHeightRef = useRef(0)
  const prevScrollPortHeightRef = useRef(0)
  const programmaticScrollRef = useRef(false)

  const lastMessageId = messages.length ? messages[messages.length - 1].id : 0

  const updatePinnedFromScroll = useCallback(() => {
    if (programmaticScrollRef.current) return
    const el = scrollRef.current
    if (!el) return
    const gap = el.scrollHeight - el.scrollTop - el.clientHeight
    pinnedToBottomRef.current = gap <= NEAR_BOTTOM_PX
  }, [])

  const snapToBottom = useCallback((el: HTMLDivElement | null) => {
    if (!el) return
    programmaticScrollRef.current = true
    flushScrollToBottom(el)
    requestAnimationFrame(() => {
      flushScrollToBottom(el)
      programmaticScrollRef.current = false
    })
  }, [])

  const scrollPinnedToBottom = useCallback(() => {
    if (!pinnedToBottomRef.current) return
    snapToBottom(scrollRef.current)
  }, [snapToBottom])

  /** Switching threads: always start at the bottom */
  useLayoutEffect(() => {
    pinnedToBottomRef.current = true
    prevLastMessageIdRef.current = null
    prevMessageCountRef.current = 0
    prevContentHeightRef.current = 0
    prevScrollPortHeightRef.current = 0
    snapToBottom(scrollRef.current)
  }, [conversation.id, snapToBottom])

  /** Conversation detail just finished loading — show latest messages first */
  useLayoutEffect(() => {
    const wasLoading = prevDetailLoadingRef.current
    prevDetailLoadingRef.current = detailLoading
    if (wasLoading && !detailLoading) {
      pinnedToBottomRef.current = true
      prevLastMessageIdRef.current = lastMessageId
      prevMessageCountRef.current = messages.length
      snapToBottom(scrollRef.current)
    }
  }, [detailLoading, lastMessageId, messages.length, snapToBottom])

  /** New messages only — ignore poll identity churn when last id / length unchanged */
  useLayoutEffect(() => {
    if (detailLoading) return
    const prevId = prevLastMessageIdRef.current
    const prevCount = prevMessageCountRef.current
    const grew =
      messages.length > prevCount || (lastMessageId !== 0 && lastMessageId !== prevId)
    prevLastMessageIdRef.current = lastMessageId
    prevMessageCountRef.current = messages.length
    if (!grew) return
    if (pinnedToBottomRef.current) {
      snapToBottom(scrollRef.current)
    }
  }, [messages, lastMessageId, detailLoading, snapToBottom])

  /**
   * Viewport resized (composer grew/shrank) → snap to bottom if already pinned,
   * otherwise keep distance from the bottom so mid-thread reading does not jump.
   * Content grew (images/wrap) → pin if already near bottom.
   */
  useEffect(() => {
    const scrollEl = scrollRef.current
    const contentEl = contentRef.current
    if (!scrollEl || !contentEl) return

    prevContentHeightRef.current = contentEl.getBoundingClientRect().height
    prevScrollPortHeightRef.current = scrollEl.clientHeight

    const ro = new ResizeObserver(() => {
      const portH = scrollEl.clientHeight
      const prevPortH = prevScrollPortHeightRef.current
      prevScrollPortHeightRef.current = portH
      const portDelta = prevPortH - portH

      if (Math.abs(portDelta) > 1) {
        if (pinnedToBottomRef.current) {
          snapToBottom(scrollEl)
        } else {
          programmaticScrollRef.current = true
          scrollEl.scrollTop += portDelta
          requestAnimationFrame(() => {
            programmaticScrollRef.current = false
          })
        }
        return
      }

      const contentH = contentEl.getBoundingClientRect().height
      const prevContentH = prevContentHeightRef.current
      prevContentHeightRef.current = contentH
      if (contentH > prevContentH + 1 && pinnedToBottomRef.current) {
        snapToBottom(scrollEl)
      }
    })
    ro.observe(contentEl)
    ro.observe(scrollEl)
    return () => ro.disconnect()
  }, [conversation.id, snapToBottom])

  return (
    <div
      className={`flex h-full min-h-0 max-h-full flex-col overflow-hidden ${
        employeeChat ? 'bg-[#d4c4eb]' : 'bg-[#e5e5ea]'
      }`}
    >
      <ChatHeader
        conversation={conversation}
        showBack={showBack}
        onBack={onBack}
        onEditContact={onEditContact}
        onBookAppointment={onBookAppointment}
        onGenerateAppointment={onGenerateAppointment}
        onDeleteContact={onDeleteContact}
        extractAppointmentBusy={extractAppointmentBusy}
        linkedClientId={linkedClientId}
        onViewClient={onViewClient}
        linkedEmployeeId={linkedEmployeeId}
        onViewEmployee={onViewEmployee}
        conversationStatus={conversationStatus}
        onArchiveToggle={onArchiveToggle}
        archiveBusy={archiveBusy}
        showMockingToggle={showMockingToggle}
        mockingEnabled={mockingEnabled}
        onMockingChange={onMockingChange}
        showClientBookingActions={showClientBookingActions}
        callHref={callHref}
      />
      {belowHeader}
      <div
        ref={scrollRef}
        onScroll={updatePinnedFromScroll}
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain px-3 pt-2 pb-1 [overflow-anchor:none] [scrollbar-gutter:stable]"
      >
        {detailLoading && (
          <p className="text-center text-sm text-slate-500 py-6">Loading messages…</p>
        )}
        {!detailLoading && (
          <div ref={contentRef} className="flex flex-col gap-1 pb-1">
            {groupMessagesByDay(messages).map((group) => (
              <div key={group.dayKey}>
                <ChatDayDivider label={group.label} />
                {group.messages.map((m) => (
                  <MessageBubble key={m.id} message={m} onMediaLoad={scrollPinnedToBottom} />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
      <MessageComposer
        key={conversationId ?? conversation.id}
        onSend={onSend}
        conversationId={conversationId ?? conversation.id}
        messageBankInitialValues={messageBankInitialValues}
      />
    </div>
  )
}

import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import ChatHeader from './ChatHeader'
import MessageBubble from './MessageBubble'
import MessageComposer from './MessageComposer'
import type { ThreadContact, ThreadMessage } from '../types'

type Props = {
  conversation: ThreadContact
  messages: ThreadMessage[]
  showBack: boolean
  onBack: () => void
  onSend: (text: string, files?: File[]) => void | Promise<void>
  onEditContact: () => void
  detailLoading?: boolean
  showMockingToggle?: boolean
  mockingEnabled?: boolean
  onMockingChange?: (enabled: boolean) => void
}

/** Pixels from bottom to still count as "at bottom" for auto-scroll */
const NEAR_BOTTOM_PX = 96

/** Run after images decode / layout so scrollHeight is final */
function flushScrollToBottom(el: HTMLDivElement | null): void {
  if (!el) return
  const snap = () => {
    el.scrollTop = el.scrollHeight
  }
  snap()
  requestAnimationFrame(() => {
    snap()
    requestAnimationFrame(snap)
  })
  // Late layout (images, fonts)
  setTimeout(snap, 0)
  setTimeout(snap, 50)
  setTimeout(snap, 120)
  setTimeout(snap, 280)
}

export default function ChatThread({
  conversation,
  messages,
  showBack,
  onBack,
  onSend,
  onEditContact,
  detailLoading,
  showMockingToggle,
  mockingEnabled,
  onMockingChange,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  /** If true, new messages / image layout changes keep the view pinned to the bottom */
  const pinnedToBottomRef = useRef(true)
  const prevDetailLoadingRef = useRef(detailLoading)

  const lastMessageId = messages.length ? messages[messages.length - 1].id : 0

  const updatePinnedFromScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const gap = el.scrollHeight - el.scrollTop - el.clientHeight
    pinnedToBottomRef.current = gap <= NEAR_BOTTOM_PX
  }, [])

  const scrollPinnedToBottom = useCallback(() => {
    if (!pinnedToBottomRef.current) return
    flushScrollToBottom(scrollRef.current)
  }, [])

  /** Switching threads: always start at the bottom */
  useLayoutEffect(() => {
    pinnedToBottomRef.current = true
    flushScrollToBottom(scrollRef.current)
  }, [conversation.id])

  /** Conversation detail just finished loading — show latest messages first */
  useLayoutEffect(() => {
    const wasLoading = prevDetailLoadingRef.current
    prevDetailLoadingRef.current = detailLoading
    if (wasLoading && !detailLoading) {
      pinnedToBottomRef.current = true
      flushScrollToBottom(scrollRef.current)
    }
  }, [detailLoading])

  /** New messages / poll: follow only if already near bottom */
  useLayoutEffect(() => {
    if (detailLoading) return
    if (pinnedToBottomRef.current) {
      flushScrollToBottom(scrollRef.current)
    }
  }, [messages, lastMessageId, detailLoading])

  /** Content height changes (images, text wrap) without React state */
  useEffect(() => {
    const scrollEl = scrollRef.current
    const contentEl = contentRef.current
    if (!scrollEl || !contentEl) return

    const ro = new ResizeObserver(() => {
      if (pinnedToBottomRef.current) {
        flushScrollToBottom(scrollEl)
      }
    })
    ro.observe(contentEl)
    return () => ro.disconnect()
  }, [])

  return (
    <div className="flex h-full min-h-0 max-h-full flex-col bg-[#e5e5ea]">
      <ChatHeader
        conversation={conversation}
        showBack={showBack}
        onBack={onBack}
        onEditContact={onEditContact}
        showMockingToggle={showMockingToggle}
        mockingEnabled={mockingEnabled}
        onMockingChange={onMockingChange}
      />
      <div
        ref={scrollRef}
        onScroll={updatePinnedFromScroll}
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain px-3 pt-2 pb-1 [overflow-anchor:none]"
      >
        {detailLoading && (
          <p className="text-center text-sm text-slate-500 py-6">Loading messages…</p>
        )}
        {!detailLoading && (
          <div ref={contentRef} className="flex flex-col gap-0.5 pb-1">
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} onMediaLoad={scrollPinnedToBottom} />
            ))}
          </div>
        )}
      </div>
      <MessageComposer onSend={onSend} />
    </div>
  )
}

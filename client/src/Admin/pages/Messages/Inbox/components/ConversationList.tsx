import { useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import ConversationListItem from './ConversationListItem'
import MockingToggle from './MockingToggle'
import SimulateInboundDevControls from './SimulateInboundDevControls'
import type { ThreadContact } from '../types'

type Props = {
  conversations: ThreadContact[]
  selectedId: number | null
  onSelect: (id: number) => void
  onNewConversation: () => void
  listLoading?: boolean
  listLoadingMore?: boolean
  hasMore?: boolean
  onLoadMore?: () => void
  searchQuery: string
  onSearchChange: (q: string) => void
  /** ADMIN + VITE_DEVTOOLS: mock outbound SMS (no Twilio) */
  showMockingToggle?: boolean
  mockingEnabled?: boolean
  onMockingChange?: (enabled: boolean) => void
  /** VITE_DEVTOOLS: simulate inbound SMS below the list */
  showSimulateInbound?: boolean
  simulateInboundRows?: ThreadContact[]
  onSimulateInboundSuccess?: () => void | Promise<void>
  showArchived?: boolean
  onToggleArchivedView?: () => void
}

export default function ConversationList({
  conversations,
  selectedId,
  onSelect,
  onNewConversation,
  listLoading,
  listLoadingMore,
  hasMore,
  onLoadMore,
  searchQuery,
  onSearchChange,
  showMockingToggle,
  mockingEnabled,
  onMockingChange,
  showSimulateInbound,
  simulateInboundRows,
  onSimulateInboundSuccess,
  showArchived = false,
  onToggleArchivedView,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const onScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el || !hasMore || listLoadingMore || !onLoadMore) return
    const { scrollTop, scrollHeight, clientHeight } = el
    if (scrollHeight - scrollTop - clientHeight < 80) {
      onLoadMore()
    }
  }, [hasMore, listLoadingMore, onLoadMore])

  return (
    <div className="flex flex-col h-full min-h-0 bg-white md:rounded-l-xl md:border md:border-slate-200 md:overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-2 sm:px-3 py-2 border-b border-slate-200 shrink-0 bg-white/95 backdrop-blur-sm">
        <div className="flex items-center gap-1 min-w-0 flex-1">
          <Link
            to="/dashboard/messages"
            className="shrink-0 inline-flex items-center justify-center p-2 -ml-1 rounded-full text-blue-600 hover:bg-blue-50 active:bg-blue-100"
            aria-label="Back to Messages"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h2 className="text-lg font-bold text-slate-900 truncate">
            {showArchived ? 'Archived' : 'Messages'}
          </h2>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {showMockingToggle && typeof mockingEnabled === 'boolean' && onMockingChange && (
            <MockingToggle enabled={mockingEnabled} onChange={onMockingChange} />
          )}
          <button
            type="button"
            onClick={onNewConversation}
            className="shrink-0 p-2 rounded-full text-blue-600 hover:bg-blue-50 active:bg-blue-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="New message"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>
      <div className="px-2 sm:px-3 py-2 border-b border-slate-100 shrink-0">
        <label htmlFor="inbox-search" className="sr-only">
          Search by name or phone
        </label>
        <div className="flex gap-2 items-center">
          <input
            id="inbox-search"
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search name or number…"
            className="flex-1 min-w-0 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoComplete="off"
          />
          {onToggleArchivedView && (
            <button
              type="button"
              onClick={onToggleArchivedView}
              className={`shrink-0 rounded-lg border px-3 py-2 text-xs font-semibold whitespace-nowrap ${
                showArchived
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {showArchived ? 'Inbox' : 'Archived'}
            </button>
          )}
        </div>
      </div>
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto overscroll-contain min-h-0"
      >
        {listLoading && (
          <p className="text-center text-sm text-slate-500 py-8 px-4">Loading conversations…</p>
        )}
        {!listLoading && conversations.length === 0 && (
          <p className="text-center text-sm text-slate-500 py-8 px-4">
            {showArchived ? 'No archived conversations.' : 'No conversations yet.'}
          </p>
        )}
        {!listLoading &&
          conversations.map((c) => (
            <ConversationListItem
              key={c.id}
              conversation={c}
              selected={selectedId === c.id}
              onSelect={() => onSelect(c.id)}
            />
          ))}
        {listLoadingMore && (
          <p className="text-center text-xs text-slate-400 py-3">Loading more…</p>
        )}
      </div>
      {showSimulateInbound && (
        <div className="shrink-0 border-t border-amber-100 px-2 sm:px-3 py-2 bg-white">
          <SimulateInboundDevControls
            conversations={simulateInboundRows ?? []}
            onSuccess={onSimulateInboundSuccess}
          />
        </div>
      )}
    </div>
  )
}

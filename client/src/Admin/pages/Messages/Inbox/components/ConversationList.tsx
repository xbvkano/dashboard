import { Link } from 'react-router-dom'
import ConversationListItem from './ConversationListItem'
import MockingToggle from './MockingToggle'
import type { ThreadContact } from '../types'

type Props = {
  conversations: ThreadContact[]
  selectedId: number | null
  onSelect: (id: number) => void
  onNewConversation: () => void
  listLoading?: boolean
  /** ADMIN + VITE_DEVTOOLS: mock outbound SMS (no Twilio) */
  showMockingToggle?: boolean
  mockingEnabled?: boolean
  onMockingChange?: (enabled: boolean) => void
}

export default function ConversationList({
  conversations,
  selectedId,
  onSelect,
  onNewConversation,
  listLoading,
  showMockingToggle,
  mockingEnabled,
  onMockingChange,
}: Props) {
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
          <h2 className="text-lg font-bold text-slate-900 truncate">Messages</h2>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {showMockingToggle && typeof mockingEnabled === 'boolean' && onMockingChange && (
            <MockingToggle enabled={mockingEnabled} onChange={onMockingChange} />
          )}
          <button
            type="button"
            onClick={onNewConversation}
            className="shrink-0 p-2 rounded-full text-blue-600 hover:bg-blue-50 active:bg-blue-100"
            aria-label="New message"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto overscroll-contain min-h-0">
        {listLoading && (
          <p className="text-center text-sm text-slate-500 py-8 px-4">Loading conversations…</p>
        )}
        {!listLoading && conversations.length === 0 && (
          <p className="text-center text-sm text-slate-500 py-8 px-4">No conversations yet.</p>
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
      </div>
    </div>
  )
}

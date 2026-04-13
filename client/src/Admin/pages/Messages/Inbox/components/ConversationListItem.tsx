import { formatConversationTime } from '../formatTime'
import type { ThreadContact } from '../types'

type Props = {
  conversation: ThreadContact
  selected: boolean
  onSelect: () => void
}

export default function ConversationListItem({ conversation, selected, onSelect }: Props) {
  const title = conversation.contactName ?? conversation.phoneE164
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left flex gap-3 px-3 py-3 border-b border-slate-200/80 active:bg-slate-100 transition-colors ${
        selected ? 'bg-blue-50/90' : 'bg-white hover:bg-slate-50'
      }`}
    >
      <div className="shrink-0 w-11 h-11 rounded-full bg-gradient-to-br from-slate-300 to-slate-400 flex items-center justify-center text-white text-sm font-semibold">
        {(conversation.contactName ?? conversation.phoneE164).slice(0, 2).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span
            className={`truncate ${conversation.unread ? 'font-bold text-slate-900' : 'font-semibold text-slate-900'}`}
          >
            {title}
          </span>
          {conversation.unread && (
            <span className="shrink-0 w-2 h-2 rounded-full bg-blue-500" aria-label="Unread" />
          )}
          <span className="text-xs text-slate-500 shrink-0 tabular-nums">
            {conversation.lastAt ? formatConversationTime(conversation.lastAt) : '—'}
          </span>
        </div>
        <p className="text-sm text-slate-600 truncate mt-0.5">
          {conversation.lastPreview ?? '—'}
        </p>
      </div>
    </button>
  )
}

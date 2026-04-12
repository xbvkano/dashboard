import ChatActionsMenu from './ChatActionsMenu'
import MockingToggle from './MockingToggle'
import type { ThreadContact } from '../types'

type Props = {
  conversation: ThreadContact
  showBack: boolean
  onBack: () => void
  onEditContact: () => void
  /** Mobile full-screen chat hides the list header — show Mocking here */
  showMockingToggle?: boolean
  mockingEnabled?: boolean
  onMockingChange?: (enabled: boolean) => void
}

export default function ChatHeader({
  conversation,
  showBack,
  onBack,
  onEditContact,
  showMockingToggle,
  mockingEnabled,
  onMockingChange,
}: Props) {
  const title = conversation.contactName ?? 'Unknown'
  const subtitle = conversation.contactName ? conversation.phoneE164 : 'Text message'

  return (
    <header className="shrink-0 flex items-center gap-2 px-2 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] border-b border-slate-200/90 bg-white/95 backdrop-blur-md">
      {showBack && (
        <button
          type="button"
          onClick={onBack}
          className="p-2 -ml-1 rounded-full text-blue-600 hover:bg-slate-100 active:bg-slate-200 md:hidden"
          aria-label="Back to conversations"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-300 to-slate-400 flex items-center justify-center text-white text-xs font-semibold shrink-0">
        {(conversation.contactName ?? conversation.phoneE164).slice(0, 2).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-slate-900 truncate leading-tight">{title}</h3>
        <p className="text-xs text-slate-500 truncate">{subtitle}</p>
      </div>
      {showMockingToggle &&
        showBack &&
        typeof mockingEnabled === 'boolean' &&
        onMockingChange && (
          <div className="shrink-0">
            <MockingToggle enabled={mockingEnabled} onChange={onMockingChange} />
          </div>
        )}
      <ChatActionsMenu conversationId={conversation.id} onEditContact={onEditContact} />
    </header>
  )
}

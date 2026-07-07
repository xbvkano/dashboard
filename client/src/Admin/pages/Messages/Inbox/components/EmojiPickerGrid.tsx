import { SMS_EMOJIS } from '../smsEmojiList'

type Props = {
  onPick: (emoji: string) => void
  onBack: () => void
}

export default function EmojiPickerGrid({ onPick, onBack }: Props) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1 px-1 pb-2 border-b border-slate-100">
        <button
          type="button"
          onClick={onBack}
          className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-100 active:bg-slate-200"
          aria-label="Back to attachments"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>
      <div className="grid grid-cols-8 gap-0.5 max-h-40 overflow-y-auto pt-2 px-0.5">
        {SMS_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onPick(emoji)}
            className="w-9 h-9 text-xl flex items-center justify-center rounded-lg hover:bg-slate-100 active:bg-slate-200"
            aria-label={`Insert ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  )
}

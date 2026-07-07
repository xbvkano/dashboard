import EmojiPickerGrid from './EmojiPickerGrid'

export type AttachmentPanelView = 'toolbox' | 'emoji'

type Props = {
  view: AttachmentPanelView
  onPickImage: () => void
  onOpenEmoji: () => void
  onEmojiBack: () => void
  onPickEmoji: (emoji: string) => void
}

export default function ComposerAttachmentPanel({
  view,
  onPickImage,
  onOpenEmoji,
  onEmojiBack,
  onPickEmoji,
}: Props) {
  if (view === 'emoji') {
    return <EmojiPickerGrid onPick={onPickEmoji} onBack={onEmojiBack} />
  }

  return (
    <div className="flex items-center justify-center gap-8 py-1">
      <button
        type="button"
        onClick={onPickImage}
        className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 active:bg-slate-200"
        aria-label="Add photo"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <span className="text-xs font-medium">Image</span>
      </button>
      <button
        type="button"
        onClick={onOpenEmoji}
        className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 active:bg-slate-200"
        aria-label="Add emoji"
      >
        <span className="text-2xl leading-none" aria-hidden>
          😀
        </span>
        <span className="text-xs font-medium">Emoji</span>
      </button>
    </div>
  )
}

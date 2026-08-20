import { useEffect } from 'react'

type Props = {
  open: boolean
  title: string
  description: string
  confirming?: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
}

export default function MarkAllReadConfirmModal({
  open,
  title,
  description,
  confirming = false,
  onClose,
  onConfirm,
}: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !confirming) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, confirming, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mark-all-read-title"
      aria-describedby="mark-all-read-desc"
      onClick={() => {
        if (!confirming) onClose()
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200/80 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-2">
          <h2 id="mark-all-read-title" className="text-lg font-semibold text-slate-900">
            {title}
          </h2>
          <p id="mark-all-read-desc" className="mt-2 text-sm text-slate-600 leading-relaxed">
            {description}
          </p>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/80 px-4 py-4 sm:flex-row sm:justify-end sm:gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={confirming}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={confirming}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {confirming ? 'Marking…' : 'Mark all as read'}
          </button>
        </div>
      </div>
    </div>
  )
}

type Props = {
  open: boolean
  onClose: () => void
  onConfirm: () => void
}

export default function ResetTemplateConfirmModal({ open, onClose, onConfirm }: Props) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-template-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200/80 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-2">
          <h2 id="reset-template-title" className="text-lg font-semibold text-slate-900">
            Reset from template?
          </h2>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed">
            Reset message and variables from template? Your edits and removed variables will be
            lost.
          </p>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/80 px-4 py-4 sm:flex-row sm:justify-end sm:gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 rounded-xl text-slate-700 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-[44px] px-4 rounded-xl bg-amber-600 text-white font-semibold hover:bg-amber-700"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  )
}

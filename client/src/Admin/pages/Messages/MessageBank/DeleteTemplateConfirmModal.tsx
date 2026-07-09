type Props = {
  open: boolean
  templateName: string
  onClose: () => void
  onConfirm: () => void
  confirming?: boolean
}

export default function DeleteTemplateConfirmModal({
  open,
  templateName,
  onClose,
  onConfirm,
  confirming = false,
}: Props) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-template-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200/80 overflow-hidden">
        <div className="px-5 pt-5 pb-2">
          <h2 id="delete-template-title" className="text-lg font-semibold text-slate-900">
            Delete template?
          </h2>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed">
            Delete <span className="font-medium text-slate-900">&ldquo;{templateName}&rdquo;</span>?
            This cannot be undone.
          </p>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/80 px-4 py-4 sm:flex-row sm:justify-end sm:gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={confirming}
            className="min-h-[44px] px-4 rounded-xl text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirming}
            className="min-h-[44px] px-4 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-50"
          >
            {confirming ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

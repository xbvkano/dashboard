type Props = {
  open: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  confirming?: boolean
}

/**
 * Confirmation before forcing the global messaging inbox lease (replaces window.confirm).
 */
export default function InboxTakeOverConfirmModal({
  open,
  onClose,
  onConfirm,
  confirming = false,
}: Props) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="takeover-modal-title"
      aria-describedby="takeover-modal-desc"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200/80 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-2">
          <div className="flex items-start gap-3">
            <div
              className="shrink-0 flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-800"
              aria-hidden
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <h2 id="takeover-modal-title" className="text-lg font-semibold text-slate-900">
                Take over messaging inbox?
              </h2>
              <p id="takeover-modal-desc" className="mt-2 text-sm text-slate-600 leading-relaxed">
                The other session will lose access to the inbox until they refresh or leave Messages.
                Use this if you intentionally closed the other tab or need to recover access.
              </p>
            </div>
          </div>
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
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {confirming ? 'Taking over…' : 'Yes, take over'}
          </button>
        </div>
      </div>
    </div>
  )
}

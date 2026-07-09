import { useEffect, useState } from 'react'

type Props = {
  open: boolean
  onClose: () => void
  onConfirm: (label: string) => void
}

export default function AddCustomVariableModal({ open, onClose, onConfirm }: Props) {
  const [label, setLabel] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLabel('')
    setError(null)
  }, [open])

  if (!open) return null

  function handleConfirm() {
    const trimmed = label.trim()
    if (!trimmed) {
      setError('Label is required')
      return
    }
    onConfirm(trimmed)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center sm:p-4 bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-custom-variable-title"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-md sm:rounded-2xl shadow-xl border border-slate-200 p-4 sm:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="add-custom-variable-title" className="text-lg font-semibold text-slate-900">
          Add custom variable
        </h2>
        <p className="text-sm text-slate-600 mt-1">Enter a label for the new variable.</p>

        <label className="block mt-4">
          <span className="text-sm font-medium text-slate-700">Label</span>
          <input
            type="text"
            value={label}
            onChange={(e) => {
              setLabel(e.target.value)
              if (error) setError(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleConfirm()
              }
            }}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-[16px] md:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-500"
            placeholder="e.g. Gate Code"
            autoFocus
          />
        </label>

        {error && (
          <p className="mt-2 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 rounded-xl text-slate-700 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="min-h-[44px] px-4 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { createMessageBankGroup, formatApiError, type MessageBankGroupDto } from './messageBankApi'
import { normalizeHexColor } from './groupColor'

type Props = {
  open: boolean
  onClose: () => void
  onCreated: (group: MessageBankGroupDto) => void
}

export default function CreateGroupModal({ open, onClose, onCreated }: Props) {
  const [name, setName] = useState('')
  const [color, setColor] = useState('#ffffff')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setName('')
    setColor('#ffffff')
    setError(null)
    setSubmitting(false)
  }, [open])

  if (!open) return null

  const submit = async () => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Group name is required')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const created = await createMessageBankGroup({
        name: trimmedName,
        color: normalizeHexColor(color),
      })
      onCreated(created)
      onClose()
    } catch (e) {
      setError(formatApiError(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center sm:p-4 bg-black/40">
      <div
        className="bg-white w-full sm:max-w-md sm:rounded-2xl shadow-xl border border-slate-200 p-4 sm:p-5 max-h-[min(90dvh,28rem)] overflow-y-auto"
        role="dialog"
        aria-labelledby="create-group-title"
      >
        <h2 id="create-group-title" className="text-lg font-semibold text-slate-900">
          New group
        </h2>
        <p className="text-sm text-slate-600 mt-1">Give the group a name and pick a color.</p>

        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-[16px] md:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-500"
              placeholder="Group name"
              autoFocus
            />
          </label>

          <div>
            <span className="text-sm font-medium text-slate-700">Color</span>
            <div className="mt-2 flex items-center gap-4">
              <label className="relative shrink-0 cursor-pointer">
                <span
                  className="block w-16 h-16 rounded-2xl border-2 border-slate-200 shadow-inner"
                  style={{ backgroundColor: color }}
                />
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  aria-label="Pick group color"
                />
              </label>
              <div className="min-w-0">
                <p className="text-sm text-slate-600">Tap the swatch to open the color picker.</p>
                <p className="text-xs text-slate-500 font-mono mt-1 uppercase">{color}</p>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 rounded-xl text-slate-700 hover:bg-slate-100"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={submitting}
            className="min-h-[44px] px-4 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Creating…' : 'Create group'}
          </button>
        </div>
      </div>
    </div>
  )
}

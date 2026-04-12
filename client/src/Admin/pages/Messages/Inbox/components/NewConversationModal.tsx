import { useEffect, useState } from 'react'
import { formatApiError, startConversationFromContact } from '../messagingApi'

type Props = {
  open: boolean
  onClose: () => void
  onCreated: (conversationId: number) => void
}

export default function NewConversationModal({ open, onClose, onCreated }: Props) {
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const nameTrim = name.trim()
  const notesEnabled = Boolean(nameTrim)

  useEffect(() => {
    if (!open) return
    setPhone('')
    setName('')
    setNotes('')
    setError(null)
    setSubmitting(false)
  }, [open])

  if (!open) return null

  const submit = async () => {
    const phoneRaw = phone.trim()
    if (!phoneRaw) {
      setError('Phone number is required')
      return
    }
    if (notes.trim() && !nameTrim) {
      setError('Notes require a name')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const out = await startConversationFromContact({
        phoneRaw,
        name: nameTrim || null,
        notes: notesEnabled ? notes.trim() || null : null,
      })
      onCreated(out.conversationId)
      onClose()
    } catch (e) {
      setError(formatApiError(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4 bg-black/40">
      <div
        className="bg-white w-full sm:max-w-md sm:rounded-xl shadow-xl border border-slate-200 p-4 sm:p-5 max-h-[min(90dvh,32rem)] overflow-y-auto"
        role="dialog"
        aria-labelledby="new-conv-title"
      >
        <h2 id="new-conv-title" className="text-lg font-semibold text-slate-900">
          New conversation
        </h2>
        <p className="text-sm text-slate-600 mt-1">
          Enter a phone number. Add a name to create a client and link this contact. Notes are only
          available when a name is set.
        </p>
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Phone</span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-[15px] focus:outline-none focus:ring-2 focus:ring-blue-400/50"
              placeholder="+1…"
              autoComplete="tel"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Name (optional)</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-[15px] focus:outline-none focus:ring-2 focus:ring-blue-400/50"
              placeholder="Client name"
              autoComplete="name"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Notes (optional)</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={!notesEnabled}
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-[15px] focus:outline-none focus:ring-2 focus:ring-blue-400/50 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
              placeholder={notesEnabled ? 'Internal notes' : 'Add a name to enable notes'}
            />
          </label>
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
            className="px-4 py-2 rounded-lg text-slate-700 hover:bg-slate-100"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Starting…' : 'Start'}
          </button>
        </div>
      </div>
    </div>
  )
}

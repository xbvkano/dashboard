import { useEffect, useState } from 'react'
import { formatApiError, patchConversationClient } from '../messagingApi'

type Props = {
  open: boolean
  onClose: () => void
  conversationId: number
  /** Client name when linked; empty when no client */
  initialName: string
  initialNotes: string
  onSaved: () => void
}

export default function EditContactModal({
  open,
  onClose,
  conversationId,
  initialName,
  initialNotes,
  onSaved,
}: Props) {
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const nameTrim = name.trim()
  const notesEnabled = Boolean(nameTrim)

  useEffect(() => {
    if (!open) return
    setName(initialName)
    setNotes(initialNotes)
    setError(null)
    setSubmitting(false)
  }, [open, initialName, initialNotes])

  if (!open) return null

  const submit = async () => {
    const hadClient = initialName.trim().length > 0
    if (hadClient && !nameTrim) {
      setError('Name cannot be empty for a linked client')
      return
    }
    if (!hadClient && !nameTrim) {
      setError('Enter a name to create a client for this contact')
      return
    }
    if (notes.trim() && !nameTrim) {
      setError('Notes require a name')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await patchConversationClient(conversationId, {
        name: nameTrim || null,
        notes: notesEnabled ? (notes.trim() === '' ? null : notes.trim()) : null,
      })
      onSaved()
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
        aria-labelledby="edit-contact-title"
      >
        <h2 id="edit-contact-title" className="text-lg font-semibold text-slate-900">
          Edit contact
        </h2>
        <p className="text-sm text-slate-600 mt-1">
          Name and notes are stored on the client record. Add a name to enable notes for this
          number.
        </p>
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Name</span>
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
            <span className="text-sm font-medium text-slate-700">Notes</span>
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
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

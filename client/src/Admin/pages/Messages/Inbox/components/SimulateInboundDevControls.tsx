import { useEffect, useState } from 'react'
import type { ThreadContact } from '../types'
import { postSimulateInboundMessage } from '../messagingApi'

type Props = {
  conversations: ThreadContact[]
  onSuccess?: () => void | Promise<void>
  /** Shown when there are no conversations (e.g. DevTools before any threads exist) */
  emptyHint?: string
  className?: string
}

export default function SimulateInboundDevControls({
  conversations,
  onSuccess,
  emptyHint = 'No conversations yet. Open Messages and start a thread, or create one from New message.',
  className = '',
}: Props) {
  const [targetId, setTargetId] = useState<string>('')
  const [body, setBody] = useState('Test inbound from dev')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /** Only clear selection if the list becomes empty or the chosen id disappears — never auto-pick. */
  useEffect(() => {
    if (conversations.length === 0) {
      setTargetId('')
      return
    }
    setTargetId((prev) => {
      if (prev === '') return ''
      const id = parseInt(prev, 10)
      if (Number.isNaN(id)) return ''
      return conversations.some((c) => c.id === id) ? prev : ''
    })
  }, [conversations])

  const handleSend = async () => {
    if (targetId === '') {
      setError('Pick a conversation')
      return
    }
    const id = parseInt(targetId, 10)
    if (Number.isNaN(id)) {
      setError('Pick a conversation')
      return
    }
    const row = conversations.find((c) => c.id === id)
    if (!row) {
      setError('Conversation not found')
      return
    }
    const trimmed = body.trim()
    if (!trimmed) {
      setError('Enter a message')
      return
    }
    setError(null)
    setSending(true)
    try {
      await postSimulateInboundMessage({
        fromE164: row.phoneE164,
        toE164: row.businessNumber,
        body: trimmed,
      })
      await onSuccess?.()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setSending(false)
    }
  }

  if (conversations.length === 0) {
    return (
      <div
        className={`rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-xs text-amber-950 ${className}`}
      >
        <p className="font-semibold text-amber-900">Simulate inbound SMS (dev)</p>
        <p className="mt-1 text-amber-800/90">{emptyHint}</p>
      </div>
    )
  }

  return (
    <div
      className={`rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-xs text-amber-950 ${className}`}
    >
      <p className="font-semibold text-amber-900 mb-2">Simulate inbound SMS (dev)</p>
      <p className="text-amber-800/90 mb-2">
        Sends like Twilio inbound so you see customer bubbles, unread, and Pushover rules.
      </p>
      <div className="flex flex-col gap-2">
        <label className="flex flex-col gap-0.5">
          <span className="text-[11px] font-medium text-amber-900">Conversation</span>
          <select
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            className="rounded border border-amber-300 bg-white px-2 py-1.5 text-sm text-slate-900"
          >
            <option value="" disabled>
              — Select a conversation —
            </option>
            {conversations.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.contactName ?? 'Unknown'} · {c.phoneE164} (#{c.id})
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[11px] font-medium text-amber-900">Message</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
            className="rounded border border-amber-300 bg-white px-2 py-1.5 text-sm text-slate-900 resize-y min-h-[44px]"
            placeholder="Hello from a customer…"
          />
        </label>
        {error && <p className="text-red-700 text-[11px]">{error}</p>}
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={sending}
          className="self-start rounded-md bg-amber-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-800 disabled:opacity-50"
        >
          {sending ? 'Sending…' : 'Send as inbound'}
        </button>
      </div>
    </div>
  )
}

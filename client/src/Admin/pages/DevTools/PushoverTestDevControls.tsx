import { API_BASE_URL, fetchJson } from '../../../api'
import { useCallback, useEffect, useState } from 'react'
import { useModal } from '../../../ModalProvider'

type PushoverTestType = 'INBOUND_SMS' | 'WEBSITE_FORM' | 'INBOUND_CALL' | 'SERVICE_STATUS'

type PushoverPayload = {
  title: string
  message: string
  priority?: number
  sound?: string
  retry?: number
  expire?: number
}

type PushoverTestSample = {
  type: PushoverTestType
  label: string
  description: string
  payload: PushoverPayload
}

function priorityLabel(priority?: number): string {
  if (priority === 2) return 'Emergency (2) — repeats until ack or expire'
  if (priority === 1) return 'High (1)'
  if (priority === 0) return 'Normal (0)'
  return priority != null ? String(priority) : 'Default'
}

export default function PushoverTestDevControls() {
  const { alert } = useModal()
  const [samples, setSamples] = useState<PushoverTestSample[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState<PushoverTestType | null>(null)

  const loadSamples = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchJson(`${API_BASE_URL}/test/pushover/samples`) as {
        samples: PushoverTestSample[]
      }
      setSamples(data.samples ?? [])
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load Pushover samples'
      setSamples([])
      await alert(message)
    } finally {
      setLoading(false)
    }
  }, [alert])

  useEffect(() => {
    loadSamples()
  }, [loadSamples])

  const sendTest = async (type: PushoverTestType) => {
    setSending(type)
    try {
      const result = await fetchJson(`${API_BASE_URL}/test/pushover/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      }) as { label?: string; sent?: PushoverPayload }
      await alert(
        `Sent test Pushover: ${result.label ?? type}\n\n` +
          `Title: ${result.sent?.title ?? ''}\n\n` +
          `Body:\n${result.sent?.message ?? ''}`,
      )
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'error' in err
          ? String((err as { error?: string }).error)
          : err instanceof Error
            ? err.message
            : 'Pushover test failed'
      await alert(message)
    } finally {
      setSending(null)
    }
  }

  if (loading) {
    return <p className="text-sm text-gray-500">Loading Pushover previews…</p>
  }

  if (samples.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-gray-600">Could not load Pushover test samples.</p>
        <button
          type="button"
          onClick={() => loadSamples()}
          className="text-sm text-blue-600 hover:text-blue-800 underline"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {samples.map((sample) => (
        <div key={sample.type} className="border rounded-lg p-4 bg-gray-50 space-y-3">
          <div>
            <h4 className="font-semibold text-gray-900">{sample.label}</h4>
            <p className="text-xs text-gray-500 mt-1">{sample.description}</p>
          </div>

          <div className="rounded border bg-white p-3 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Preview</p>
            <p className="font-semibold text-gray-900 mt-2 break-words">{sample.payload.title}</p>
            <pre className="mt-2 text-sm text-gray-800 whitespace-pre-wrap break-words font-sans">
              {sample.payload.message}
            </pre>
          </div>

          <dl className="text-xs text-gray-600 space-y-1">
            <div className="flex justify-between gap-2">
              <dt>Priority</dt>
              <dd className="text-right">{priorityLabel(sample.payload.priority)}</dd>
            </div>
            {sample.payload.sound && (
              <div className="flex justify-between gap-2">
                <dt>Sound</dt>
                <dd>{sample.payload.sound}</dd>
              </div>
            )}
            {sample.payload.retry != null && (
              <div className="flex justify-between gap-2">
                <dt>Retry interval</dt>
                <dd>{sample.payload.retry}s</dd>
              </div>
            )}
            {sample.payload.expire != null && (
              <div className="flex justify-between gap-2">
                <dt>Expire</dt>
                <dd>{sample.payload.expire}s</dd>
              </div>
            )}
          </dl>

          <button
            type="button"
            onClick={() => sendTest(sample.type)}
            disabled={sending != null}
            className="w-full px-4 py-2 bg-violet-600 text-white rounded hover:bg-violet-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium"
          >
            {sending === sample.type ? 'Sending…' : 'Send test Pushover'}
          </button>
        </div>
      ))}
    </div>
  )
}

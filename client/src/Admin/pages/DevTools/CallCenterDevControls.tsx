import { useCallback, useEffect, useState } from 'react'
import { API_BASE_URL, fetchJson } from '../../../api'
import { useModal } from '../../../ModalProvider'

type Preset = {
  id: string
  label: string
  description: string
  kind: 'caller-context' | 'by-code' | 'on-duty' | 'voice'
  phone?: string
  code?: string
  path?: string
  from?: string
}

type StatusPayload = {
  callCenterUrl: string | null
  callCenterUrlConfigured: boolean
  twilioWebhookNote: string
  presets: Preset[]
}

type ResultView = {
  title: string
  body: string
}

export default function CallCenterDevControls() {
  const { alert } = useModal()
  const [status, setStatus] = useState<StatusPayload | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [code, setCode] = useState('001')
  const [customPhone, setCustomPhone] = useState('+17255774524')
  const [result, setResult] = useState<ResultView | null>(null)

  const loadStatus = useCallback(async () => {
    setLoadingStatus(true)
    try {
      const data = (await fetchJson(`${API_BASE_URL}/test/call-center/status`)) as StatusPayload
      setStatus(data)
    } catch (err: unknown) {
      setStatus(null)
      const message = err instanceof Error ? err.message : 'Failed to load call-center DevTools status'
      await alert(message)
    } finally {
      setLoadingStatus(false)
    }
  }, [alert])

  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  const showResult = (title: string, data: unknown) => {
    setResult({
      title,
      body: typeof data === 'string' ? data : JSON.stringify(data, null, 2),
    })
  }

  const runProbe = async (kind: 'caller-context' | 'by-code' | 'on-duty', overrides?: { phone?: string; code?: string }) => {
    const id = `probe-${kind}`
    setBusyId(id)
    try {
      const body: Record<string, string> = { kind }
      if (kind === 'caller-context') body.phone = overrides?.phone ?? customPhone
      if (kind === 'by-code') body.code = overrides?.code ?? code
      const data = await fetchJson(`${API_BASE_URL}/test/call-center/probe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      showResult(`Probe: ${kind}`, data)
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'error' in err
          ? String((err as { error?: string }).error)
          : err instanceof Error
            ? err.message
            : 'Probe failed'
      await alert(message)
    } finally {
      setBusyId(null)
    }
  }

  const runVoice = async (path: string, from: string, extra?: { Digits?: string; DialCallStatus?: string }) => {
    const id = `voice-${path}-${from}`
    setBusyId(id)
    try {
      const data = (await fetchJson(`${API_BASE_URL}/test/call-center/voice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, From: from, ...extra }),
      })) as { twiml?: string; error?: string }
      showResult(`TwiML ${path}`, data)
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'error' in err
          ? String((err as { error?: string }).error)
          : err instanceof Error
            ? err.message
            : 'Voice proxy failed'
      await alert(message)
    } finally {
      setBusyId(null)
    }
  }

  const runPreset = async (preset: Preset) => {
    if (preset.kind === 'caller-context') {
      await runProbe('caller-context', { phone: preset.phone })
      return
    }
    if (preset.kind === 'on-duty') {
      await runProbe('on-duty')
      return
    }
    if (preset.kind === 'by-code') {
      await runProbe('by-code', { code: code || preset.code })
      return
    }
    if (preset.kind === 'voice' && preset.path && preset.from) {
      await runVoice(preset.path, preset.from)
    }
  }

  if (loadingStatus) {
    return <p className="text-sm text-gray-500">Loading call-center DevTools…</p>
  }

  if (!status) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-gray-600">Could not load call-center DevTools status.</p>
        <button
          type="button"
          onClick={() => loadStatus()}
          className="text-sm text-blue-600 hover:text-blue-800 underline"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-600 bg-gray-50 border rounded p-2">
        {status.twilioWebhookNote}
      </p>
      <p className="text-sm text-gray-600">
        Voice proxy:{' '}
        {status.callCenterUrlConfigured ? (
          <code className="text-xs bg-gray-100 px-1 rounded">{status.callCenterUrl}</code>
        ) : (
          <span className="text-amber-700">
            not configured — set <code className="text-xs bg-gray-100 px-1 rounded">CALL_CENTER_URL</code>{' '}
            (e.g. http://localhost:5000) for TwiML buttons
          </span>
        )}
      </p>

      <div className="flex flex-wrap gap-3 items-end">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Phone for custom probe</span>
          <input
            type="text"
            value={customPhone}
            onChange={(e) => setCustomPhone(e.target.value)}
            className="border rounded px-2 py-1 min-w-[180px]"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Employee code</span>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="border rounded px-2 py-1 w-24"
            maxLength={6}
          />
        </label>
        <button
          type="button"
          disabled={busyId !== null}
          onClick={() => runProbe('caller-context')}
          className="px-3 py-2 bg-slate-700 text-white text-sm rounded hover:bg-slate-800 disabled:bg-gray-400"
        >
          Probe phone
        </button>
        <button
          type="button"
          disabled={busyId !== null}
          onClick={() => runProbe('by-code')}
          className="px-3 py-2 bg-slate-700 text-white text-sm rounded hover:bg-slate-800 disabled:bg-gray-400"
        >
          Lookup code
        </button>
        <button
          type="button"
          disabled={busyId !== null || !status.callCenterUrlConfigured}
          onClick={() => runVoice('/admin-code', customPhone, { Digits: code })}
          className="px-3 py-2 bg-teal-600 text-white text-sm rounded hover:bg-teal-700 disabled:bg-gray-400"
        >
          TwiML admin-code
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {status.presets.map((preset) => {
          const needsVoice = preset.kind === 'voice'
          const disabled =
            busyId !== null || (needsVoice && !status.callCenterUrlConfigured)
          return (
            <div key={preset.id} className="border rounded-lg p-3 bg-gray-50 space-y-2">
              <h4 className="font-semibold text-gray-900 text-sm">{preset.label}</h4>
              <p className="text-xs text-gray-600">{preset.description}</p>
              <button
                type="button"
                disabled={disabled}
                onClick={() => runPreset(preset)}
                className="w-full px-3 py-2 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {busyId ? 'Running…' : 'Run'}
              </button>
            </div>
          )
        })}
      </div>

      {result && (
        <div className="border rounded-lg p-3 bg-white">
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-semibold text-sm">{result.title}</h4>
            <button
              type="button"
              className="text-xs text-gray-500 hover:text-gray-800"
              onClick={() => setResult(null)}
            >
              Clear
            </button>
          </div>
          <pre className="text-xs overflow-auto max-h-96 whitespace-pre-wrap break-words bg-gray-50 p-2 rounded border">
            {result.body}
          </pre>
        </div>
      )}
    </div>
  )
}

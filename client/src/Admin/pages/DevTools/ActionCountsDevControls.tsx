import { useState } from 'react'
import { API_BASE_URL, fetchJson } from '../../../api'
import { useModal } from '../../../ModalProvider'
import { useActionCounts } from '../../ActionCountsProvider'
import { showDesktopNotificationTest } from '../../desktopNotification'

type Busy =
  | 'reset-messages'
  | 'create-messages'
  | 'create-messages-delay'
  | 'reset-leads'
  | 'create-leads'
  | 'create-leads-delay'
  | 'permission'
  | null

export default function ActionCountsDevControls() {
  const { alert } = useModal()
  const { counts, refresh } = useActionCounts()
  const [busy, setBusy] = useState<Busy>(null)
  const [inbox, setInbox] = useState<'client' | 'employee' | 'both'>('both')
  const [forms, setForms] = useState(true)
  const [calls, setCalls] = useState(true)

  const run = async (key: Busy, fn: () => Promise<void>) => {
    if (busy) return
    setBusy(key)
    try {
      await fn()
    } finally {
      setBusy(null)
    }
  }

  const afterChange = async (summary: string, silent = false, notify: 'auto' | 'always' = 'auto') => {
    await refresh({ notify })
    if (!silent) await alert(summary)
  }

  const createMessages = async (silent = false) => {
    const result = await fetchJson(`${API_BASE_URL}/test/action-counts/create-messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inbox }),
    })
    const n = Array.isArray(result?.created) ? result.created.length : 0
    await afterChange(
      `Created ${n} unread SMS thread(s).\n\n${JSON.stringify(result, null, 2)}`,
      silent,
      'always',
    )
  }

  const createLeads = async (silent = false) => {
    const result = await fetchJson(`${API_BASE_URL}/test/action-counts/create-leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ forms, calls }),
    })
    await afterChange(
      `Unvisited leads — forms: ${result?.forms ?? 0}, calls: ${result?.calls ?? 0} (${result?.method ?? ''}).`,
      silent,
      'always',
    )
  }

  const delayThen = async (seconds: number, fn: () => Promise<void>) => {
    await new Promise((r) => window.setTimeout(r, seconds * 1000))
    await fn()
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Current counts — Messages {counts.messages.total} (client {counts.messages.client} · employee{' '}
        {counts.messages.employee}), Leads {counts.leads.total} (forms {counts.leads.forms} · calls{' '}
        {counts.leads.calls}).
      </p>
      <p className="text-sm text-gray-600">
        Creating unread SMS from here does <strong>not</strong> send Pushover. Use{' '}
        <strong>Request desktop notification permission</strong> first — that also shows a test
        Windows/Chrome notification so you can confirm the OS is allowing them. Create buttons show a
        desktop notification immediately. Incoming SMS while you are in another window also notifies.
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy != null}
          onClick={() =>
            run('permission', async () => {
              if (typeof Notification === 'undefined') {
                await alert('This browser has no Notification API')
                return
              }
              const result = await Notification.requestPermission()
              if (result === 'granted') {
                const shown = showDesktopNotificationTest()
                await alert(
                  shown
                    ? 'Permission granted. A test desktop notification should appear now.'
                    : 'Permission is granted, but the browser blocked showing a notification. Check Windows Focus assist / notification settings.',
                )
                return
              }
              await alert(`Notification permission: ${result}`)
            })
          }
          className="px-3 py-2 rounded bg-slate-700 text-white text-sm hover:bg-slate-800 disabled:bg-gray-400"
        >
          Request desktop notification permission
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
          <h4 className="font-semibold text-gray-900">Messages (SMS unread)</h4>
          <label className="block text-sm text-gray-700">
            Inbox
            <select
              value={inbox}
              onChange={(e) => setInbox(e.target.value as 'client' | 'employee' | 'both')}
              className="mt-1 w-full border rounded px-2 py-1 bg-white"
            >
              <option value="client">Client</option>
              <option value="employee">Employee</option>
              <option value="both">Both</option>
            </select>
          </label>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={busy != null}
              onClick={() => run('create-messages', () => createMessages())}
              className="px-3 py-2 rounded bg-red-600 text-white text-sm hover:bg-red-700 disabled:bg-gray-400"
            >
              {busy === 'create-messages' ? 'Creating…' : 'Create unread SMS'}
            </button>
            <button
              type="button"
              disabled={busy != null}
              onClick={() =>
                run('create-messages-delay', async () => {
                  await delayThen(5, () => createMessages(true))
                })
              }
              className="px-3 py-2 rounded bg-red-100 text-red-800 text-sm hover:bg-red-200 disabled:bg-gray-200"
            >
              {busy === 'create-messages-delay' ? 'Waiting 5s…' : 'Create unread SMS in 5 seconds'}
            </button>
            <button
              type="button"
              disabled={busy != null}
              onClick={() =>
                run('reset-messages', async () => {
                  const result = await fetchJson(`${API_BASE_URL}/test/action-counts/reset-messages`, {
                    method: 'POST',
                  })
                  await afterChange(`Marked ${result?.markedRead ?? 0} open thread(s) as read.`)
                })
              }
              className="px-3 py-2 rounded bg-white border border-slate-300 text-slate-800 text-sm hover:bg-slate-50 disabled:bg-gray-200"
            >
              {busy === 'reset-messages' ? 'Resetting…' : 'Reset message notifications'}
            </button>
          </div>
        </div>

        <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
          <h4 className="font-semibold text-gray-900">Leads (unvisited / blue)</h4>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={forms} onChange={(e) => setForms(e.target.checked)} />
            Forms
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={calls} onChange={(e) => setCalls(e.target.checked)} />
            Calls
          </label>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={busy != null || (!forms && !calls)}
              onClick={() => run('create-leads', () => createLeads())}
              className="px-3 py-2 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:bg-gray-400"
            >
              {busy === 'create-leads' ? 'Creating…' : 'Create unvisited leads'}
            </button>
            <button
              type="button"
              disabled={busy != null || (!forms && !calls)}
              onClick={() =>
                run('create-leads-delay', async () => {
                  await delayThen(5, () => createLeads(true))
                })
              }
              className="px-3 py-2 rounded bg-blue-100 text-blue-800 text-sm hover:bg-blue-200 disabled:bg-gray-200"
            >
              {busy === 'create-leads-delay' ? 'Waiting 5s…' : 'Create unvisited leads in 5 seconds'}
            </button>
            <button
              type="button"
              disabled={busy != null}
              onClick={() =>
                run('reset-leads', async () => {
                  const result = await fetchJson(`${API_BASE_URL}/test/action-counts/reset-leads`, {
                    method: 'POST',
                  })
                  await afterChange(
                    `Marked visited — forms: ${result?.forms ?? 0}/${result?.formsAttempted ?? result?.forms ?? 0}, calls: ${result?.calls ?? 0}/${result?.callsAttempted ?? result?.calls ?? 0}.` +
                      (Array.isArray(result?.formFailures) && result.formFailures.length
                        ? `\nForm PATCH failed for ids: ${result.formFailures.join(', ')}`
                        : '') +
                      (Array.isArray(result?.callFailures) && result.callFailures.length
                        ? `\nCall PATCH failed for ids: ${result.callFailures.join(', ')}`
                        : ''),
                  )
                })
              }
              className="px-3 py-2 rounded bg-white border border-slate-300 text-slate-800 text-sm hover:bg-slate-50 disabled:bg-gray-200"
            >
              {busy === 'reset-leads' ? 'Resetting…' : 'Reset lead notifications'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

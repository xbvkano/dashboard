import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { API_BASE_URL, fetchJson } from '../../../api'

export type CouponType = 'percent' | 'flat' | 'item'

export interface Coupon {
  id: string
  name: string
  type: CouponType
  value: string
  expireDate: string
  useCount: number
}

function isExpired(expireDate: string): boolean {
  return new Date(expireDate) < new Date()
}

function formatExpireDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

/** Parse a date-only string (YYYY-MM-DD) as end of day in local time, return UTC ISO. */
function toISOEndOfDay(dateStr: string): string {
  const [y, m, day] = dateStr.slice(0, 10).split('-').map(Number)
  const d = new Date(y, (m ?? 1) - 1, day ?? 1, 23, 59, 59, 999)
  return d.toISOString()
}

/**
 * Convert server UTC ISO string to datetime-local input value (local time).
 * Display: server sends UTC → we show local.
 */
function utcISOToLocalDatetimeInput(iso: string): string {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day}T${h}:${min}`
}

/**
 * Convert datetime-local value (local time) to UTC ISO for the server.
 * Submit: user picks local → we send UTC.
 */
function localDatetimeInputToUTCISO(localValue: string): string {
  if (localValue.length < 16) return toISOEndOfDay(localValue.slice(0, 10))
  const [datePart, timePart] = localValue.split('T')
  const [y, m, day] = datePart.split('-').map(Number)
  const [h, min] = (timePart || '00:00').split(':').map(Number)
  const d = new Date(y, (m ?? 1) - 1, day ?? 1, h ?? 0, min ?? 0, 0, 0)
  return d.toISOString()
}

type Filter = 'all' | 'active' | 'expired'

export default function Coupons() {
  const [list, setList] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<Coupon | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const couponsUrl = `${API_BASE_URL}/api/coupons`

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchJson(couponsUrl)
      setList(Array.isArray(data) ? data : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load coupons')
      setList([])
    } finally {
      setLoading(false)
    }
  }, [couponsUrl])

  useEffect(() => {
    load()
  }, [load])

  const filtered =
    filter === 'all'
      ? list
      : filter === 'active'
        ? list.filter((c) => !isExpired(c.expireDate))
        : list.filter((c) => isExpired(c.expireDate))

  const handleCreate = async (payload: {
    name: string
    type: CouponType
    value: string
    expireDate: string
    useCount?: number
  }) => {
    const res = await fetch(couponsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: payload.name.trim(),
        type: payload.type,
        value: payload.value.trim(),
        expireDate: payload.expireDate,
        useCount: payload.useCount ?? 0,
      }),
    })
    const text = await res.text()
    if (!res.ok) {
      let msg = 'Failed to create coupon'
      try {
        const j = JSON.parse(text)
        if (j.message) msg = j.message
      } catch {
        if (text) msg = text
      }
      throw new Error(msg)
    }
    const created = JSON.parse(text) as Coupon
    setList((prev) => [created, ...prev])
    setCreateOpen(false)
  }

  const handleUpdate = async (
    id: string,
    payload: Partial<{ name: string; type: CouponType; value: string; expireDate: string; useCount: number }>
  ) => {
    const res = await fetch(`${couponsUrl}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const text = await res.text()
    if (!res.ok) {
      let msg = 'Failed to update coupon'
      try {
        const j = JSON.parse(text)
        if (j.message) msg = j.message
      } catch {
        if (text) msg = text
      }
      throw new Error(msg)
    }
    const updated = JSON.parse(text) as Coupon
    setList((prev) => prev.map((c) => (c.id === id ? updated : c)))
    setEditing(null)
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this coupon? This cannot be undone.')) return
    setDeletingId(id)
    try {
      const res = await fetch(`${couponsUrl}/${id}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 204) {
        const text = await res.text()
        let msg = 'Failed to delete coupon'
        try {
          const j = JSON.parse(text)
          if (j.message) msg = j.message
        } catch {
          if (text) msg = text
        }
        throw new Error(msg)
      }
      setList((prev) => prev.filter((c) => c.id !== id))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="p-4 pb-16">
      <Link to=".." className="text-blue-600 text-sm hover:underline">
        ← Back to Financing
      </Link>
      <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold text-slate-800">Coupons</h2>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-600">Show:</span>
          {(['all', 'active', 'expired'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize ${
                filter === f
                  ? 'bg-slate-700 text-white'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              {f}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="ml-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Create coupon
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
          <button
            type="button"
            onClick={load}
            className="ml-2 font-medium underline"
          >
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="mt-6 text-slate-500">Loading coupons…</div>
      ) : filtered.length === 0 ? (
        <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-6 text-center text-slate-600">
          {list.length === 0
            ? 'No coupons yet. Create one to get started.'
            : `No ${filter} coupons.`}
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 font-semibold text-slate-700">Code</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Type</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Value</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Expires</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Uses</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Status</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-slate-100 hover:bg-slate-50/80"
                >
                  <td className="px-4 py-3 font-mono font-medium text-slate-800">
                    {c.name}
                  </td>
                  <td className="px-4 py-3 capitalize text-slate-700">
                    {c.type}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {c.type === 'percent' ? `${c.value}%` : c.type === 'flat' ? `$${c.value}` : c.value}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatExpireDate(c.expireDate)}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{c.useCount}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        isExpired(c.expireDate)
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {isExpired(c.expireDate) ? 'Expired' : 'Active'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditing(c)}
                        className="text-blue-600 hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(c.id)}
                        disabled={deletingId === c.id}
                        className="text-red-600 hover:underline disabled:opacity-50"
                      >
                        {deletingId === c.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {createOpen && (
        <CouponForm
          title="Create coupon"
          initial={{
            name: '',
            type: 'percent',
            value: '',
            expireDate: toISOEndOfDay(
              new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
                .toISOString()
                .slice(0, 10)
            ),
            useCount: 0,
          }}
          onSubmit={handleCreate}
          onClose={() => setCreateOpen(false)}
        />
      )}

      {editing && (
        <CouponForm
          title="Edit coupon"
          initial={{
            name: editing.name,
            type: editing.type,
            value: editing.value,
            expireDate: editing.expireDate.slice(0, 19),
            useCount: editing.useCount,
          }}
          onSubmit={async (payload) => {
            await handleUpdate(editing.id, {
              name: payload.name,
              type: payload.type,
              value: payload.value,
              expireDate: payload.expireDate,
              useCount: payload.useCount,
            })
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

interface CouponFormProps {
  title: string
  initial: {
    name: string
    type: CouponType
    value: string
    expireDate: string
    useCount: number
  }
  onSubmit: (payload: {
    name: string
    type: CouponType
    value: string
    expireDate: string
    useCount: number
  }) => Promise<void>
  onClose: () => void
}

function CouponForm({ title, initial, onSubmit, onClose }: CouponFormProps) {
  const [name, setName] = useState(initial.name)
  const [type, setType] = useState<CouponType>(initial.type)
  const [value, setValue] = useState(initial.value)
  const [expireDate, setExpireDate] = useState(() =>
    initial.expireDate.includes('T')
      ? utcISOToLocalDatetimeInput(initial.expireDate)
      : `${initial.expireDate.slice(0, 10)}T23:59`
  )
  const [useCount, setUseCount] = useState(initial.useCount)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!name.trim()) {
      setFormError('Name is required.')
      return
    }
    if (!value.trim()) {
      setFormError('Value is required.')
      return
    }
    const iso =
      expireDate.length >= 16
        ? localDatetimeInputToUTCISO(expireDate)
        : toISOEndOfDay(expireDate.slice(0, 10))
    setSaving(true)
    try {
      await onSubmit({
        name: name.trim(),
        type,
        value: value.trim(),
        expireDate: iso,
        useCount,
      })
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-200 px-4 py-3">
          <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-4">
          {formError && (
            <div className="rounded-lg bg-red-50 p-2 text-sm text-red-700">
              {formError}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Code (name)
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. SAVE10"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as CouponType)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800"
            >
              <option value="percent">Percent</option>
              <option value="flat">Flat ($)</option>
              <option value="item">Item (free text)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Value
            </label>
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={type === 'percent' ? '10' : type === 'flat' ? '10' : 'Free baseboards'}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Expiration (date/time, your local time)
            </label>
            <input
              type="datetime-local"
              value={expireDate}
              onChange={(e) => setExpireDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Use count
            </label>
            <input
              type="number"
              min={0}
              value={useCount}
              onChange={(e) => setUseCount(parseInt(e.target.value, 10) || 0)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-slate-800 px-4 py-2 text-white hover:bg-slate-900 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

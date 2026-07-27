import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { API_BASE_URL, fetchJson } from '../../../api'

type AdminRole = 'OWNER' | 'ADMIN' | 'SUPERVISOR'

type AdminUser = {
  id: number
  name: string | null
  email: string | null
  userName: string | null
  role: AdminRole
  type: string
  disabled: boolean
  employeeId: number | null
}

function isOwner(): boolean {
  try {
    return localStorage.getItem('role') === 'OWNER'
  } catch {
    return false
  }
}

export default function AdminsPage() {
  if (!isOwner()) {
    return <Navigate to="/dashboard/contacts" replace />
  }

  return <AdminsManager />
}

function AdminsManager() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<number | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchJson<{ users: AdminUser[] }>(
        `${API_BASE_URL}/admin-accounts?all=true`,
      )
      setUsers(Array.isArray(data.users) ? data.users : [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load admin accounts')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const patchUser = async (id: number, body: { role?: AdminRole; disabled?: boolean }) => {
    setSavingId(id)
    setMessage(null)
    setError(null)
    try {
      const data = await fetchJson<{ user: AdminUser }>(`${API_BASE_URL}/admin-accounts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      setUsers((prev) => prev.map((u) => (u.id === id ? data.user : u)))
      setMessage('Saved')
      window.setTimeout(() => setMessage(null), 2000)
    } catch (e: unknown) {
      let msg = e instanceof Error ? e.message : 'Save failed'
      try {
        const p = JSON.parse(msg) as { error?: string }
        if (p?.error) msg = p.error
      } catch {
        /* ignore */
      }
      setError(msg)
    } finally {
      setSavingId(null)
    }
  }

  const enabled = users.filter((u) => !u.disabled)
  const disabled = users.filter((u) => u.disabled)

  return (
    <div className="p-4 pb-16 max-w-3xl">
      <Link to="/dashboard/contacts" className="text-blue-500 text-sm">
        &larr; Back to Contacts
      </Link>
      <h2 className="text-xl font-semibold mt-2 mb-1">Admins</h2>
      <p className="text-sm text-slate-600 mb-4">
        Manage Owners, Admins, and Supervisors. Only Owners can open this page. Disabling blocks
        sign-in and removes them from the on-duty picker.
      </p>

      {message && (
        <div className="mb-3 text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          {message}
        </div>
      )}
      {error && (
        <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <>
          <AdminSection
            title={`Enabled (${enabled.length})`}
            users={enabled}
            savingId={savingId}
            onChangeRole={(id, role) => void patchUser(id, { role })}
            onToggleDisabled={(id, disabled) => void patchUser(id, { disabled })}
          />
          <AdminSection
            title={`Disabled (${disabled.length})`}
            users={disabled}
            savingId={savingId}
            onChangeRole={(id, role) => void patchUser(id, { role })}
            onToggleDisabled={(id, nextDisabled) => void patchUser(id, { disabled: nextDisabled })}
            muted
          />
        </>
      )}
    </div>
  )
}

function AdminSection({
  title,
  users,
  savingId,
  onChangeRole,
  onToggleDisabled,
  muted,
}: {
  title: string
  users: AdminUser[]
  savingId: number | null
  onChangeRole: (id: number, role: AdminRole) => void
  onToggleDisabled: (id: number, disabled: boolean) => void
  muted?: boolean
}) {
  return (
    <section className="mb-8">
      <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-2">{title}</h3>
      <ul
        className={`divide-y rounded-lg overflow-hidden border ${
          muted ? 'border-red-200 bg-red-50/40' : 'border-slate-200 bg-white'
        }`}
      >
        {users.length === 0 ? (
          <li className="py-3 px-3 text-sm text-slate-500">None</li>
        ) : (
          users.map((u) => (
            <li key={u.id} className="px-3 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-slate-900 truncate">{u.name || 'Unnamed'}</div>
                <div className="text-xs text-slate-500 truncate">
                  {[u.email, u.userName].filter(Boolean).join(' · ') || `User #${u.id}`}
                  {u.type ? ` · ${u.type}` : ''}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <label className="text-xs text-slate-600 flex items-center gap-1">
                  Role
                  <select
                    value={u.role}
                    disabled={savingId === u.id}
                    onChange={(e) => onChangeRole(u.id, e.target.value as AdminRole)}
                    className="border border-slate-300 rounded-md px-2 py-1 text-sm bg-white"
                  >
                    <option value="OWNER">Owner</option>
                    <option value="ADMIN">Admin</option>
                    <option value="SUPERVISOR">Supervisor</option>
                  </select>
                </label>
                <button
                  type="button"
                  disabled={savingId === u.id}
                  onClick={() => onToggleDisabled(u.id, !u.disabled)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                    u.disabled
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : 'bg-slate-200 text-slate-800 hover:bg-slate-300'
                  } disabled:opacity-50`}
                >
                  {savingId === u.id ? 'Saving…' : u.disabled ? 'Enable' : 'Disable'}
                </button>
              </div>
            </li>
          ))
        )}
      </ul>
    </section>
  )
}

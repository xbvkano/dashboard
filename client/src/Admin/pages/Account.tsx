import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_ACCESS_TOKEN_KEY, API_BASE_URL, fetchJson } from '../../api'

type UserMe = {
  id: number
  email: string | null
  name: string | null
  role: string
  userName: string | null
  messageBubbleColor: string | null
}

const DEFAULT_BLUE = '#3b82f6'

export default function Account({
  onLogout,
}: {
  onLogout: () => void
}) {
  const navigate = useNavigate()
  const [user, setUser] = useState<UserMe | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState(DEFAULT_BLUE)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchJson(`${API_BASE_URL}/users/me`)
      .then((u: UserMe) => {
        if (cancelled) return
        setUser(u)
        setName(u.name ?? '')
        setColor(u.messageBubbleColor && /^#[0-9A-Fa-f]{6}$/.test(u.messageBubbleColor) ? u.messageBubbleColor : DEFAULT_BLUE)
      })
      .catch(() => {
        if (!cancelled) setError('Could not load account')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const save = useCallback(async () => {
    setSaving(true)
    setError(null)
    try {
      const updated = await fetchJson(`${API_BASE_URL}/users/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || null,
          messageBubbleColor: color === DEFAULT_BLUE ? null : color,
        }),
      })
      setUser(updated as UserMe)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }, [name, color])

  const signOut = () => {
    if (!window.confirm('Are you sure you want to sign out?')) return
    localStorage.removeItem('role')
    localStorage.removeItem('safe')
    localStorage.removeItem('userName')
    localStorage.removeItem('userId')
    localStorage.removeItem('loginMethod')
    localStorage.removeItem(API_ACCESS_TOKEN_KEY)
    localStorage.setItem('signedOut', 'true')
    onLogout()
    navigate('/')
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <h1 className="text-xl font-semibold text-gray-900 mb-4">Account</h1>
      {loading && <p className="text-gray-600">Loading…</p>}
      {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
      {!loading && user && (
        <div className="space-y-4 bg-white rounded-lg shadow border border-gray-200 p-4">
          <p className="text-sm text-gray-600">
            User ID: <span className="font-mono text-gray-900">{user.id}</span>
          </p>
          {user.email && (
            <p className="text-sm text-gray-600">
              Email: <span className="text-gray-900">{user.email}</span>
            </p>
          )}
          <div>
            <label htmlFor="acc-name" className="block text-sm font-medium text-gray-700 mb-1">
              Display name
            </label>
            <input
              id="acc-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900"
            />
          </div>
          <div>
            <label htmlFor="acc-color" className="block text-sm font-medium text-gray-700 mb-1">
              Outbound message bubble color
            </label>
            <div className="flex items-center gap-3 flex-wrap">
              <input
                id="acc-color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-11 w-14 rounded border border-gray-300 cursor-pointer"
              />
              <span className="text-sm text-gray-600 font-mono">{color}</span>
              <button
                type="button"
                onClick={() => setColor(DEFAULT_BLUE)}
                className="text-sm text-blue-600 hover:underline"
              >
                Reset to default blue
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">Used as the background for SMS you send from the inbox.</p>
          </div>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="w-full py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          <button
            type="button"
            onClick={signOut}
            className="w-full py-2 rounded-lg border border-gray-300 text-gray-800 font-medium hover:bg-gray-50"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

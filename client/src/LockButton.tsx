import { useEffect, useState } from 'react'
import { API_BASE_URL, fetchJson } from './api'
import { useModal } from './ModalProvider'

interface LockStatus {
  locked: boolean
  lockedBy: { id: number; name?: string | null; email: string } | null
  lockedAt: string | null
}

export default function LockButton() {
  const [status, setStatus] = useState<LockStatus | null>(null)
  const { confirm, alert } = useModal()
  const userId = Number(localStorage.getItem('userId'))

  const load = () => {
    fetchJson(`${API_BASE_URL}/lock`)
      .then((d) => setStatus(d))
      .catch(() => setStatus(null))
  }

  useEffect(() => {
    load()
    const id = setInterval(load, 5000)
    return () => clearInterval(id)
  }, [])

  if (!userId) return null

  const hasLock = status?.lockedBy?.id === userId
  const isLocked = status?.locked

  const acquire = async () => {
    const ok = await confirm('Take lock?')
    if (!ok) return
    try {
      await fetchJson(`${API_BASE_URL}/lock/acquire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      load()
    } catch (err) {
      console.error(err)
      alert('Failed to acquire lock')
      load()
    }
  }

  const release = async () => {
    const ok = await confirm('Release lock?')
    if (!ok) return
    try {
      await fetchJson(`${API_BASE_URL}/lock/release`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      load()
    } catch (err) {
      console.error(err)
      alert('Failed to release lock')
      load()
    }
  }

  const color = hasLock ? 'bg-purple-500' : isLocked ? 'bg-red-500' : 'bg-green-500'
  const action = hasLock ? release : acquire
  const disabled = isLocked && !hasLock
  const label = hasLock ? 'Release Lock' : 'Take Lock'

  return (
    <button
      className={`px-4 py-1 text-white rounded ${color} disabled:opacity-50`}
      onClick={action}
      disabled={disabled}
    >
      {label}
    </button>
  )
}


import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminDashboard from '../Admin/AdminDashboard'
import EmployeeDashboard from '../Employee/EmployeeDashboard'
import {
  API_ACCESS_TOKEN_KEY,
  clearAuthStorage,
  refreshAccessTokenFromApi,
  setAuthExpiredHandler,
} from '../api'
import { isViteNoAuth } from '../devNoAuth'

type Role = 'ADMIN' | 'OWNER' | 'EMPLOYEE'

interface DashboardProps {
  role: Role
  onLogout: () => void
  /** Optional third arg: dev NO_AUTH admin user id (1 or 2) for inbox lock testing in two tabs */
  onSwitchRole?: (role: Role, userName?: string, devUserId?: number) => void
}

export default function Dashboard({ role, onLogout, onSwitchRole }: DashboardProps) {
  const navigate = useNavigate()
  const [sessionReady, setSessionReady] = useState(() => isViteNoAuth())

  useEffect(() => {
    setAuthExpiredHandler(() => {
      onLogout()
      navigate('/', { replace: true })
    })
    return () => setAuthExpiredHandler(null)
  }, [onLogout, navigate])

  useEffect(() => {
    if (isViteNoAuth()) return

    let cancelled = false
    ;(async () => {
      const t = localStorage.getItem(API_ACCESS_TOKEN_KEY)
      if (!t) {
        clearAuthStorage()
        onLogout()
        navigate('/', { replace: true })
        return
      }
      const ok = await refreshAccessTokenFromApi()
      if (cancelled) return
      if (!ok) {
        clearAuthStorage()
        onLogout()
        navigate('/', { replace: true })
        return
      }
      setSessionReady(true)
    })()

    return () => {
      cancelled = true
    }
  }, [onLogout, navigate])

  if (!sessionReady) {
    return null
  }

  return role === 'EMPLOYEE' ? (
    <EmployeeDashboard onLogout={onLogout} onSwitchRole={onSwitchRole} />
  ) : (
    <AdminDashboard onLogout={onLogout} onSwitchRole={onSwitchRole} />
  )
}

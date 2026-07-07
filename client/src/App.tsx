import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import Login from './Landing/components/Login'
import Dashboard from './Landing/Dashboard'
import { API_ACCESS_TOKEN_KEY } from './api'
import { ensureNoAuthDevSession, isViteNoAuth } from './devNoAuth'

type Role = 'ADMIN' | 'OWNER' | 'EMPLOYEE'

export default function App() {
  const [noAuthBootstrapping, setNoAuthBootstrapping] = useState(() => isViteNoAuth())
  const [noAuthBootstrapError, setNoAuthBootstrapError] = useState<string | null>(null)

  const [role, setRole] = useState<Role | null>(() => {
    if (isViteNoAuth()) {
      return null
    }

    const signedOut = localStorage.getItem('signedOut') === 'true'
    if (signedOut) {
      localStorage.removeItem('signedOut')
      return null
    }

    const stored = localStorage.getItem('role')
    return stored === 'ADMIN' || stored === 'OWNER' || stored === 'EMPLOYEE'
      ? (stored as Role)
      : null
  })

  useEffect(() => {
    if (!isViteNoAuth()) return
    let cancelled = false
    ensureNoAuthDevSession()
      .then((r) => {
        if (!cancelled) {
          setRole(r as Role)
          setNoAuthBootstrapError(null)
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setNoAuthBootstrapError(
            e instanceof Error ? e.message : 'NO_AUTH auto-login failed',
          )
        }
      })
      .finally(() => {
        if (!cancelled) setNoAuthBootstrapping(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (noAuthBootstrapping) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-600">
        Signing in…
      </div>
    )
  }

  if (noAuthBootstrapError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-red-600 font-medium">Dev auto-login failed</p>
        <p className="text-sm text-gray-600 max-w-md">{noAuthBootstrapError}</p>
        <p className="text-xs text-gray-500">
          Ensure the API is running, <code className="bg-gray-100 px-1">npx prisma db seed</code> has
          been run, and JWT secrets are set on the server. For ngrok use{' '}
          <code className="bg-gray-100 px-1">npm run dev -- --ngrok --no-auth</code>.
        </p>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <AppRoutes role={role} onLogin={setRole} onLogout={() => setRole(null)} />
    </BrowserRouter>
  )
}

interface RoutesProps {
  role: Role | null
  onLogin: (role: Role) => void
  onLogout: () => void
}

function AppRoutes({ role, onLogin, onLogout }: RoutesProps) {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (role && location.pathname.startsWith('/dashboard')) {
      const href = location.pathname + location.search
      localStorage.setItem('lastPath', location.pathname)
      localStorage.setItem('lastDashboardHref', href)
    }
  }, [role, location.pathname, location.search])

  const dashboardEntryPath = (() => {
    if (!role) return '/dashboard'
    try {
      const href = localStorage.getItem('lastDashboardHref')
      if (href && href.startsWith('/dashboard')) return href
    } catch {
      /* ignore */
    }
    return '/dashboard'
  })()

  return (
    <Routes>
      <Route
        path="/"
        element={role ? <Navigate to={dashboardEntryPath} replace /> : <Login onLogin={onLogin} />}
      />
      <Route
        path="/dashboard/*"
        element={
          role ? (
            <Dashboard
              role={role}
              onLogout={onLogout}
              onSwitchRole={(r, userName, devUserId) => {
                localStorage.setItem('role', r)
                if (devUserId != null && isViteNoAuth()) {
                  localStorage.setItem('userId', String(devUserId))
                  if (userName != null) {
                    localStorage.setItem('userName', userName)
                  }
                  localStorage.setItem('loginMethod', 'dev')
                  localStorage.removeItem(API_ACCESS_TOKEN_KEY)
                } else if (userName != null) {
                  localStorage.setItem('userName', userName)
                  localStorage.setItem('loginMethod', 'password')
                  if (r === 'EMPLOYEE') {
                    localStorage.removeItem('userId')
                  }
                }
                onLogin(r)
                if (r === 'EMPLOYEE') {
                  localStorage.setItem('lastPath', '/dashboard')
                  navigate('/dashboard')
                }
              }}
            />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />
    </Routes>
  )
}

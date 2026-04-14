import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import Login from './Landing/components/Login'
import Dashboard from './Landing/Dashboard'
import { applyNoAuthDevSession, isViteNoAuth } from './devNoAuth'

type Role = 'ADMIN' | 'OWNER' | 'EMPLOYEE'

export default function App() {
  const [role, setRole] = useState<Role | null>(() => {
    if (isViteNoAuth()) {
      return applyNoAuthDevSession() as Role
    }
    
    // Check if user was signed out
    const signedOut = localStorage.getItem('signedOut') === 'true'
    if (signedOut) {
      // Clear sign out flag and don't restore role
      localStorage.removeItem('signedOut')
      return null
    }
    
    const stored = localStorage.getItem('role')
    return stored === 'ADMIN' || stored === 'OWNER' || stored === 'EMPLOYEE'
      ? (stored as Role) 
      : null
  })

  useEffect(() => {
    if (isViteNoAuth()) {
      setRole(applyNoAuthDevSession() as Role)
    }
  }, [])
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

  // Persist current path + query (used to recover deep links when a reload lands on `/` or `/dashboard`)
  useEffect(() => {
    if (role && location.pathname.startsWith('/dashboard')) {
      const href = location.pathname + location.search
      localStorage.setItem('lastPath', location.pathname)
      localStorage.setItem('lastDashboardHref', href)
    }
  }, [role, location.pathname, location.search])

  // No dedicated redirect effect is needed when role is restored because
  // the '/' route conditionally navigates to the dashboard.

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

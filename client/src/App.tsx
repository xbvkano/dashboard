import { useState, useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import Login from './Landing/components/Login'
import Dashboard from './Landing/Dashboard'

type Role = 'ADMIN' | 'OWNER' | 'EMPLOYEE'

export default function App() {
  const [role, setRole] = useState<Role | null>(() => {
    const noAuth =
      import.meta.env.VITE_NO_AUTH === 'true' ||
      import.meta.env.VITE_NO_AUTH === '1'
    if (noAuth) {
      localStorage.setItem('role', 'OWNER')
      return 'OWNER'
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
    const noAuth =
      import.meta.env.VITE_NO_AUTH === 'true' ||
      import.meta.env.VITE_NO_AUTH === '1'
    if (noAuth) {
      setRole('OWNER')
      localStorage.setItem('role', 'OWNER')
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
  const hasRestoredRef = useRef(false)

  // Restore last visited path only once per session when at dashboard index (avoids redirect after opening modal etc.)
  useEffect(() => {
    if (!role || location.pathname !== '/dashboard' || hasRestoredRef.current) return
    hasRestoredRef.current = true
    const last = localStorage.getItem('lastPath')
    if (last && last !== '/dashboard' && last.startsWith('/dashboard')) {
      navigate(last, { replace: true })
    }
  }, [role, location.pathname, navigate])

  // Persist current path (do not overwrite when a modal is open – we only persist the real route)
  useEffect(() => {
    if (role && location.pathname.startsWith('/dashboard')) {
      localStorage.setItem('lastPath', location.pathname)
    }
  }, [role, location.pathname])

  // No dedicated redirect effect is needed when role is restored because
  // the '/' route conditionally navigates to the dashboard.

  return (
    <Routes>
      <Route
        path="/"
        element={role ? <Navigate to="/dashboard" replace /> : <Login onLogin={onLogin} />}
      />
      <Route
        path="/dashboard/*"
        element={
          role ? (
            <Dashboard
              role={role}
              onLogout={onLogout}
              onSwitchRole={(r, userName) => {
                localStorage.setItem('role', r)
                if (userName != null) {
                  localStorage.setItem('userName', userName)
                  localStorage.setItem('loginMethod', 'password')
                }
                onLogin(r)
                if (r === 'EMPLOYEE') navigate('/dashboard')
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

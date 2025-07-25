import { useState, useEffect } from 'react'
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

  // Restore last visited path so modals reopen after refresh
  useEffect(() => {
    if (role) {
      const last = localStorage.getItem('lastPath')
      if (last && last !== location.pathname) {
        navigate(last, { replace: true })
      }
    }
    // only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persist current path
  useEffect(() => {
    if (role) {
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
        element={role ? <Dashboard role={role} onLogout={onLogout} /> : <Navigate to="/" replace />}
      />
    </Routes>
  )
}

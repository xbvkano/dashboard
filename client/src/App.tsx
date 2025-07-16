import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import Login from './Landing/components/Login'
import Dashboard from './Landing/Dashboard'

type Role = 'ADMIN' | 'OWNER' | 'EMPLOYEE'

export default function App() {
  const [role, setRole] = useState<Role | null>(() => {
    const stored = localStorage.getItem('role')
    return stored === 'ADMIN' || stored === 'OWNER' || stored === 'EMPLOYEE'
      ? (stored as Role)
      : null
  })
  return (
    <BrowserRouter>
      <AppRoutes role={role} onLogin={setRole} />
    </BrowserRouter>
  )
}

interface RoutesProps {
  role: Role | null
  onLogin: (role: Role) => void
}

function AppRoutes({ role, onLogin }: RoutesProps) {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (role && location.pathname === '/') {
      navigate('/dashboard', { replace: true })
    }
  }, [role, navigate, location.pathname])

  return (
    <Routes>
      <Route path="/" element={<Login onLogin={onLogin} />} />
      <Route
        path="/dashboard/*"
        element={role ? <Dashboard role={role} /> : <Navigate to="/" replace />}
      />
    </Routes>
  )
}

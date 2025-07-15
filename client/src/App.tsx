import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import Login from './Landing/components/Login'
import Dashboard from './Landing/Dashboard'

type Role = 'admin' | 'user'

export default function App() {
  const [role, setRole] = useState<Role | null>(() => {
    const stored = localStorage.getItem('role')
    return stored === 'admin' || stored === 'user' ? (stored as Role) : null
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

  useEffect(() => {
    if (role) {
      navigate('/dashboard', { replace: true })
    }
  }, [role, navigate])

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

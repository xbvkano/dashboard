import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './Login'
import Dashboard from './Landing/Dashboard'

type Role = 'admin' | 'user'

export default function App() {
  const [role, setRole] = useState<Role | null>(null)

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login onLogin={setRole} />} />
        <Route
          path="/dashboard"
          element={role ? <Dashboard role={role} /> : <Navigate to="/" />}
        />
      </Routes>
    </BrowserRouter>
  )
}

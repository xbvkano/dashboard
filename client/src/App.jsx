import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './Login'
import Dashboard from './Dashboard'

export default function App() {
  const [role, setRole] = useState(null)

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

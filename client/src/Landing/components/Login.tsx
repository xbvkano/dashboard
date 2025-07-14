import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { GoogleLogin, CredentialResponse } from '@react-oauth/google'

type Role = 'admin' | 'user'

interface LoginProps {
  onLogin: (role: Role) => void
}

export default function Login({ onLogin }: LoginProps) {
  const navigate = useNavigate()

  useEffect(() => {
    const stored = localStorage.getItem('role')
    if (stored === 'admin' || stored === 'user') {
      onLogin(stored as Role)
      navigate('/dashboard')
    }
  }, [])

  const handleGoogle = async (res: CredentialResponse) => {
    if (!res.credential) return
    const response = await fetch('http://localhost:3000/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: res.credential })
    })
    const data = await response.json()
    if (data.role) {
      onLogin(data.role as Role)
      localStorage.setItem('role', data.role)
      navigate('/dashboard')
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-gray-100 text-gray-900">
      <h1 className="text-2xl font-bold">Login</h1>
      <GoogleLogin
        onSuccess={handleGoogle}
        ux_mode="redirect"
        login_uri={window.location.origin}
      />
    </div>
  )
}

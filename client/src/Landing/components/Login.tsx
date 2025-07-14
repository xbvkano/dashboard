import { useNavigate } from 'react-router-dom'
import { GoogleLogin, CredentialResponse } from '@react-oauth/google'

type Role = 'admin' | 'user'

interface LoginProps {
  onLogin: (role: Role) => void
}

export default function Login({ onLogin }: LoginProps) {
  const navigate = useNavigate()
  const handleLogin = (role: Role) => {
    onLogin(role)
    navigate('/dashboard')
  }

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
      navigate('/dashboard')
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <h1 className="text-2xl font-bold">Login</h1>
      <div className="flex gap-4">
        <button className="px-4 py-2 bg-blue-500 text-white rounded" onClick={() => handleLogin('admin')}>
          Admin
        </button>
        <button className="px-4 py-2 bg-green-500 text-white rounded" onClick={() => handleLogin('user')}>
          User
        </button>
      </div>
      <GoogleLogin onSuccess={handleGoogle} />
    </div>
  )
}

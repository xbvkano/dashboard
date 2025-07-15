import { useEffect } from 'react'
import { useGoogleLogin, CodeResponse } from '@react-oauth/google'

type Role = 'admin' | 'user'

interface LoginProps {
  onLogin: (role: Role) => void
}

export default function Login({ onLogin }: LoginProps) {

  useEffect(() => {
    const stored = localStorage.getItem('role')
    if (stored === 'admin' || stored === 'user') {
      onLogin(stored as Role)
      return
    }

    async function handleRedirect() {
      const searchParams = new URLSearchParams(window.location.search)
      const code = searchParams.get('code')
      if (!code) return

      const response = await fetch('http://localhost:3000/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      })
      const data = await response.json()
      if (data.role) {
        onLogin(data.role as Role)
        localStorage.setItem('role', data.role)
      }

      searchParams.delete('code')
      const newUrl = `${window.location.pathname}${searchParams.toString() ? '?' + searchParams.toString() : ''}`
      window.history.replaceState({}, '', newUrl)
    }

    handleRedirect()
  }, [onLogin])

  const login = useGoogleLogin({
    ux_mode: 'redirect',
    redirect_uri: window.location.origin,
    flow: 'auth-code',
    onSuccess: async (res: CodeResponse) => {
      const response = await fetch('http://localhost:3000/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: res.code })
      })
      const data = await response.json()
      if (data.role) {
        onLogin(data.role as Role)
        localStorage.setItem('role', data.role)
      }
    },
    onError: () => {
      console.error('Login Failed')
    },
  })

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-gray-100 text-gray-900">
      <h1 className="text-2xl font-bold">Login</h1>
      <button
        onClick={() => login()}
        className="px-4 py-2 bg-blue-600 text-white rounded"
      >
        Sign in with Google
      </button>
    </div>
  )
}

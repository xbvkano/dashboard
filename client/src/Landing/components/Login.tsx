import { useEffect, useState } from 'react'
import { useGoogleLogin, CodeResponse } from '@react-oauth/google'
import { API_BASE_URL } from '../../api'

type Role = 'ADMIN' | 'OWNER' | 'EMPLOYEE'

interface LoginProps {
  onLogin: (role: Role) => void
}

export default function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  console.log("This iwndow: " + window.location.origin)
  console.log("This is the API base: " + API_BASE_URL)
  useEffect(() => {
    // Check if user was signed out
    const signedOut = localStorage.getItem('signedOut') === 'true'
    if (signedOut) {
      // Clear sign out flag and all auth data, don't auto-login
      localStorage.removeItem('signedOut')
      localStorage.removeItem('role')
      localStorage.removeItem('safe')
      localStorage.removeItem('userName')
      localStorage.removeItem('loginMethod')
      return
    }

    const stored = localStorage.getItem('role')
    const loginMethod = localStorage.getItem('loginMethod') // 'password' or 'google'
    const searchParams = new URLSearchParams(window.location.search)
    const hasGoogleCode = searchParams.get('code')
    
    // If there's a stored role and login method is password, auto-login (ignore Google code)
    if (stored === 'ADMIN' || stored === 'OWNER' || stored === 'EMPLOYEE') {
      if (loginMethod === 'password') {
        // Password login takes precedence - auto-login and ignore Google redirect
        onLogin(stored as Role)
        // Clean up any Google code from URL
        if (hasGoogleCode) {
          searchParams.delete('code')
          const newUrl = `${window.location.pathname}${searchParams.toString() ? '?' + searchParams.toString() : ''}`
          window.history.replaceState({}, '', newUrl)
        }
        return
      }
      // If login method is Google or not set, and there's a Google code, handle it
      if (hasGoogleCode) {
        // Handle Google redirect (might be switching accounts or first time)
      } else {
        // No Google code, just auto-login with stored role
        onLogin(stored as Role)
        return
      }
    }

    // Only check for Google OAuth redirect if no stored role OR if there's a code in URL
    async function handleRedirect() {
      const code = searchParams.get('code')
      if (!code) return

      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', "ngrok-skip-browser-warning": "1" },
        body: JSON.stringify({ code })
      })
      const data = await response.json()
      if (data.role) {
        onLogin(data.role as Role)
        localStorage.setItem('role', data.role)
        localStorage.setItem('loginMethod', 'google')
        if (data.user && typeof data.user.safe !== 'undefined') {
          localStorage.setItem('safe', data.user.safe ? 'true' : 'false')
        }
        if (data.userName) {
          localStorage.setItem('userName', data.userName)
        } else if (data.user?.userName) {
          localStorage.setItem('userName', data.user.userName)
        }
      }

      searchParams.delete('code')
      const newUrl = `${window.location.pathname}${searchParams.toString() ? '?' + searchParams.toString() : ''}`
      window.history.replaceState({}, '', newUrl)
    }

    handleRedirect()
  }, [onLogin])

  const me = window.location.origin.endsWith('/')
  ? window.location.origin
  : window.location.origin + '/'

  console.log("me: " + me)

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', "ngrok-skip-browser-warning": "1" },
        body: JSON.stringify({ userName: username, password })
      })

      const data = await response.json()
      
      if (!response.ok) {
        setError(data.error || 'Login failed')
        setLoading(false)
        return
      }

      if (data.role) {
        onLogin(data.role as Role)
        localStorage.setItem('role', data.role)
        localStorage.setItem('loginMethod', 'password')
        if (data.user && typeof data.user.safe !== 'undefined') {
          localStorage.setItem('safe', data.user.safe ? 'true' : 'false')
        }
        if (data.userName) {
          localStorage.setItem('userName', data.userName)
        }
        setLoading(false)
      }
    } catch (err) {
      setError('Login failed. Please try again.')
      setLoading(false)
    }
  }

  const login = useGoogleLogin({
    ux_mode: 'redirect',
    redirect_uri: me,
    flow: 'auth-code',
    onSuccess: async (res: CodeResponse) => {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', "ngrok-skip-browser-warning": "1" },
        body: JSON.stringify({ code: res.code })
      })
      const data = await response.json()
      if (data.role) {
        onLogin(data.role as Role)
        localStorage.setItem('role', data.role)
        if (data.user && typeof data.user.safe !== 'undefined') {
          localStorage.setItem('safe', data.user.safe ? 'true' : 'false')
        }
        if (data.userName) {
          localStorage.setItem('userName', data.userName)
        }
      }
    },
    onError: () => {
      console.error('Login Failed')
    },
  })

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 bg-gray-100 text-gray-900 p-4">
      <h1 className="text-2xl font-bold">Login</h1>
      
      <form onSubmit={handlePasswordLogin} className="w-full max-w-sm space-y-4">
        <div>
          <label htmlFor="username" className="block text-sm font-medium mb-1">
            Username
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter your username"
          />
        </div>
        
        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-1">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter your password"
          />
        </div>

        {error && (
          <div className="text-red-600 text-sm">{error}</div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>

      <div className="w-full max-w-sm">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-gray-100 text-gray-500">Or</span>
          </div>
        </div>
      </div>

      <button
        onClick={() => login()}
        className="w-full max-w-sm px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded hover:bg-gray-50 flex items-center justify-center gap-2"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Sign in with Google
      </button>
    </div>
  )
}

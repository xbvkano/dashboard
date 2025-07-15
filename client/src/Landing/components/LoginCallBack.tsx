// src/pages/LoginCallback.tsx
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_BASE_URL } from '../../api'

export default function LoginCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const credential = params.get('credential')

    if (!credential) {
      console.error('Missing credential in callback')
      navigate('/')
      return
    }

    const login = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', "ngrok-skip-browser-warning": "1" },
          body: JSON.stringify({ token: credential }),
        })

        const data = await response.json()
        if (data.role === 'admin' || data.role === 'user') {
          localStorage.setItem('role', data.role)
          navigate('/dashboard')
        } else {
          navigate('/')
        }
      } catch (err) {
        console.error('Login error:', err)
        navigate('/')
      }
    }

    login()
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p>Processing login...</p>
    </div>
  )
}

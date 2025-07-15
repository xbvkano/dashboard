// src/pages/LoginCallback.tsx
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

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
        const response = await fetch('http://localhost:3000/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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

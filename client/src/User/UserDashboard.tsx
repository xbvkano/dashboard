import { useNavigate } from 'react-router-dom'

interface Props {
  onLogout: () => void
}

export default function UserDashboard({ onLogout }: Props) {
  const navigate = useNavigate()
  const isSafe = localStorage.getItem('safe') === 'true'
  const signOut = () => {
    localStorage.removeItem('role')
    localStorage.removeItem('safe')
    localStorage.removeItem('userName')
    localStorage.removeItem('loginMethod')
    localStorage.setItem('signedOut', 'true')
    onLogout()
    navigate('/')
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">User Dashboard</h2>
        {!isSafe && (
          <button className="px-2 py-1" onClick={signOut}>
            Sign Out
          </button>
        )}
      </div>
      <p>Welcome, user!</p>
    </div>
  )
}

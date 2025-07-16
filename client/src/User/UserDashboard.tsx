import { useNavigate } from 'react-router-dom'

export default function UserDashboard() {
  const navigate = useNavigate()
  const signOut = () => {
    localStorage.removeItem('role')
    navigate('/')
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">User Dashboard</h2>
        <button className="px-2 py-1" onClick={signOut}>Sign Out</button>
      </div>
      <p>Welcome, user!</p>
    </div>
  )
}

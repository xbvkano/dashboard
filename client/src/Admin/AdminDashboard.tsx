import { Link, Routes, Route, useNavigate } from 'react-router-dom'
import Home from './pages/Home'
import Calendar from './pages/Calendar'
import Clients from './pages/Clients'
import Employees from './pages/Employees'
import Financing from './pages/Financing'

interface Props {
  onLogout: () => void
}

export default function AdminDashboard({ onLogout }: Props) {
  const navigate = useNavigate()
  const isSafe = localStorage.getItem('safe') === 'true'
  const signOut = () => {
    localStorage.removeItem('role')
    localStorage.removeItem('safe')
    onLogout()
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900">
      <nav className="bg-white shadow fixed bottom-0 md:sticky md:top-0 w-full z-50 md:mb-4">
        <ul className="flex flex-wrap justify-around p-2 text-sm">
          <li><Link className="px-2 py-1" to="/dashboard">Home</Link></li>
          <li><Link className="px-2 py-1" to="/dashboard/calendar">Calendar</Link></li>
          <li><Link className="px-2 py-1" to="/dashboard/clients">Clients</Link></li>
          <li><Link className="px-2 py-1" to="/dashboard/employees">Employees</Link></li>
          <li><Link className="px-2 py-1" to="/dashboard/financing">Financing</Link></li>
          {!isSafe && (
            <li>
              <button className="px-2 py-1" onClick={signOut}>
                Sign Out
              </button>
            </li>
          )}
        </ul>
      </nav>
      <main className="flex-1 pb-16 md:pb-0">
        <Routes>
          <Route index element={<Home />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="clients/*" element={<Clients />} />
          <Route path="employees/*" element={<Employees />} />
          <Route path="financing/*" element={<Financing />} />
        </Routes>
      </main>
    </div>
  )
}

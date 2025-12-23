import { Link, Routes, Route, useNavigate, Outlet } from 'react-router-dom'
import Schedule from './pages/Schedule'

interface Props {
  onLogout: () => void
}

function EmployeeLayout({ onLogout }: Props) {
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
    <div className="min-h-screen bg-gray-100 text-gray-900">
      <nav className="bg-white shadow fixed bottom-0 md:sticky md:top-0 w-full z-50 md:mb-4">
        <ul className="flex flex-wrap justify-around p-2 text-sm">
          <li>
            <Link className="px-2 py-1" to="/dashboard/schedule">
              Schedule
            </Link>
          </li>
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
        <Outlet />
      </main>
    </div>
  )
}

export default function EmployeeDashboard({ onLogout }: Props) {
  return (
    <Routes>
      <Route element={<EmployeeLayout onLogout={onLogout} />}>
        <Route index element={<Schedule />} />
        <Route path="schedule" element={<Schedule />} />
      </Route>
    </Routes>
  )
}


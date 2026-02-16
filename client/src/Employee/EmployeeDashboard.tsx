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
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <nav className="bg-white shadow-sm fixed bottom-0 left-0 right-0 md:sticky md:top-0 w-full z-50 md:mb-0 border-t md:border-t-0 md:border-b border-slate-200">
        <ul className="flex justify-around items-center p-3 max-w-lg mx-auto md:justify-start md:gap-6 md:px-6 md:py-3">
          <li>
            <Link
              className="px-4 py-2 rounded-lg font-medium text-slate-700 hover:bg-slate-100 active:bg-slate-200 transition-colors"
              to="/dashboard/schedule"
            >
              Schedule
            </Link>
          </li>
          {!isSafe && (
            <li>
              <button
                className="px-4 py-2 rounded-lg font-medium text-slate-600 hover:bg-slate-100 active:bg-slate-200 transition-colors"
                onClick={signOut}
              >
                Sign Out
              </button>
            </li>
          )}
        </ul>
      </nav>
      <main className="flex-1 pb-24 md:pb-8 pt-4 md:pt-6 px-4 md:px-6 max-w-2xl mx-auto">
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


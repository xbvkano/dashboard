import { Link, Routes, Route, useNavigate, Outlet } from 'react-router-dom'
import { isDevToolsEnabled } from '../devTools'
import Schedule from './pages/Schedule'
import UpcomingJobs from './pages/UpcomingJobs'

type Role = 'ADMIN' | 'OWNER' | 'EMPLOYEE'

interface Props {
  onLogout: () => void
  onSwitchRole?: (role: Role, userName?: string) => void
}

function EmployeeLayout({ onLogout, onSwitchRole }: Props) {
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

  const switchToAdmin = () => {
    if (!onSwitchRole) return
    localStorage.setItem('role', 'OWNER')
    localStorage.removeItem('userName')
    localStorage.setItem('loginMethod', 'google')
    onSwitchRole('OWNER')
    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <nav className="bg-white shadow-sm fixed bottom-0 left-0 right-0 md:sticky md:top-0 w-full z-50 md:mb-0 border-t md:border-t-0 md:border-b border-slate-200">
        <ul className="flex flex-wrap justify-center md:justify-start items-center gap-2 p-3 max-w-lg mx-auto md:gap-4 md:px-6 md:py-3">
          <li>
            <Link
              className="inline-flex items-center justify-center min-h-[44px] px-4 py-2.5 rounded-lg font-medium text-slate-700 hover:bg-slate-100 active:bg-slate-200 transition-colors text-sm sm:text-base whitespace-nowrap"
              to="/dashboard/schedule"
            >
              Schedule
            </Link>
          </li>
          <li>
            <Link
              className="inline-flex items-center justify-center min-h-[44px] px-4 py-2.5 rounded-lg font-medium text-slate-700 hover:bg-slate-100 active:bg-slate-200 transition-colors text-sm sm:text-base whitespace-nowrap"
              to="/dashboard/jobs"
            >
              <span className="sm:hidden">Jobs</span>
              <span className="hidden sm:inline">Upcoming Jobs</span>
            </Link>
          </li>
          {isDevToolsEnabled && onSwitchRole && (
            <li>
              <button
                type="button"
                className="inline-flex items-center justify-center min-h-[44px] px-4 py-2.5 rounded-lg font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 transition-colors text-sm sm:text-base whitespace-nowrap"
                onClick={switchToAdmin}
              >
                Dev Tools
              </button>
            </li>
          )}
          {!isSafe && (
            <li>
              <button
                className="inline-flex items-center justify-center min-h-[44px] px-4 py-2.5 rounded-lg font-medium text-slate-600 hover:bg-slate-100 active:bg-slate-200 transition-colors text-sm sm:text-base whitespace-nowrap"
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

export default function EmployeeDashboard({ onLogout, onSwitchRole }: Props) {
  return (
    <Routes>
      <Route element={<EmployeeLayout onLogout={onLogout} onSwitchRole={onSwitchRole} />}>
        <Route index element={<Schedule />} />
        <Route path="schedule" element={<Schedule />} />
        <Route path="jobs" element={<UpcomingJobs />} />
      </Route>
    </Routes>
  )
}


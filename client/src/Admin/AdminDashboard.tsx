import { Link, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { isDevToolsEnabled } from '../devTools'
import Home from './pages/Home'
import Calendar from './pages/Calendar'
import Contacts from './pages/Contacts'
import Messages from './pages/Messages'
import Financing from './pages/Financing'
import Recurring from './pages/Recurring'
import DevTools from './pages/DevTools'
import Account from './pages/Account'

type Role = 'ADMIN' | 'OWNER' | 'EMPLOYEE'

interface Props {
  onLogout: () => void
  onSwitchRole?: (role: Role, userName?: string, devUserId?: number) => void
}

function IconHome({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )
}

function IconCalendar({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
}

function IconChat({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  )
}

function IconUsers({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  )
}

function IconCurrency({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function IconWrench({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function IconUserCircle({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

const navLinkClass =
  'flex flex-col md:flex-row items-center justify-center gap-0.5 md:gap-1.5 min-h-[44px] md:min-h-0 px-1.5 md:px-2 py-1.5 rounded-lg text-blue-700 hover:bg-blue-50 md:text-gray-700 md:hover:bg-gray-50'

function LegacyAccountsToContactsRedirect() {
  const location = useLocation()
  const to =
    location.pathname.replace('/dashboard/accounts', '/dashboard/contacts') +
    location.search +
    location.hash
  return <Navigate to={to} replace />
}

export default function AdminDashboard({ onLogout, onSwitchRole }: Props) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-gray-100 text-gray-900">
      <nav className="z-50 w-full shrink-0 bg-white shadow fixed bottom-0 md:sticky md:top-0 border-t border-gray-200 md:border-t-0 md:border-b">
        <ul className="flex flex-nowrap justify-around md:justify-start md:flex-wrap md:gap-1 p-1 md:p-2 text-sm">
          <li className="min-w-0 flex-1 md:flex-none">
            <Link className={navLinkClass} to="/dashboard" aria-label="Home" title="Home">
              <IconHome className="w-6 h-6 md:w-5 md:h-5 shrink-0" />
              <span className="hidden md:inline text-sm">Home</span>
            </Link>
          </li>
          <li className="min-w-0 flex-1 md:flex-none">
            <Link className={navLinkClass} to="/dashboard/calendar" aria-label="Calendar" title="Calendar">
              <IconCalendar className="w-6 h-6 md:w-5 md:h-5 shrink-0" />
              <span className="hidden md:inline text-sm">Calendar</span>
            </Link>
          </li>
          <li className="min-w-0 flex-1 md:flex-none">
            <Link className={navLinkClass} to="/dashboard/messages" aria-label="Messages" title="Messages">
              <IconChat className="w-6 h-6 md:w-5 md:h-5 shrink-0" />
              <span className="hidden md:inline text-sm">Messages</span>
            </Link>
          </li>
          <li className="min-w-0 flex-1 md:flex-none">
            <Link className={navLinkClass} to="/dashboard/contacts" aria-label="Contacts" title="Contacts">
              <IconUsers className="w-6 h-6 md:w-5 md:h-5 shrink-0" />
              <span className="hidden md:inline text-sm">Contacts</span>
            </Link>
          </li>
          <li className="min-w-0 flex-1 md:flex-none">
            <Link className={navLinkClass} to="/dashboard/financing" aria-label="Financing" title="Financing">
              <IconCurrency className="w-6 h-6 md:w-5 md:h-5 shrink-0" />
              <span className="hidden md:inline text-sm">Financing</span>
            </Link>
          </li>
          {isDevToolsEnabled && (
            <li className="min-w-0 flex-1 md:flex-none">
              <Link className={navLinkClass} to="/dashboard/devtools" aria-label="DevTools" title="DevTools">
                <IconWrench className="w-6 h-6 md:w-5 md:h-5 shrink-0" />
                <span className="hidden md:inline text-sm">DevTools</span>
              </Link>
            </li>
          )}
          <li className="min-w-0 flex-1 md:flex-none">
            <Link className={navLinkClass} to="/dashboard/account" aria-label="Account" title="Account">
              <IconUserCircle className="w-6 h-6 md:w-5 md:h-5 shrink-0" />
              <span className="hidden md:inline text-sm">Account</span>
            </Link>
          </li>
        </ul>
      </nav>
      <main className="flex min-h-0 flex-1 flex-col pb-[4.25rem] md:pb-0">
        <Routes>
          <Route index element={<Home />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="contacts/*" element={<Contacts />} />
          <Route path="accounts/*" element={<LegacyAccountsToContactsRedirect />} />
          <Route path="messages/*" element={<Messages />} />
          <Route path="financing/*" element={<Financing />} />
          <Route path="recurring/*" element={<Recurring />} />
          <Route path="account" element={<Account onLogout={onLogout} />} />
          {isDevToolsEnabled && (
            <Route path="devtools" element={<DevTools onSwitchRole={onSwitchRole} />} />
          )}
        </Routes>
      </main>
    </div>
  )
}

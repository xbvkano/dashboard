import { createPortal } from 'react-dom'
import { useState, useRef, useEffect } from 'react'
import { Link, Routes, Route, useNavigate, Outlet } from 'react-router-dom'
import { isDevToolsEnabled } from '../devTools'
import { EmployeeLanguageProvider, useEmployeeLanguage, type EmployeeLanguage } from './EmployeeLanguageContext'
import Schedule from './pages/Schedule'
import UpcomingJobs from './pages/UpcomingJobs'

type Role = 'ADMIN' | 'OWNER' | 'EMPLOYEE'

interface Props {
  onLogout: () => void
  onSwitchRole?: (role: Role, userName?: string) => void
}

function LanguageSelector() {
  const { language, setLanguage, t } = useEmployeeLanguage()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [open])

  const options: { lang: EmployeeLanguage; label: string }[] = [
    { lang: 'en', label: t.languageEnglish },
    { lang: 'pt', label: t.languagePortuguese },
    { lang: 'es', label: t.languageSpanish },
  ]
  const currentLabel = options.find(o => o.lang === language)?.label ?? t.languageEnglish

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="inline-flex items-center justify-center min-h-[44px] px-3 py-2.5 rounded-lg font-medium text-slate-700 hover:bg-slate-100 active:bg-slate-200 transition-colors text-sm sm:text-base"
        title={t.languageName}
        aria-label={t.languageName}
      >
        <span className="w-5 h-5 flex items-center justify-center text-slate-500" aria-hidden>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
            <path d="M5 8l6 6" />
            <path d="M4 14l6-6 2-3" />
            <path d="M2 5h12" />
            <path d="M7 2h1" />
            <path d="M22 22l-5-10-5 10" />
            <path d="M14 18l6-6 2 2" />
          </svg>
        </span>
        <span className="ml-1.5 hidden sm:inline">{currentLabel}</span>
      </button>
      {open && (
        <div className="absolute right-0 bottom-full mb-1 sm:bottom-auto sm:top-full sm:mt-1 w-40 py-1 bg-white rounded-lg shadow-lg border border-slate-200 z-50">
          {options.map(({ lang, label }) => (
            <button
              key={lang}
              type="button"
              onClick={() => { setLanguage(lang); setOpen(false) }}
              className={`w-full text-left px-3 py-2 text-sm font-medium transition-colors ${language === lang ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function EmployeeLayout({ onLogout, onSwitchRole }: Props) {
  const navigate = useNavigate()
  const { t } = useEmployeeLanguage()
  const isSafe = localStorage.getItem('safe') === 'true'
  const [showSignOutModal, setShowSignOutModal] = useState(false)

  const signOut = () => {
    setShowSignOutModal(false)
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
        <ul className="flex flex-nowrap justify-center items-center gap-2 p-3 w-full md:gap-4 md:px-6 md:py-3">
          <li>
            <Link
              className="inline-flex items-center justify-center min-h-[44px] px-4 py-2.5 rounded-lg font-medium text-slate-700 hover:bg-slate-100 active:bg-slate-200 transition-colors text-sm sm:text-base whitespace-nowrap"
              to="/dashboard/schedule"
            >
              {t.navSchedule}
            </Link>
          </li>
          <li>
            <Link
              className="inline-flex items-center justify-center min-h-[44px] px-4 py-2.5 rounded-lg font-medium text-slate-700 hover:bg-slate-100 active:bg-slate-200 transition-colors text-sm sm:text-base whitespace-nowrap"
              to="/dashboard/jobs"
            >
              <span className="sm:hidden">{t.navJobs}</span>
              <span className="hidden sm:inline">{t.navUpcomingJobs}</span>
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
          <li>
            <LanguageSelector />
          </li>
          {!isSafe && (
            <li>
              <button
                type="button"
                className="inline-flex items-center justify-center min-h-[44px] px-4 py-2.5 rounded-lg font-medium text-slate-600 hover:bg-slate-100 active:bg-slate-200 transition-colors text-sm sm:text-base whitespace-nowrap"
                onClick={() => setShowSignOutModal(true)}
              >
                {t.navSignOut}
              </button>
            </li>
          )}
        </ul>
      </nav>
      <main className="flex-1 pb-24 md:pb-8 pt-4 md:pt-6 px-4 md:px-6 max-w-2xl mx-auto">
        <Outlet />
      </main>

      {/* Sign out confirmation modal - centered on all screen sizes */}
      {showSignOutModal &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 modal-safe-area"
            onClick={() => setShowSignOutModal(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="signout-modal-title"
          >
            <div
              className="bg-white w-full max-w-md rounded-2xl shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 sm:p-6">
                <h3 id="signout-modal-title" className="text-lg font-semibold text-slate-800 mb-3">
                  {t.navSignOut}
                </h3>
                <p className="text-sm text-slate-600 mb-5">{t.navSignOutConfirm}</p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowSignOutModal(false)}
                    className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 active:bg-slate-100 transition-colors"
                  >
                    {t.cancel}
                  </button>
                  <button
                    type="button"
                    onClick={signOut}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-slate-600 text-white font-semibold hover:bg-slate-700 active:bg-slate-800 transition-colors"
                  >
                    {t.navSignOut}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}

export default function EmployeeDashboard({ onLogout, onSwitchRole }: Props) {
  return (
    <EmployeeLanguageProvider>
      <Routes>
        <Route element={<EmployeeLayout onLogout={onLogout} onSwitchRole={onSwitchRole} />}>
          <Route index element={<Schedule />} />
          <Route path="schedule" element={<Schedule />} />
          <Route path="jobs" element={<UpcomingJobs />} />
        </Route>
      </Routes>
    </EmployeeLanguageProvider>
  )
}


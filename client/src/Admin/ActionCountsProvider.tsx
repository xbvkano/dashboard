import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'
import {
  EMPTY_ACTION_COUNTS,
  actionCountNotification,
  type ActionCounts,
} from './actionCounts'
import { fetchActionCounts } from './actionCountsApi'
import { isDashboardInBackground, showDesktopNotification } from './desktopNotification'

const POLL_MS = 15_000

type RefreshOptions = { notify?: 'auto' | 'always' }

type Ctx = {
  counts: ActionCounts
  refresh: (opts?: RefreshOptions) => Promise<ActionCounts>
}

const ActionCountsContext = createContext<Ctx | null>(null)

function requestNotificationPermission(): void {
  if (typeof Notification === 'undefined') return
  if (Notification.permission !== 'default') return
  void Notification.requestPermission()
}

export function ActionCountsProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const [counts, setCounts] = useState<ActionCounts>(EMPTY_ACTION_COUNTS)
  const countsRef = useRef(counts)
  const baselineSetRef = useRef(false)
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate
  countsRef.current = counts

  const applyCounts = useCallback((next: ActionCounts, notify: 'auto' | 'always' = 'auto') => {
    const previous = baselineSetRef.current ? countsRef.current : null
    const tabHidden = notify === 'always' || isDashboardInBackground()
    const note = actionCountNotification({
      previous,
      next,
      tabHidden,
    })
    baselineSetRef.current = true
    countsRef.current = next
    setCounts(next)
    if (note) showDesktopNotification(note, (to) => navigateRef.current(to))
  }, [])

  const refresh = useCallback(
    async (opts?: RefreshOptions) => {
      const next = await fetchActionCounts()
      applyCounts(next, opts?.notify ?? 'auto')
      return next
    },
    [applyCounts],
  )

  useEffect(() => {
    let cancelled = false
    const load = () => {
      fetchActionCounts()
        .then((next) => {
          if (!cancelled) applyCounts(next, 'auto')
        })
        .catch(() => {
          /* keep last counts */
        })
    }
    load()
    const interval = window.setInterval(load, POLL_MS)
    requestNotificationPermission()
    const onClick = () => requestNotificationPermission()
    document.addEventListener('click', onClick, { once: true })
    return () => {
      cancelled = true
      window.clearInterval(interval)
      document.removeEventListener('click', onClick)
    }
  }, [applyCounts])

  const value = useMemo<Ctx>(() => ({ counts, refresh }), [counts, refresh])

  return <ActionCountsContext.Provider value={value}>{children}</ActionCountsContext.Provider>
}

export function useActionCounts(): Ctx {
  const ctx = useContext(ActionCountsContext)
  if (!ctx) throw new Error('useActionCounts must be used within ActionCountsProvider')
  return ctx
}

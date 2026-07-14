import { useState, useEffect } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import type { Appointment } from './types'
import { useCalendarState } from './hooks/useCalendarState'
import { useCalendarData } from './hooks/useCalendarData'
import { useCalendarActions } from './hooks/useCalendarActions'
import { startOfWeek, addDays } from './utils/dateUtils'
import { isCalendarTransitioning } from './utils/dayTimelinePaging'
import { businessTodayDate, isSelectedBusinessToday } from './utils/goToToday'
import MonthSelector from './components/MonthSelector'
import WeekSelector from './components/WeekSelector'
import DayTimeline from './components/DayTimeline'
import CreateAppointmentModal from './components/CreateAppointmentModal'
import DayCapacityModal from './components/DayCapacityModal'

export default function Calendar() {
  const [scrollToApptId, setScrollToApptId] = useState<number | undefined>(undefined)
  const [isDesktop, setIsDesktop] = useState(false)
  const [navHeight, setNavHeight] = useState(48)
  const [isSettling, setIsSettling] = useState(false)
  const [dayInfoOpen, setDayInfoOpen] = useState(false)
  const navigate = useNavigate()
  const {
    selected,
    setSelected,
    showMonth,
    setShowMonth,
    nowOffset,
    monthInfo,
    setMonthInfo,
    monthCounts,
    setMonthCounts,
    weekCounts,
    setWeekCounts,
    appointments,
    setAppointments,
    createParams,
    setCreateParams,
    rescheduleOldId,
    setRescheduleOldId,
    deleteOldId,
    setDeleteOldId,
    queryAppt,
  } = useCalendarState()

  const { refresh, refreshMonthCounts, refreshWeekCounts, isLoadingDay } = useCalendarData(
    selected,
    setMonthInfo,
    setMonthCounts,
    setWeekCounts,
    setAppointments
  )

  const isTransitioning = isCalendarTransitioning(isLoadingDay, isSettling)

  const { handleUpdate, handleCreateFrom, handleEdit, handleCreated, handleRescheduled } = useCalendarActions(
    setCreateParams,
    setRescheduleOldId,
    setDeleteOldId,
    refresh,
    refreshMonthCounts,
    refreshWeekCounts,
    setSelected
  )

  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()

  /** Deep link from screenshot booking: ?date=YYYY-MM-DD&appt=id */
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const appt = params.get('appt')
    const dateStr = params.get('date')
    if (!appt || !dateStr) return
    const parts = dateStr.split('-')
    if (parts.length !== 3) return
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10))
    if (!isNaN(d.getTime())) setSelected(d)
  }, [location.search, setSelected])

  // Legacy Schedule "Book Again" link: redirect to client booking page
  useEffect(() => {
    const bookAgainId = searchParams.get('bookAgain')
    if (!bookAgainId) return
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('bookAgain')
      return next
    }, { replace: true })
    // Without client id we cannot open the client page; ignore orphan params.
  }, [searchParams, setSearchParams])

  const weekStart = startOfWeek(selected)
  const days = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i))

  const prevWeek = () => {
    if (isTransitioning) return
    setSelected((d) => addDays(d, -7))
  }
  const nextWeek = () => {
    if (isTransitioning) return
    setSelected((d) => addDays(d, 7))
  }
  const prevDay = () => setSelected((d) => addDays(d, -1))
  const nextDay = () => setSelected((d) => addDays(d, 1))

  const goToToday = () => {
    if (isTransitioning) return
    setSelected(businessTodayDate())
    setShowMonth(false)
  }

  const handleCreateOrBookAgain = (appt: Appointment, status: Appointment['status']) => {
    if (status === 'APPOINTED' && appt.clientId) {
      const qs = appt.id != null ? `?sourceAppt=${appt.id}` : ''
      navigate(`/dashboard/contacts/clients/${appt.clientId}/book-appointment${qs}`)
      return
    }
    void handleCreateFrom(appt, status)
  }

  // Detect desktop vs mobile for responsive padding and measure nav height
  useEffect(() => {
    const checkDesktop = () => {
      const isDesktopWidth = window.innerWidth >= 768
      setIsDesktop(isDesktopWidth)
      // Measure actual nav bar height on desktop
      if (isDesktopWidth) {
        // Find nav element - it has md:sticky class
        const navElements = document.querySelectorAll('nav')
        const stickyNav = Array.from(navElements).find(el => {
          const styles = window.getComputedStyle(el)
          return styles.position === 'sticky' || styles.position === 'fixed'
        }) as HTMLElement | undefined
        if (stickyNav) {
          setNavHeight(stickyNav.offsetHeight)
        }
      } else {
        setNavHeight(0)
      }
    }
    checkDesktop()
    window.addEventListener('resize', checkDesktop)
    // Also check after a brief delay to ensure nav is rendered
    const timeoutId = setTimeout(checkDesktop, 100)
    return () => {
      window.removeEventListener('resize', checkDesktop)
      clearTimeout(timeoutId)
    }
  }, [])
  // Mobile header is sticky (in flow); only desktop fixed header needs content padding.
  const contentPadding = isDesktop ? 108 : 0
  const showTodayButton = !isSelectedBusinessToday(selected)

  return (
    <div id="calendar-page" className="flex flex-col h-full">
      <div 
        id="calendar-header"
        className="sticky md:fixed top-0 left-0 right-0 z-40 bg-white"
        style={{ 
          top: isDesktop ? `${navHeight}px` : '0px',
          borderTop: '1px solid rgb(209 213 219)' // border-gray-300
        }}
      >
        <MonthSelector
          selected={selected}
          setSelected={(d) => {
            if (isTransitioning) return
            setSelected(d)
          }}
          show={showMonth}
          setShow={setShowMonth}
          monthInfo={monthInfo}
          counts={monthCounts}
          navigationLocked={isTransitioning}
          onGoToToday={goToToday}
          showTodayButton={showTodayButton}
        />
        <WeekSelector
          days={days}
          selected={selected}
          setSelected={(d) => {
            if (isTransitioning) return
            setSelected(d)
          }}
          showMonth={showMonth}
          prevWeek={prevWeek}
          nextWeek={nextWeek}
          counts={weekCounts}
          navigationLocked={isTransitioning}
        />
      </div>
      <div 
        id="calendar-content"
        className="flex flex-col flex-1 overflow-hidden relative"
        style={{ 
          paddingTop: `${contentPadding}px`
        }}
      >
        <DayTimeline
          nowOffset={nowOffset}
          prevDay={prevDay}
          nextDay={nextDay}
          appointments={appointments.current}
          prevAppointments={appointments.prev}
          nextAppointments={appointments.next}
          initialApptId={queryAppt}
          scrollToApptId={scrollToApptId}
          selectedDate={selected}
          onUpdate={handleUpdate}
          onCreate={handleCreateOrBookAgain}
          onEdit={handleEdit}
          onRescheduled={handleRescheduled}
          onNavigateToDate={(date) => {
            setSelected(date)
            refresh()
            refreshMonthCounts(date)
            refreshWeekCounts(date)
          }}
          onRefresh={() => {
            refresh()
            refreshMonthCounts(selected)
            refreshWeekCounts(selected)
          }}
          onSettlingChange={setIsSettling}
          navigationLocked={isTransitioning}
        />
        {isTransitioning ? (
          <div
            className="absolute inset-0 z-30 flex items-center justify-center bg-white/80"
            style={{ top: contentPadding }}
            aria-live="polite"
            aria-busy="true"
          >
            <div className="flex flex-col items-center gap-2 text-gray-700">
              <div
                className="h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"
                aria-hidden
              />
              <span className="text-sm">Loading day…</span>
            </div>
          </div>
        ) : null}
      </div>
      <button
        type="button"
        aria-label="Day overview"
        title="Day overview"
        className="fixed right-6 z-40 w-12 h-12 rounded-full bg-black text-white text-2xl leading-none flex items-center justify-center"
        style={{
          bottom: 'max(6.5rem, calc(5.25rem + env(safe-area-inset-bottom)))',
        }}
        onClick={() => setDayInfoOpen(true)}
      >
        <span className="leading-none flex items-center justify-center translate-y-[-1px]" aria-hidden>
          ?
        </span>
      </button>
      {dayInfoOpen && (
        <DayCapacityModal
          date={selected}
          appointments={appointments.current}
          onClose={() => setDayInfoOpen(false)}
        />
      )}
      {createParams && (
        <CreateAppointmentModal
          onClose={() => {
            localStorage.removeItem('createAppointmentState')
            localStorage.removeItem('createAppointmentSelectedTemplateId')
            setCreateParams(null)
            setRescheduleOldId(null)
            setDeleteOldId(null)
          }}
          onCreated={async (appt) => {
            const apptId = await handleCreated(appt, rescheduleOldId, deleteOldId)
            setRescheduleOldId(null)
            setDeleteOldId(null)
            if (apptId) {
              // Set scroll ID after a brief delay to ensure date navigation completes
              setTimeout(() => {
                setScrollToApptId(apptId)
                // Clear after scrolling completes
                setTimeout(() => setScrollToApptId(undefined), 2000)
              }, 100)
            }
          }}
          initialClientId={createParams.clientId}
          initialTemplateId={createParams.templateId ?? undefined}
          newStatus={createParams.status}
          initialAppointment={createParams.appointment}
          initialTime={createParams.initialTime}
        />
      )}
    </div>
  )
}

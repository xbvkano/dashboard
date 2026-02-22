import { useState, useRef, useEffect } from 'react'
import { useCalendarState } from './hooks/useCalendarState'
import { useCalendarData } from './hooks/useCalendarData'
import { useCalendarActions } from './hooks/useCalendarActions'
import { startOfWeek, addDays, addMonths } from './utils/dateUtils'
import MonthSelector from './components/MonthSelector'
import WeekSelector from './components/WeekSelector'
import DayTimeline from './components/DayTimeline'
import CreateAppointmentModal from './components/CreateAppointmentModal'

export default function Calendar() {
  const [scrollToApptId, setScrollToApptId] = useState<number | undefined>(undefined)
  const [headerHeight, setHeaderHeight] = useState(0)
  const [isDesktop, setIsDesktop] = useState(false)
  const [navHeight, setNavHeight] = useState(48)
  const headerRef = useRef<HTMLDivElement>(null)
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

  const { refresh, refreshMonthCounts, refreshWeekCounts } = useCalendarData(
    selected,
    setMonthInfo,
    setMonthCounts,
    setWeekCounts,
    setAppointments
  )

  const { handleUpdate, handleCreateFrom, handleEdit, handleCreated, handleRescheduled } = useCalendarActions(
    setCreateParams,
    setRescheduleOldId,
    setDeleteOldId,
    refresh,
    refreshMonthCounts,
    refreshWeekCounts,
    setSelected
  )

  const weekStart = startOfWeek(selected)
  const days = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i))

  const prevMonth = () => setSelected((d) => addMonths(d, -1))
  const nextMonth = () => setSelected((d) => addMonths(d, 1))
  const prevWeek = () => setSelected((d) => addDays(d, -7))
  const nextWeek = () => setSelected((d) => addDays(d, 7))
  const prevDay = () => setSelected((d) => addDays(d, -1))
  const nextDay = () => setSelected((d) => addDays(d, 1))

  // Measure header height for padding calculations
  useEffect(() => {
    if (headerRef.current) {
      const height = headerRef.current.offsetHeight
      setHeaderHeight(height)
    }
  }, [showMonth, selected])

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
  const contentPadding = isDesktop ? 108 : headerHeight

  return (
    <div id="calendar-page" className="flex flex-col h-full">
      <div 
        id="calendar-header"
        ref={headerRef}
        className="sticky md:fixed top-0 left-0 right-0 z-40 bg-white"
        style={{ 
          top: isDesktop ? `${navHeight}px` : '0px',
          borderTop: '1px solid rgb(209 213 219)' // border-gray-300
        }}
      >
        <MonthSelector
          selected={selected}
          setSelected={setSelected}
          show={showMonth}
          setShow={setShowMonth}
          monthInfo={monthInfo}
          counts={monthCounts}
        />
        <WeekSelector
          days={days}
          selected={selected}
          setSelected={setSelected}
          showMonth={showMonth}
          prevWeek={prevWeek}
          nextWeek={nextWeek}
          counts={weekCounts}
        />
      </div>
      <div 
        id="calendar-content"
        className="flex flex-col flex-1 overflow-hidden"
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
          onCreate={(appt, status) => handleCreateFrom(appt, status)}
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
        />
      </div>
      <button
        className="fixed bottom-20 right-6 w-12 h-12 rounded-full bg-black text-white text-2xl flex items-center justify-center"
        onClick={() => setCreateParams({})}
      >
        +
      </button>
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

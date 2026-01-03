import { useState } from 'react'
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

  const { handleUpdate, handleCreateFrom, handleEdit, handleCreated } = useCalendarActions(
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

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10 bg-white">
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
      />
      <button
        className="fixed bottom-20 right-6 w-12 h-12 rounded-full bg-black text-white text-2xl flex items-center justify-center"
        onClick={() => setCreateParams({})}
      >
        +
      </button>
      {createParams && (
        <CreateAppointmentModal
          onClose={() => {
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
        />
      )}
    </div>
  )
}

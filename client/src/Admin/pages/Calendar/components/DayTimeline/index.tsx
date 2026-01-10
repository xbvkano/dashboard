import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { API_BASE_URL } from '../../../../../api'
import AppointmentCard from './AppointmentCard'
import AppointmentDetails from './AppointmentDetails'
import type { Appointment } from '../../types'

interface DayTimelineProps {
  nowOffset: number | null
  prevDay: () => void
  nextDay: () => void
  appointments: Appointment[]
  prevAppointments: Appointment[]
  nextAppointments: Appointment[]
  initialApptId?: number
  onUpdate?: (appointment: Appointment) => void
  onCreate?: (appt: Appointment, status: Appointment['status']) => void
  onEdit?: (appt: Appointment) => void
  onNavigateToDate?: (date: Date) => void
  onRefresh?: () => void
}

export default function DayTimeline({
  nowOffset,
  prevDay,
  nextDay,
  appointments,
  prevAppointments,
  nextAppointments,
  initialApptId,
  onUpdate,
  onCreate,
  onEdit,
}: DayTimelineProps) {
  const [selected, setSelected] = useState<Appointment | null>(null)
  const [overlayTop, setOverlayTop] = useState(0)
  const [overlayHeight, setOverlayHeight] = useState(0)
  const [animating, setAnimating] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const initialShown = useRef(false)
  const [showSkipConfirm, setShowSkipConfirm] = useState(false)
  const [showConfirmConfirm, setShowConfirmConfirm] = useState(false)
  const [skipAppointment, setSkipAppointment] = useState<Appointment | null>(null)
  const [confirmAppointment, setConfirmAppointment] = useState<Appointment | null>(null)

  useEffect(() => {
    setSelected(null)
  }, [appointments])

  useEffect(() => {
    if (!initialShown.current && initialApptId && appointments.length) {
      const match = appointments.find((a) => a.id === initialApptId)
      if (match) {
        setSelected(match)
        initialShown.current = true
      }
    }
  }, [initialApptId, appointments])

  const handleAppointmentClick = (appointment: Appointment, event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setOverlayTop(rect.top)
    setOverlayHeight(rect.height)
    setSelected(appointment)
  }

  const handleCloseDetails = () => {
    setSelected(null)
  }

  const handleUpdate = (updated: Appointment) => {
    onUpdate?.(updated)
  }

  const handleCreate = (appt: Appointment, status: Appointment['status']) => {
    onCreate?.(appt, status)
  }

  const handleEdit = (appt: Appointment) => {
    onEdit?.(appt)
  }

  const handleRequestSkip = () => {
    if (selected) {
      setSkipAppointment(selected)
      setSelected(null) // Close details modal
      setShowSkipConfirm(true) // Show skip confirmation
    }
  }

  const handleRequestConfirm = () => {
    if (selected) {
      setConfirmAppointment(selected)
      setShowConfirmConfirm(true) // Show confirm confirmation (details stays behind)
    }
  }

  const executeSkipRecurring = async () => {
    if (!skipAppointment?.id) return
    setShowSkipConfirm(false)
    const res = await fetch(`${API_BASE_URL}/recurring/appointments/${skipAppointment.id}/skip`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '1',
      },
    })
    if (res.ok) {
      const data = await res.json()
      onUpdate?.(skipAppointment)
      setSkipAppointment(null)
      
      // Navigate to next appointment date if available
      // Note: data.nextAppointmentDate contains the date of the next unconfirmed recurring appointment
      if (data.nextAppointmentDate && onNavigateToDate) {
        // Parse date string to avoid timezone issues
        const dateStr = data.nextAppointmentDate
        const dateParts = typeof dateStr === 'string' ? dateStr.split('T')[0].split('-') : null
        if (dateParts && dateParts.length === 3) {
          const nextDate = new Date(
            parseInt(dateParts[0]),
            parseInt(dateParts[1]) - 1,
            parseInt(dateParts[2])
          )
          onNavigateToDate(nextDate)
          onRefresh?.()
        }
      }
    } else {
      const errorData = await res.json().catch(() => ({}))
      alert(errorData.error || 'Failed to skip appointment')
    }
  }

  const cancelSkip = () => {
    setShowSkipConfirm(false)
    if (skipAppointment) {
      setSelected(skipAppointment) // Reopen details modal
      setSkipAppointment(null)
    }
  }

  const executeConfirmRecurring = async () => {
    if (!confirmAppointment?.id) return
    setShowConfirmConfirm(false)
    const res = await fetch(`${API_BASE_URL}/recurring/appointments/${confirmAppointment.id}/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '1',
      },
    })
    if (res.ok) {
      const updated = await res.json()
      onUpdate?.(updated)
      setSelected(null) // Close details modal
      setConfirmAppointment(null)
      
      // Navigate to next appointment date if available
      // Note: updated.family.nextAppointmentDate contains the date of the next unconfirmed recurring appointment
      if (updated.family?.nextAppointmentDate && onNavigateToDate) {
        // Parse date string to avoid timezone issues
        const dateStr = updated.family.nextAppointmentDate
        const dateParts = typeof dateStr === 'string' ? dateStr.split('T')[0].split('-') : null
        if (dateParts && dateParts.length === 3) {
          const nextDate = new Date(
            parseInt(dateParts[0]),
            parseInt(dateParts[1]) - 1,
            parseInt(dateParts[2])
          )
          onNavigateToDate(nextDate)
          onRefresh?.()
        }
      }
    } else {
      const errorData = await res.json().catch(() => ({}))
      alert(errorData.error || 'Failed to confirm appointment')
    }
  }

  const cancelConfirm = () => {
    setShowConfirmConfirm(false)
    setConfirmAppointment(null)
    // Details modal stays open
  }

  return (
    <div id="day-timeline" className="flex-1 relative overflow-hidden">
      {/* Navigation */}
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        <button
          onClick={prevDay}
          className="bg-white shadow rounded-full w-10 h-10 flex items-center justify-center"
        >
          ←
        </button>
        <button
          onClick={nextDay}
          className="bg-white shadow rounded-full w-10 h-10 flex items-center justify-center"
        >
          →
        </button>
      </div>

      {/* Timeline */}
      <div
        id="day-timeline-scroll"
        ref={scrollRef}
        className="h-full overflow-hidden relative"
        style={{ paddingTop: '60px' }}
      >
        {/* Time markers */}
        <div className="relative">
          {Array.from({ length: 24 }, (_, hour) => (
            <div
              key={hour}
              className="absolute left-0 right-0 border-t border-gray-200"
              style={{ top: `${hour * 84}px` }}
            >
              <div className="absolute left-2 top-0 transform -translate-y-1/2 bg-white px-2 text-xs text-gray-500">
                {hour === 0 ? '12 AM' : hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
              </div>
            </div>
          ))}
        </div>

        {/* Current time indicator */}
        {nowOffset !== null && (
          <div
            className="absolute left-0 right-0 z-10"
            style={{ top: `${nowOffset}px` }}
          >
            <div className="h-0.5 bg-red-500 relative">
              <div className="absolute -left-1 -top-1 w-3 h-3 bg-red-500 rounded-full"></div>
            </div>
          </div>
        )}

        {/* Appointments */}
        <div id="day-timeline-appointments" className="relative">
          {appointments.map((appointment) => (
            <AppointmentCard
              key={appointment.id}
              appointment={appointment}
              onClick={(event) => handleAppointmentClick(appointment, event)}
              isSelected={selected?.id === appointment.id}
            />
          ))}
        </div>
      </div>

      {/* Appointment Details Overlay */}
      {selected && createPortal(
        <>
          {/* Full-page background overlay - must be above everything including header (z-40) */}
          <div
            className="fixed inset-0 bg-black/50"
            style={{ zIndex: 9999 }}
            onClick={handleCloseDetails}
          />
          {/* Appointment details card */}
          <div
            className="fixed"
            style={{
              top: `${overlayTop}px`,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 10000,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <AppointmentDetails
              appointment={selected}
              onUpdate={handleUpdate}
              onClose={handleCloseDetails}
              onCreate={handleCreate}
              onEdit={handleEdit}
              onNavigateToDate={onNavigateToDate}
              onRefresh={onRefresh}
              onRequestSkip={handleRequestSkip}
              onRequestConfirm={handleRequestConfirm}
            />
          </div>
        </>,
        document.body
      )}

      {/* Skip Confirmation Modal */}
      {showSkipConfirm && skipAppointment && createPortal(
        <>
          <div
            className="fixed inset-0 bg-black/50"
            style={{ zIndex: 10001 }}
            onClick={cancelSkip}
          />
          <div
            className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white p-6 rounded-lg shadow-lg max-w-md"
            style={{ zIndex: 10002 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4">Skip Recurring Appointment?</h3>
            <p className="text-sm text-gray-600 mb-4">
              This appointment will be marked as canceled and the next one will be generated.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={cancelSkip}
                className="px-4 py-2 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={executeSkipRecurring}
                className="px-4 py-2 bg-yellow-500 text-white rounded text-sm hover:bg-yellow-600"
              >
                Skip
              </button>
            </div>
          </div>
        </>,
        document.body
      )}

      {/* Confirm Confirmation Modal */}
      {showConfirmConfirm && confirmAppointment && createPortal(
        <>
          <div
            className="fixed inset-0 bg-black/50"
            style={{ zIndex: 10001 }}
            onClick={cancelConfirm}
          />
          <div
            className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white p-6 rounded-lg shadow-lg max-w-md"
            style={{ zIndex: 10002 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4">Confirm Recurring Appointment?</h3>
            <p className="text-sm text-gray-600 mb-4">
              This appointment will be confirmed and the next unconfirmed appointment will be generated.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={cancelConfirm}
                className="px-4 py-2 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={executeConfirmRecurring}
                className="px-4 py-2 bg-green-500 text-white rounded text-sm hover:bg-green-600"
              >
                Confirm
              </button>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  )
}

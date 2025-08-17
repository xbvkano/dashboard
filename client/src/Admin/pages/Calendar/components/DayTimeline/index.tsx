import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
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

  return (
    <div className="flex-1 relative overflow-hidden">
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
        ref={scrollRef}
        className="h-full overflow-y-auto relative"
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
        <div className="relative">
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
        <div
          className="fixed z-50"
          style={{
            top: `${overlayTop}px`,
            left: '50%',
            transform: 'translateX(-50%)',
          }}
        >
          <AppointmentDetails
            appointment={selected}
            onUpdate={handleUpdate}
            onClose={handleCloseDetails}
            onCreate={handleCreate}
            onEdit={handleEdit}
          />
        </div>,
        document.body
      )}
    </div>
  )
}

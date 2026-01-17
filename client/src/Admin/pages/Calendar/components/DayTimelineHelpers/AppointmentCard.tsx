import { formatPhone } from '../../../../../formatPhone'
import type { Appointment } from '../../types'

interface AppointmentCardProps {
  appointment: Appointment
  onClick: () => void
  isSelected: boolean
}

export default function AppointmentCard({ appointment, onClick, isSelected }: AppointmentCardProps) {
  const startTime = appointment.time
  const endTime = appointment.time // You might want to calculate this based on hours
  const top = (parseInt(startTime.split(':')[0]) * 60 + parseInt(startTime.split(':')[1])) * (84 / 60)
  const height = appointment.hours ? appointment.hours * 84 : 84

  const isRecurringUnconfirmed = appointment.status === 'RECURRING_UNCONFIRMED'
  const bgColor = isRecurringUnconfirmed
    ? isSelected
      ? 'ring-2 ring-blue-500 bg-blue-100'
      : 'bg-blue-200 hover:bg-blue-300'
    : isSelected
    ? 'ring-2 ring-blue-500 bg-blue-50'
    : 'bg-white hover:bg-gray-50'

  return (
    <div
      className={`absolute left-0 right-0 mx-1 rounded border cursor-pointer ${bgColor}`}
      style={{
        top: `${top}px`,
        height: `${height}px`,
        minHeight: '60px',
      }}
      onClick={onClick}
    >
      <div className="p-2 h-full flex flex-col">
        <div className="font-medium text-sm truncate">
          {appointment.client?.name}
        </div>
        <div className="text-xs text-gray-600 truncate">
          {formatPhone(appointment.client?.number || '')}
        </div>
        <div className="text-xs text-gray-600 truncate">
          {appointment.address}
        </div>
        {appointment.carpetRooms && (
          <div className="text-xs text-blue-600">
            Carpet: {appointment.carpetRooms} rooms
          </div>
        )}
        <div className="text-xs text-gray-500 mt-auto">
          {startTime} - {endTime}
        </div>
        {isRecurringUnconfirmed && (
          <div className="text-xs text-blue-700 font-medium">
            Recurring – Needs Confirmation
          </div>
        )}
        {appointment.paid && (
          <div className="text-xs text-green-600 font-medium">
            ✓ Paid
          </div>
        )}
      </div>
    </div>
  )
}

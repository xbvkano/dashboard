import { useNavigate } from 'react-router-dom'
import { RecurrenceFamily } from '../index'

interface Props {
  families: RecurrenceFamily[]
}

export default function RecurringCalendar({ families }: Props) {
  const navigate = useNavigate()
  const today = new Date()
  const currentMonth = today.getMonth()
  const currentYear = today.getFullYear()
  const firstDay = new Date(currentYear, currentMonth, 1)
  const lastDay = new Date(currentYear, currentMonth + 1, 0)
  const daysInMonth = lastDay.getDate()
  const startingDayOfWeek = firstDay.getDay()

  // Collect all appointments for this month
  const appointmentsByDate = new Map<number, { confirmed: number; unconfirmed: number }>()
  
  families.forEach((family) => {
    family.appointments?.forEach((appt: any) => {
      // Parse date string (YYYY-MM-DD) to avoid timezone issues
      const dateStr = appt.date
      if (typeof dateStr === 'string' && dateStr.includes('T')) {
        // If it's an ISO string, extract just the date part
        const dateOnly = dateStr.split('T')[0]
        const dateParts = dateOnly.split('-')
        if (dateParts.length === 3) {
          const apptDate = new Date(
            parseInt(dateParts[0]),
            parseInt(dateParts[1]) - 1, // Month is 0-indexed
            parseInt(dateParts[2])
          )
          if (apptDate.getMonth() === currentMonth && apptDate.getFullYear() === currentYear) {
            const day = apptDate.getDate()
            if (!appointmentsByDate.has(day)) {
              appointmentsByDate.set(day, { confirmed: 0, unconfirmed: 0 })
            }
            const counts = appointmentsByDate.get(day)!
            if (appt.status === 'APPOINTED') {
              counts.confirmed++
            } else if (appt.status === 'RECURRING_UNCONFIRMED') {
              counts.unconfirmed++
            }
          }
        }
      } else {
        // Fallback to original method if date format is different
        const apptDate = new Date(appt.date)
        if (apptDate.getMonth() === currentMonth && apptDate.getFullYear() === currentYear) {
          const day = apptDate.getDate()
          if (!appointmentsByDate.has(day)) {
            appointmentsByDate.set(day, { confirmed: 0, unconfirmed: 0 })
          }
          const counts = appointmentsByDate.get(day)!
          if (appt.status === 'APPOINTED') {
            counts.confirmed++
          } else if (appt.status === 'RECURRING_UNCONFIRMED') {
            counts.unconfirmed++
          }
        }
      }
    })
  })

  const days = []
  // Empty cells for days before month starts
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(null)
  }
  // Days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(day)
  }

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="text-lg font-semibold mb-4">
        {monthNames[currentMonth]} {currentYear}
      </h3>
      <div className="grid grid-cols-7 gap-1 text-xs">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="text-center font-medium text-gray-600 p-1">
            {day}
          </div>
        ))}
        {days.map((day, idx) => {
          if (day === null) {
            return <div key={`empty-${idx}`} className="p-2" />
          }
          const counts = appointmentsByDate.get(day) || { confirmed: 0, unconfirmed: 0 }
          const isToday = day === today.getDate()
          const hasAppointments = counts.confirmed > 0 || counts.unconfirmed > 0
          const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          
          return (
            <div
              key={day}
              className={`p-2 border rounded text-center ${
                isToday ? 'bg-blue-100 border-blue-300' : ''
              } ${hasAppointments ? 'cursor-pointer hover:bg-gray-50' : ''}`}
              onClick={() => {
                if (hasAppointments) {
                  navigate(`/dashboard/calendar?date=${dateStr}`)
                }
              }}
            >
              <div className="font-medium">{day}</div>
              {counts.confirmed > 0 && (
                <div className="text-xs text-green-600">✓ {counts.confirmed}</div>
              )}
              {counts.unconfirmed > 0 && (
                <div className="text-xs text-blue-600">○ {counts.unconfirmed}</div>
              )}
            </div>
          )
        })}
      </div>
      <div className="mt-4 text-xs text-gray-600 space-y-1">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 bg-green-200 rounded"></span>
          <span>Confirmed</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 bg-blue-200 rounded"></span>
          <span>Unconfirmed</span>
        </div>
      </div>
    </div>
  )
}

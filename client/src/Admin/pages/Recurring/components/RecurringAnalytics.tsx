import { RecurrenceFamily } from '../index'

interface Props {
  activeFamilies: RecurrenceFamily[]
  stoppedFamilies: RecurrenceFamily[]
}

export default function RecurringAnalytics({ activeFamilies, stoppedFamilies }: Props) {
  const totalActive = activeFamilies.length
  const totalStopped = stoppedFamilies.length
  const totalUpcoming = activeFamilies.reduce((sum, f) => sum + (f.upcomingCount || 0), 0)
  const totalUnconfirmed = activeFamilies.reduce((sum, f) => sum + (f.unconfirmedCount || 0), 0)
  
  // Calculate projected revenue (sum of prices from upcoming appointments)
  const projectedRevenue = activeFamilies.reduce((sum, family) => {
    const upcoming = family.appointments?.filter(
      (a: any) => a.status === 'APPOINTED' || a.status === 'RECURRING_UNCONFIRMED'
    ) || []
    return sum + upcoming.reduce((s: number, a: any) => s + (a.price || 0), 0)
  }, 0)

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="bg-white rounded-lg shadow p-4">
        <div className="text-sm text-gray-600">Active Families</div>
        <div className="text-2xl font-semibold">{totalActive}</div>
      </div>
      <div className="bg-white rounded-lg shadow p-4">
        <div className="text-sm text-gray-600">Upcoming Appointments</div>
        <div className="text-2xl font-semibold">{totalUpcoming}</div>
      </div>
      <div className="bg-white rounded-lg shadow p-4">
        <div className="text-sm text-gray-600">Unconfirmed</div>
        <div className="text-2xl font-semibold text-purple-600">{totalUnconfirmed}</div>
      </div>
      <div className="bg-white rounded-lg shadow p-4">
        <div className="text-sm text-gray-600">Projected Revenue</div>
        <div className="text-2xl font-semibold text-green-600">
          ${projectedRevenue.toFixed(2)}
        </div>
      </div>
    </div>
  )
}

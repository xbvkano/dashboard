import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { API_BASE_URL, fetchJson } from '../../api'

interface RecurrenceFamily {
  id: number
  status: 'active' | 'stopped'
  recurrenceRule: string
  nextAppointmentDate: string | null
  createdAt: string
  updatedAt: string
  ruleSummary?: string
  unconfirmedCount?: number
  confirmedCount?: number
  upcomingCount?: number
  totalAppointments?: number
  appointments?: any[]
  rule?: any
  history?: any[]
  nextAppointment?: any
}

interface Props {
  clientId: number
}

export default function RecurrenceFamiliesSection({ clientId }: Props) {
  const [families, setFamilies] = useState<RecurrenceFamily[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadFamilies()
  }, [clientId])

  const loadFamilies = async () => {
    setLoading(true)
    try {
      const data = await fetchJson(`${API_BASE_URL}/clients/${clientId}/recurrence-families`)
      setFamilies(data)
    } catch (err) {
      console.error('Failed to load recurrence families:', err)
      setFamilies([])
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-2">Recurrence Families</h3>
        <div className="text-sm text-gray-500">Loading...</div>
      </div>
    )
  }

  if (families.length === 0) {
    return (
      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-2">Recurrence Families</h3>
        <div className="text-sm text-gray-500">No recurrence families for this client</div>
      </div>
    )
  }

  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold mb-2">Recurrence Families</h3>
      <ul className="space-y-2">
        {families.map((family) => (
          <li key={family.id} className="border rounded bg-white shadow">
            <Link
              to={`/dashboard/recurring?familyId=${family.id}`}
              className="block p-3 hover:bg-gray-50"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="font-medium">
                    {family.ruleSummary || 'Recurring'}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    Status: <span className={family.status === 'active' ? 'text-green-600' : 'text-red-600'}>
                      {family.status === 'active' ? 'Active' : 'Stopped'}
                    </span>
                  </div>
                  {family.nextAppointmentDate && (
                    <div className="text-sm text-gray-600 mt-1">
                      Next: {new Date(family.nextAppointmentDate).toLocaleDateString()}
                    </div>
                  )}
                  {family.nextAppointment && (
                    <div className="text-sm text-purple-600 mt-1">
                      {family.nextAppointment.status === 'RECURRING_UNCONFIRMED' && '⚠ Needs Confirmation'}
                    </div>
                  )}
                </div>
                <div className="text-sm text-gray-500">
                  {family.unconfirmedCount !== undefined && family.unconfirmedCount > 0 && (
                    <div className="text-purple-600">{family.unconfirmedCount} unconfirmed</div>
                  )}
                  {family.confirmedCount !== undefined && family.confirmedCount > 0 && (
                    <div>{family.confirmedCount} confirmed</div>
                  )}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

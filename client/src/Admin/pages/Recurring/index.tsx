import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { API_BASE_URL, fetchJson } from '../../../api'
import RecurringFamilyDetail from './components/RecurringFamilyDetail'
import RecurringFamilyList from './components/RecurringFamilyList'
import RecurringCalendar from './components/RecurringCalendar'
import RecurringAnalytics from './components/RecurringAnalytics'
import CreateRecurrenceFamilyModal from './components/CreateRecurrenceFamilyModal'

export interface RecurrenceFamily {
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
  template?: {
    id?: number
    name: string
    type?: string
    size?: string | null
    address?: string
    cityStateZip?: string | null
    price?: number | null
    instructions?: string | null
    notes?: string | null
    carpetRooms?: number | null
    carpetPrice?: number | null
  } | null
}

export default function Recurring() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeFamilies, setActiveFamilies] = useState<RecurrenceFamily[]>([])
  const [stoppedFamilies, setStoppedFamilies] = useState<RecurrenceFamily[]>([])
  const [selectedFamilyId, setSelectedFamilyId] = useState<number | null>(null)
  const [selectedFamily, setSelectedFamily] = useState<RecurrenceFamily | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'list' | 'detail'>('list')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const isNavigatingBackRef = useRef(false)
  
  // Month and year selection - default to current month/year
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth())
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear())

  // Check for familyId in URL params
  useEffect(() => {
    const familyIdParam = searchParams.get('familyId')
    if (familyIdParam) {
      const id = parseInt(familyIdParam, 10)
      if (!isNaN(id)) {
        setSelectedFamilyId(id)
        setView('detail')
      }
    }
  }, [searchParams])

  const loadFamilies = async () => {
    setLoading(true)
    try {
      const [active, stopped] = await Promise.all([
        fetchJson(`${API_BASE_URL}/recurring/active`),
        fetchJson(`${API_BASE_URL}/recurring/stopped`),
      ])
      setActiveFamilies(active)
      setStoppedFamilies(stopped)
    } catch (err) {
      console.error('Failed to load recurrence families:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadFamilyDetail = async (id: number) => {
    try {
      const family = await fetchJson(`${API_BASE_URL}/recurring/${id}`)
      setSelectedFamily(family)
    } catch (err: any) {
      console.error('Failed to load family detail:', err)
    }
  }

  useEffect(() => {
    loadFamilies()
  }, [])

  useEffect(() => {
    if (selectedFamilyId) {
      loadFamilyDetail(selectedFamilyId)
    }
  }, [selectedFamilyId, view])

  const handleSelectFamily = (familyId: number) => {
    setSelectedFamilyId(familyId)
    setView('detail')
    setSearchParams({ familyId: familyId.toString() })
  }

  const handleBackToList = () => {
    isNavigatingBackRef.current = true
    setSelectedFamilyId(null)
    setSelectedFamily(null)
    setView('list')
    setSearchParams({})
    // Refresh families list when navigating back
    loadFamilies()
    // Reset the flag after React has processed the state updates
    setTimeout(() => {
      isNavigatingBackRef.current = false
    }, 200)
  }

  const handleFamilyUpdated = () => {
    loadFamilies()
    // Only reload detail if we're still in detail view and have a selected family
    // AND we're not in the process of navigating back (which would cause 404 errors)
    if (!isNavigatingBackRef.current && view === 'detail' && selectedFamilyId) {
      loadFamilyDetail(selectedFamilyId)
    }
  }

  if (loading && !selectedFamily) {
    return (
      <div className="p-4">
        <div className="text-center">Loading...</div>
      </div>
    )
  }

  if (view === 'detail' && selectedFamily) {
    return (
      <div className="p-4 space-y-4">
        <button
          onClick={handleBackToList}
          className="text-blue-500 hover:text-blue-700"
        >
          ← Back to Recurring Appointments
        </button>
        <RecurringFamilyDetail
          family={selectedFamily}
          onUpdate={handleFamilyUpdated}
          onBackToList={handleBackToList}
        />
      </div>
    )
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center gap-4 mb-4">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-1 px-3 py-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
        >
          <span className="text-xl">←</span>
          <span>Back to Home</span>
        </button>
      </div>
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Recurring Appointments</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
        >
          + Create Recurrence Family
        </button>
      </div>

      {/* Month and Year Selector */}
      <div className="flex items-center gap-4 bg-white rounded-lg shadow p-4">
        <label className="text-sm font-medium text-gray-700">View Month:</label>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
          className="border rounded px-3 py-2 text-sm"
        >
          {[
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
          ].map((month, index) => (
            <option key={month} value={index}>
              {month}
            </option>
          ))}
        </select>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
          className="border rounded px-3 py-2 text-sm"
        >
          {Array.from({ length: 5 }, (_, i) => {
            const year = new Date().getFullYear() - 1 + i
            return (
              <option key={year} value={year}>
                {year}
              </option>
            )
          })}
        </select>
        <button
          onClick={() => {
            const now = new Date()
            setSelectedMonth(now.getMonth())
            setSelectedYear(now.getFullYear())
          }}
          className="px-3 py-2 text-sm text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded"
        >
          Today
        </button>
      </div>

      <RecurringAnalytics
        activeFamilies={activeFamilies}
        stoppedFamilies={stoppedFamilies}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <RecurringFamilyList
            title="Active Recurrences"
            families={activeFamilies}
            onSelectFamily={handleSelectFamily}
            onUpdate={handleFamilyUpdated}
          />
          <RecurringFamilyList
            title="Stopped Recurrences"
            families={stoppedFamilies}
            onSelectFamily={handleSelectFamily}
            onUpdate={handleFamilyUpdated}
            isStopped
          />
        </div>
        <div className="lg:col-span-1">
          <RecurringCalendar 
            families={[...activeFamilies, ...stoppedFamilies]}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
          />
        </div>
      </div>

      {showCreateModal && (
        <CreateRecurrenceFamilyModal
          onClose={() => setShowCreateModal(false)}
          onCreated={async () => {
            setShowCreateModal(false)
            // Reload both active and stopped families to show the newly created recurrence
            await loadFamilies()
          }}
        />
      )}
    </div>
  )
}

import { useState, useEffect } from 'react'
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
    } catch (err) {
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
  }, [selectedFamilyId])

  const handleSelectFamily = (familyId: number) => {
    setSelectedFamilyId(familyId)
    setView('detail')
    setSearchParams({ familyId: familyId.toString() })
  }

  const handleBackToList = () => {
    setSelectedFamilyId(null)
    setSelectedFamily(null)
    setView('list')
    setSearchParams({})
  }

  const handleFamilyUpdated = () => {
    loadFamilies()
    if (selectedFamilyId) {
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

      <RecurringAnalytics
        activeFamilies={activeFamilies}
        stoppedFamilies={stoppedFamilies}
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
          <RecurringCalendar families={[...activeFamilies, ...stoppedFamilies]} />
        </div>
      </div>

      {showCreateModal && (
        <CreateRecurrenceFamilyModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false)
            loadFamilies()
          }}
        />
      )}
    </div>
  )
}

import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { API_BASE_URL, fetchJson } from '../../../../api'
import CreateAppointmentModal from '../../Calendar/components/CreateAppointmentModal'
import type { Appointment, AppointmentTemplate } from '../../Calendar/types'
import { appointmentCalendarDateKey } from '../../Calendar/types'
import { matchTemplateForAppointment } from '../../Calendar/utils/matchTemplateForAppointment'
import type { Client } from './types'
import BookAgainHistory, { type BookAgainSource } from './BookAgainHistory'

export default function BookAppointmentPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const clientId = id ? parseInt(id, 10) : NaN
  const appliedSourceRef = useRef<number | null>(null)

  const [client, setClient] = useState<Client | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [bookAgainOpen, setBookAgainOpen] = useState(false)
  const [prefill, setPrefill] = useState<{
    sourceId: number
    templateId?: number
    initialTime?: string
  } | null>(null)

  const clientHref = Number.isFinite(clientId)
    ? `/dashboard/contacts/clients/${clientId}`
    : '/dashboard/contacts/clients'

  useEffect(() => {
    if (!Number.isFinite(clientId)) {
      setLoadError('Invalid client')
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    fetchJson(`${API_BASE_URL}/clients/${clientId}`)
      .then((c: Client) => {
        if (!cancelled) setClient(c)
      })
      .catch((e: unknown) => {
        console.error(e)
        if (!cancelled) setLoadError('Client not found')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [clientId])

  const applyBookAgain = useCallback(
    async (appt: BookAgainSource) => {
      if (!Number.isFinite(clientId)) return
      appliedSourceRef.current = appt.id
      try {
        const templates = (await fetchJson(
          `${API_BASE_URL}/appointment-templates?clientId=${clientId}`,
        )) as AppointmentTemplate[]
        const match = matchTemplateForAppointment(templates, appt)
        setPrefill({
          sourceId: appt.id,
          templateId: match?.id,
          initialTime: appt.time || undefined,
        })
        localStorage.removeItem(`createAppointmentState-client-${clientId}`)
        localStorage.removeItem(`createAppointmentSelectedTemplateId-client-${clientId}`)
      } catch (e) {
        console.error(e)
        setPrefill({
          sourceId: appt.id,
          initialTime: appt.time || undefined,
        })
      }
      setBookAgainOpen(false)
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.set('sourceAppt', String(appt.id))
          return next
        },
        { replace: true },
      )
    },
    [clientId, setSearchParams],
  )

  // Deep link: ?sourceAppt=<id>
  useEffect(() => {
    if (!Number.isFinite(clientId) || loading || !client) return
    const sourceAppt = searchParams.get('sourceAppt')
    if (!sourceAppt) return
    const sourceId = parseInt(sourceAppt, 10)
    if (Number.isNaN(sourceId)) return
    if (appliedSourceRef.current === sourceId || prefill?.sourceId === sourceId) return

    let cancelled = false
    fetchJson(
      `${API_BASE_URL}/clients/${clientId}/appointments?take=50`,
    )
      .then(async (rows: BookAgainSource[]) => {
        if (cancelled) return
        const appt = rows.find((r) => r.id === sourceId)
        if (!appt) {
          appliedSourceRef.current = sourceId
          return
        }
        await applyBookAgain(appt)
      })
      .catch(() => {
        appliedSourceRef.current = sourceId
      })
    return () => {
      cancelled = true
    }
  }, [clientId, client, loading, searchParams, prefill?.sourceId, applyBookAgain])

  const handleCreated = (appt: Appointment) => {
    const dateKey = appointmentCalendarDateKey(appt)
    const apptId = appt.id
    navigate(
      apptId != null && dateKey
        ? `/dashboard/calendar?date=${dateKey}&appt=${apptId}`
        : '/dashboard/calendar',
    )
  }

  if (loading) {
    return (
      <div className="p-4 text-sm text-slate-600" aria-busy="true">
        Loading client…
      </div>
    )
  }

  if (loadError || !client) {
    return (
      <div className="p-4 space-y-3">
        <p className="text-sm text-red-700">{loadError || 'Client not found'}</p>
        <Link to={clientHref} className="text-sm font-medium text-blue-600 hover:underline">
          Back to clients
        </Link>
      </div>
    )
  }

  const persistenceKey = `createAppointmentState-client-${clientId}`
  const templatePersistenceKey = `createAppointmentSelectedTemplateId-client-${clientId}`

  return (
    <div className="p-4 pb-24 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="min-w-0">
          <Link
            to={clientHref}
            className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800"
          >
            <span aria-hidden>←</span> Back to {client.name || 'client'}
          </Link>
          <h1 className="text-xl font-semibold text-slate-900 mt-1">Book appointment</h1>
          <p className="text-sm text-slate-500 truncate">{client.name}</p>
        </div>
        <button
          type="button"
          className="md:hidden px-3 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-800 hover:bg-slate-50"
          onClick={() => setBookAgainOpen(true)}
        >
          Book again
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_20rem] gap-4 items-start">
        <div className="min-w-0">
          <CreateAppointmentModal
            key={prefill ? `book-${prefill.sourceId}` : 'book-fresh'}
            variant="page"
            lockClient
            persistenceKey={persistenceKey}
            templatePersistenceKey={templatePersistenceKey}
            onClose={() => navigate(clientHref)}
            onCreated={handleCreated}
            initialClientId={clientId}
            initialTemplateId={prefill?.templateId}
            initialTime={prefill?.initialTime}
            newStatus="APPOINTED"
          />
        </div>
        <aside className="hidden md:block sticky top-4">
          <BookAgainHistory
            clientId={clientId}
            selectedSourceId={prefill?.sourceId ?? null}
            onPick={(appt) => void applyBookAgain(appt)}
            variant="sidebar"
          />
        </aside>
      </div>

      {bookAgainOpen && (
        <div className="fixed inset-0 z-[160] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-sm md:hidden">
          <div className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 max-h-[85vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 shrink-0">
              <h3 className="text-sm font-semibold text-slate-900">Book again</h3>
              <button
                type="button"
                onClick={() => setBookAgainOpen(false)}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-600"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="overflow-y-auto">
              <BookAgainHistory
                clientId={clientId}
                selectedSourceId={prefill?.sourceId ?? null}
                onPick={(appt) => void applyBookAgain(appt)}
                variant="panel"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

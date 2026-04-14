import { useMemo, useState } from 'react'
import BookAgainPickerModal from './BookAgainPickerModal'
import { formatApiError, postBookAppointmentFromConversation, type ClientAppointment } from '../messagingApi'
import type { ConversationDetail } from '../messagingApi'

export type BookAppointmentDraft = {
  clientName: string
  appointmentAddress: string
  price: string
  date: string
  time: string
  notes: string
  size: string
  serviceType: '' | 'STANDARD' | 'DEEP' | 'MOVE_IN_OUT'
}

const sizeOptions = [
  '0-1000',
  '1000-1500',
  '1500-2000',
  '2000-2500',
  '2500-3000',
  '3000-3500',
  '3500-4000',
  '4000-4500',
  '4500-5000',
  '5000-5500',
  '5500-6000',
  '6000+',
]

type Props = {
  open: boolean
  conversationId: number
  detail: ConversationDetail | null
  draft: BookAppointmentDraft
  onDraftChange: (next: BookAppointmentDraft) => void
  onClose: () => void
  onCancel: () => void
  onBooked: () => Promise<void> | void
}

function todayIso(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function defaultDraft(): BookAppointmentDraft {
  return {
    clientName: '',
    appointmentAddress: '',
    price: '',
    date: '',
    time: '',
    notes: '',
    size: '',
    serviceType: '',
  }
}

export default function BookAppointmentModal({
  open,
  conversationId,
  detail,
  draft,
  onDraftChange,
  onClose,
  onCancel,
  onBooked,
}: Props) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attempted, setAttempted] = useState(false)
  const [bookAgainOpen, setBookAgainOpen] = useState(false)

  const clientLinked = Boolean(detail?.conversation.clientId)
  const clientId = detail?.client?.id ?? null

  const canBookAgain = clientLinked && clientId != null

  const headerName = detail?.client?.name ?? 'Unknown'
  const headerPhone = detail?.contactPoint.displayValue ?? detail?.contactPoint.value ?? ''

  const handlePickPrevious = (a: ClientAppointment) => {
    onDraftChange({
      ...draft,
      appointmentAddress: a.address ?? draft.appointmentAddress,
      serviceType: a.type,
      size: a.size ?? draft.size,
      price: String(a.price ?? ''),
      notes: a.notes ?? draft.notes,
    })
    setBookAgainOpen(false)
  }

  const missingClientName = !clientLinked && !draft.clientName.trim()
  const missingServiceType = !draft.serviceType
  const missingSize = !draft.size
  const missingPrice = !draft.price.trim()
  const missingAddress = !draft.appointmentAddress.trim()
  const missingDate = !draft.date
  const missingTime = !draft.time

  const fieldClass = (bad: boolean) =>
    [
      'mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2',
      bad ? 'border-red-400 focus:ring-red-500/15 focus:border-red-500' : 'border-slate-200 focus:ring-slate-900/10 focus:border-slate-300',
    ].join(' ')

  const submitDisabled = submitting

  const handleSubmit = async () => {
    setAttempted(true)
    setError(null)
    if (
      missingClientName ||
      missingServiceType ||
      missingSize ||
      missingPrice ||
      missingAddress ||
      missingDate ||
      missingTime
    ) {
      setError('Please fill out all required fields.')
      return
    }

    const priceNum = Number(draft.price)
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      setError('Price must be a positive number')
      return
    }

    setSubmitting(true)
    try {
      await postBookAppointmentFromConversation(conversationId, {
        ...(clientLinked ? {} : { clientName: draft.clientName.trim() }),
        appointmentAddress: draft.appointmentAddress.trim(),
        price: priceNum,
        date: draft.date,
        time: draft.time,
        notes: draft.notes.trim() ? draft.notes.trim() : undefined,
        size: draft.size,
        serviceType: draft.serviceType as any,
      })
      await onBooked()
      onClose()
    } catch (e) {
      console.error(e)
      const msg = formatApiError(e)
      setError(msg === 'SAME_DAY_APPOINT' ? 'This client already has an appointment on that date.' : msg)
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
        <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-900 truncate">{headerName}</h2>
              <p className="text-[11px] text-slate-400 truncate">{headerPhone}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full hover:bg-slate-100 active:bg-slate-200 text-slate-600"
              aria-label="Close"
              disabled={submitting}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7A1 1 0 0 0 5.7 7.11L10.59 12l-4.9 4.89a1 1 0 1 0 1.41 1.42L12 13.41l4.89 4.9a1 1 0 0 0 1.42-1.41L13.41 12l4.9-4.89a1 1 0 0 0-.01-1.4z" />
              </svg>
            </button>
          </div>

          <div className="px-5 py-4">
            {!clientLinked && (
              <div className="mb-4">
                <label className="block text-xs font-medium text-slate-700">
                  Client name <span className="text-red-600">*</span>
                </label>
                <input
                  value={draft.clientName}
                  onChange={(e) => onDraftChange({ ...draft, clientName: e.target.value })}
                  className={fieldClass(attempted && missingClientName)}
                  placeholder="e.g. Reem Witwit"
                  disabled={submitting}
                />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Service type <span className="text-red-600">*</span>
                </label>
                <select
                  value={draft.serviceType}
                  onChange={(e) =>
                    onDraftChange({ ...draft, serviceType: e.target.value as BookAppointmentDraft['serviceType'] })
                  }
                  className={fieldClass(attempted && missingServiceType) + ' bg-white'}
                  disabled={submitting}
                >
                  <option value="" disabled>
                    Select…
                  </option>
                  <option value="STANDARD">Standard</option>
                  <option value="DEEP">Deep</option>
                  <option value="MOVE_IN_OUT">Move in/out</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Size <span className="text-red-600">*</span>
                </label>
                <select
                  value={draft.size}
                  onChange={(e) => onDraftChange({ ...draft, size: e.target.value })}
                  className={fieldClass(attempted && missingSize) + ' bg-white'}
                  disabled={submitting}
                >
                  <option value="" disabled>
                    Select…
                  </option>
                  {sizeOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Price <span className="text-red-600">*</span>
                </label>
                <input
                  inputMode="decimal"
                  value={draft.price}
                  onChange={(e) => onDraftChange({ ...draft, price: e.target.value })}
                  className={fieldClass(attempted && missingPrice)}
                  placeholder="e.g. 360"
                  disabled={submitting}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-700">
                  Address <span className="text-red-600">*</span>
                </label>
                <input
                  value={draft.appointmentAddress}
                  onChange={(e) => onDraftChange({ ...draft, appointmentAddress: e.target.value })}
                  className={fieldClass(attempted && missingAddress)}
                  placeholder="e.g. 11584 Ashy Storm Ave, Las Vegas, NV 89138"
                  disabled={submitting}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Date <span className="text-red-600">*</span>
                </label>
                <input
                  type="date"
                  value={draft.date}
                  onChange={(e) => onDraftChange({ ...draft, date: e.target.value })}
                  className={fieldClass(attempted && missingDate)}
                  disabled={submitting}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Time <span className="text-red-600">*</span>
                </label>
                <input
                  type="time"
                  value={draft.time}
                  onChange={(e) => onDraftChange({ ...draft, time: e.target.value })}
                  className={fieldClass(attempted && missingTime)}
                  disabled={submitting}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-700">Notes</label>
                <textarea
                  value={draft.notes}
                  onChange={(e) => onDraftChange({ ...draft, notes: e.target.value })}
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 resize-none"
                  placeholder="Optional"
                  disabled={submitting}
                />
              </div>
            </div>

            {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
          </div>

          <div className="px-5 py-4 border-t border-slate-200 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setBookAgainOpen(true)}
              className={`inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium shadow-sm border ${
                canBookAgain
                  ? 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50 active:bg-slate-100'
                  : 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
              }`}
              disabled={!canBookAgain || submitting}
            >
              Book again
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50 active:bg-slate-100"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitDisabled}
                className={`inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm ${
                  submitting
                    ? 'bg-slate-400 text-white cursor-not-allowed'
                    : 'bg-slate-900 text-white hover:bg-slate-800'
                }`}
              >
                {submitting ? 'Booking…' : 'Book'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {canBookAgain && clientId != null && (
        <BookAgainPickerModal
          open={bookAgainOpen}
          clientId={clientId}
          onClose={() => setBookAgainOpen(false)}
          onPick={handlePickPrevious}
        />
      )}
    </>
  )
}


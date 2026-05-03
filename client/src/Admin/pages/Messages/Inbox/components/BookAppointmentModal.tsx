import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BookAgainPickerModal from './BookAgainPickerModal'
import {
  formatApiError,
  postBookAppointmentFromConversation,
  postBookAppointmentFromScreenshot,
  type ClientAppointment,
} from '../messagingApi'
import { useBookAppointmentDrafts } from '../../BookAppointmentDraftsContext'
import type { ConversationDetail } from '../messagingApi'

export type BookAppointmentDraft = {
  clientName: string
  /** Required when booking from screenshots (outside CRM thread). */
  clientPhone: string
  appointmentAddress: string
  price: string
  date: string
  time: string
  notes: string
  /** When true, server allows booking a slot already in the past (business timezone). */
  datePastOverride: boolean
  size: string
  serviceType: '' | 'STANDARD' | 'DEEP' | 'MOVE_IN_OUT'
}

export type BookAppointmentFieldHighlightKey =
  | 'clientName'
  | 'clientPhone'
  | 'appointmentAddress'
  | 'price'
  | 'date'
  | 'time'
  | 'notes'
  | 'size'
  | 'serviceType'

export type BookAppointmentHighlightState = {
  fieldHighlights: Partial<Record<BookAppointmentFieldHighlightKey, 'ai_missing' | 'lookup_failed'>>
  notFoundNotes: string[]
  sizeLookupFailed: boolean
}

/** Matches server bookings (`DEFAULT_APPOINTMENT_TIMEZONE` / `isAppointmentInPast`). */
const APPOINTMENT_BUSINESS_TZ = 'America/Los_Angeles'

/**
 * True when date + time (interpreted as wall clock in Pacific) are at or before "now" in that zone.
 * Uses the same ordering as the server past-date guard (no extra dependencies).
 */
function isBookingSlotPastInBusinessTz(dateStr: string, timeStr: string, now: Date = new Date()): boolean {
  const ds = dateStr.trim()
  const ts = timeStr.trim()
  const tm = ts.match(/^(\d{1,2}):(\d{2})$/)
  if (!tm || !/^\d{4}-\d{2}-\d{2}$/.test(ds)) return false
  const hour = parseInt(tm[1], 10)
  const minute = parseInt(tm[2], 10)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return false
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return false

  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: APPOINTMENT_BUSINESS_TZ,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const parts = fmt.formatToParts(now)
  const take = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? ''
  const y = take('year')
  const mo = take('month').padStart(2, '0')
  const d = take('day').padStart(2, '0')
  const h = take('hour').padStart(2, '0')
  const min = take('minute').padStart(2, '0')
  const nowKey = `${y}-${mo}-${d}T${h}:${min}`
  const schedKey = `${ds}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
  return schedKey <= nowKey
}

/** HTML time input values (24h) for quick-fill buttons */
const DEFAULT_TIME_MORNING = '09:00'
const DEFAULT_TIME_AFTERNOON = '14:00'

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
  /** AI extraction: highlight required fields the model could not infer (or size lookup failed). */
  highlights?: BookAppointmentHighlightState | null
  /** `inline` = panel next to chat (no full-screen overlay). */
  variant?: 'modal' | 'inline'
  /** Screenshot flow: book via phone + name, no conversation. */
  bookingSource?: 'conversation' | 'screenshot'
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
    clientPhone: '',
    appointmentAddress: '',
    price: '',
    date: '',
    time: '',
    notes: '',
    datePastOverride: false,
    size: '',
    serviceType: '',
  }
}

export default function BookAppointmentModal({
  open,
  conversationId,
  detail,
  draft,
  highlights,
  variant = 'modal',
  bookingSource = 'conversation',
  onDraftChange,
  onClose,
  onCancel,
  onBooked,
}: Props) {
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attempted, setAttempted] = useState(false)
  const [bookAgainOpen, setBookAgainOpen] = useState(false)
  const [pastSlotAlertOpen, setPastSlotAlertOpen] = useState(false)

  const { bookingScreenshotUrlsByConversationId } = useBookAppointmentDrafts()
  const bookingScreenshotUrls = bookingScreenshotUrlsByConversationId[conversationId] ?? []

  useEffect(() => {
    setPastSlotAlertOpen(false)
  }, [open, conversationId])

  const isScreenshot = bookingSource === 'screenshot'
  const clientLinked = !isScreenshot && Boolean(detail?.conversation.clientId)
  const clientId = detail?.client?.id ?? null

  const canBookAgain = clientLinked && clientId != null

  const headerName = isScreenshot
    ? draft.clientName.trim() || 'Screenshot booking'
    : detail?.client?.name ?? 'Unknown'
  const headerPhone = isScreenshot
    ? draft.clientPhone.trim() || 'Phone from form'
    : detail?.contactPoint.displayValue ?? detail?.contactPoint.value ?? ''

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
  const missingClientPhone = isScreenshot && !draft.clientPhone.trim()
  const missingServiceType = !draft.serviceType
  const missingSize = !draft.size
  const missingPrice = !draft.price.trim()
  const missingAddress = !draft.appointmentAddress.trim()
  const missingDate = !draft.date
  const missingTime = !draft.time

  const fieldClass = (bad: boolean, fieldKey?: BookAppointmentFieldHighlightKey) => {
    const h = fieldKey ? highlights?.fieldHighlights[fieldKey] : undefined
    const aiBad = h === 'ai_missing' || h === 'lookup_failed'
    const show = bad || aiBad
    const lookupFail = fieldKey === 'size' && h === 'lookup_failed'
    return [
      'mt-1 w-full min-w-0 max-w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 box-border',
      show
        ? lookupFail
          ? 'border-red-600 ring-1 ring-red-400 focus:ring-red-500/25 focus:border-red-600'
          : 'border-red-400 focus:ring-red-500/15 focus:border-red-500'
        : 'border-slate-200 focus:ring-slate-900/10 focus:border-slate-300',
    ].join(' ')
  }

  const submitDisabled = submitting

  const handleSubmit = async () => {
    setAttempted(true)
    setError(null)
    if (
      missingClientName ||
      missingClientPhone ||
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

    if (isBookingSlotPastInBusinessTz(draft.date, draft.time) && !draft.datePastOverride) {
      setPastSlotAlertOpen(true)
      return
    }

    setSubmitting(true)
    try {
      const screenshotPayload =
        bookingScreenshotUrls.length > 0 ? { bookingScreenshotUrls } : undefined
      console.log('[BookAppointmentModal] submit', {
        conversationId,
        bookingSource,
        isScreenshot,
        clientLinked,
        draft: {
          clientName: draft.clientName.trim() || undefined,
          hasPhone: Boolean(draft.clientPhone.trim()),
          appointmentAddress: draft.appointmentAddress.trim() ? '[set]' : '',
          price: draft.price,
          date: draft.date,
          time: draft.time,
          size: draft.size,
          serviceType: draft.serviceType,
        },
        userIdHeader: (() => {
          try {
            return localStorage.getItem('userId')
          } catch {
            return null
          }
        })(),
      })
      if (isScreenshot) {
        const bookRes = await postBookAppointmentFromScreenshot({
          phoneRaw: draft.clientPhone.trim(),
          clientName: draft.clientName.trim(),
          appointmentAddress: draft.appointmentAddress.trim(),
          price: priceNum,
          date: draft.date,
          time: draft.time,
          notes: draft.notes.trim() ? draft.notes.trim() : undefined,
          size: draft.size,
          serviceType: draft.serviceType as any,
          ...(draft.datePastOverride ? { datePastOverride: true } : {}),
          ...screenshotPayload,
        })
        /** Clear screenshot page state before navigating away so unmount does not skip cleanup. */
        await onBooked()
        const appt = bookRes.appointment as { id?: number; date?: string }
        const apptId = typeof appt?.id === 'number' ? appt.id : undefined
        let dateForCalendar = draft.date
        if (typeof appt?.date === 'string') {
          dateForCalendar = appt.date.split('T')[0]
        }
        if (apptId != null && dateForCalendar) {
          navigate(`/dashboard/calendar?date=${encodeURIComponent(dateForCalendar)}&appt=${apptId}`)
        }
      } else {
        await postBookAppointmentFromConversation(conversationId, {
          ...(clientLinked ? {} : { clientName: draft.clientName.trim() }),
          appointmentAddress: draft.appointmentAddress.trim(),
          price: priceNum,
          date: draft.date,
          time: draft.time,
          notes: draft.notes.trim() ? draft.notes.trim() : undefined,
          size: draft.size,
          serviceType: draft.serviceType as any,
          ...(draft.datePastOverride ? { datePastOverride: true } : {}),
          ...screenshotPayload,
        })
      }
      if (!isScreenshot) {
        await onBooked()
      }
      onClose()
    } catch (e) {
      console.error('[BookAppointmentModal] submit failed', e)
      const msg = formatApiError(e)
      if (msg === 'PAST_APPOINTMENT_DATE') {
        setPastSlotAlertOpen(true)
      } else {
        setError(msg === 'SAME_DAY_APPOINT' ? 'This client already has an appointment on that date.' : msg)
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  const isInline = variant === 'inline'

  const shell = (
    <div
      className={
        isInline
          ? 'flex flex-col h-full min-h-0 max-h-full w-full min-w-0 max-w-full bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden overflow-x-hidden'
          : 'w-full min-w-0 max-w-2xl rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 overflow-hidden overflow-x-hidden max-h-[min(92vh,900px)] flex flex-col'
      }
    >
          <div className="flex min-w-0 items-center justify-between gap-2 px-3 py-4 sm:px-5 border-b border-slate-200 shrink-0">
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold text-slate-900 truncate">{headerName}</h2>
              <p className="text-[11px] text-slate-400 truncate">{headerPhone}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 p-2 rounded-full hover:bg-slate-100 active:bg-slate-200 text-slate-600"
              aria-label="Close"
              disabled={submitting}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7A1 1 0 0 0 5.7 7.11L10.59 12l-4.9 4.89a1 1 0 1 0 1.41 1.42L12 13.41l4.89 4.9a1 1 0 0 0 1.42-1.41L13.41 12l4.9-4.89a1 1 0 0 0-.01-1.4z" />
              </svg>
            </button>
          </div>

          <div
            className={`min-w-0 px-3 py-4 sm:px-5 ${
              isInline
                ? 'flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain'
                : 'overflow-y-auto overflow-x-hidden max-h-[min(70vh,560px)]'
            }`}
          >
            {highlights?.notFoundNotes && highlights.notFoundNotes.length > 0 && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950 break-words">
                <span className="font-medium">Could not infer: </span>
                {highlights.notFoundNotes.join('; ')}
              </div>
            )}
            {!clientLinked && (
              <div className="mb-4">
                <label className="block text-xs font-medium text-slate-700">
                  Client name <span className="text-red-600">*</span>
                </label>
                <input
                  value={draft.clientName}
                  onChange={(e) => onDraftChange({ ...draft, clientName: e.target.value })}
                  className={fieldClass(attempted && missingClientName, 'clientName')}
                  placeholder="e.g. Reem Witwit"
                  disabled={submitting}
                />
              </div>
            )}
            {isScreenshot && (
              <div className="mb-4">
                <label className="block text-xs font-medium text-slate-700">
                  Phone <span className="text-red-600">*</span>
                </label>
                <input
                  value={draft.clientPhone}
                  onChange={(e) => onDraftChange({ ...draft, clientPhone: e.target.value })}
                  className={fieldClass(attempted && missingClientPhone, 'clientPhone')}
                  placeholder="e.g. (702) 555-1234"
                  inputMode="tel"
                  autoComplete="tel"
                  disabled={submitting}
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  We match or create the client by this number when you book.
                </p>
              </div>
            )}

            <div className="grid min-w-0 grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Service type <span className="text-red-600">*</span>
                </label>
                <select
                  value={draft.serviceType}
                  onChange={(e) =>
                    onDraftChange({ ...draft, serviceType: e.target.value as BookAppointmentDraft['serviceType'] })
                  }
                  className={fieldClass(attempted && missingServiceType, 'serviceType') + ' bg-white'}
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
                  className={fieldClass(attempted && missingSize, 'size') + ' bg-white'}
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
                  className={fieldClass(attempted && missingPrice, 'price')}
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
                  className={fieldClass(attempted && missingAddress, 'appointmentAddress')}
                  placeholder="e.g. 11584 Ashy Storm Ave, Las Vegas, NV 89138"
                  disabled={submitting}
                />
              </div>

              <div className="min-w-0 max-w-full">
                <label className="block text-xs font-medium text-slate-700">
                  Date <span className="text-red-600">*</span>
                </label>
                <input
                  type="date"
                  value={draft.date}
                  onChange={(e) => onDraftChange({ ...draft, date: e.target.value })}
                  className={`${fieldClass(attempted && missingDate, 'date')} block max-w-full appearance-none [font-size:16px] sm:text-sm`}
                  disabled={submitting}
                />
              </div>

              <div className="min-w-0 max-w-full">
                <label className="block text-xs font-medium text-slate-700">
                  Time <span className="text-red-600">*</span>
                </label>
                <input
                  type="time"
                  value={draft.time}
                  onChange={(e) => onDraftChange({ ...draft, time: e.target.value })}
                  className={`${fieldClass(attempted && missingTime, 'time')} block max-w-full appearance-none [font-size:16px] sm:text-sm`}
                  disabled={submitting}
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onDraftChange({ ...draft, time: DEFAULT_TIME_MORNING })}
                    disabled={submitting}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 active:bg-slate-100 disabled:opacity-50"
                  >
                    9:00 AM
                  </button>
                  <button
                    type="button"
                    onClick={() => onDraftChange({ ...draft, time: DEFAULT_TIME_AFTERNOON })}
                    disabled={submitting}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 active:bg-slate-100 disabled:opacity-50"
                  >
                    2:00 PM
                  </button>
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-700">Notes</label>
                <textarea
                  value={draft.notes}
                  onChange={(e) => onDraftChange({ ...draft, notes: e.target.value })}
                  rows={3}
                  className="mt-1 w-full min-w-0 max-w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 resize-none"
                  placeholder="Optional"
                  disabled={submitting}
                />
                <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm text-slate-800">
                  <input
                    type="checkbox"
                    checked={draft.datePastOverride}
                    onChange={(e) => onDraftChange({ ...draft, datePastOverride: e.target.checked })}
                    disabled={submitting}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-slate-900 focus:ring-slate-900/20"
                  />
                  <span>
                    <span className="font-medium">Date override</span>
                    <span className="mt-0.5 block text-xs font-normal text-slate-500">
                      Allow booking when the scheduled date and time are already in the past (Pacific). Use only when
                      intentional or extraction was wrong.
                    </span>
                  </span>
                </label>
              </div>
            </div>

            {error && <p className="mt-3 text-sm text-red-700 break-words">{error}</p>}
          </div>

          <div className="min-w-0 px-3 py-4 sm:px-5 border-t border-slate-200 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between shrink-0 bg-white">
            <button
              type="button"
              onClick={() => setBookAgainOpen(true)}
              className={`inline-flex w-full sm:w-auto min-w-0 items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium shadow-sm border shrink-0 ${
                canBookAgain
                  ? 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50 active:bg-slate-100'
                  : 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
              }`}
              disabled={!canBookAgain || submitting}
            >
              Book again
            </button>
            <div className="flex min-w-0 items-stretch sm:items-center justify-end gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex flex-1 sm:flex-initial min-w-0 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 sm:px-4 py-2.5 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50 active:bg-slate-100"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitDisabled}
                className={`inline-flex flex-1 sm:flex-initial min-w-0 items-center justify-center rounded-xl px-3 sm:px-4 py-2.5 text-sm font-semibold shadow-sm ${
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
  )

  return (
    <>
      {isInline ? (
        shell
      ) : (
        <div className="fixed inset-0 z-[150] flex items-center justify-center overflow-x-hidden overflow-y-auto p-4 bg-slate-900/50 backdrop-blur-sm">
          {shell}
        </div>
      )}

      {canBookAgain && clientId != null && (
        <BookAgainPickerModal
          open={bookAgainOpen}
          clientId={clientId}
          onClose={() => setBookAgainOpen(false)}
          onPick={handlePickPrevious}
        />
      )}

      {pastSlotAlertOpen ? (
        <div
          className="fixed inset-0 z-[180] flex items-center justify-center overflow-y-auto p-4 bg-slate-900/60 backdrop-blur-sm"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="past-slot-alert-title"
          aria-describedby="past-slot-alert-desc"
        >
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl ring-2 ring-red-200">
            <div className="border-b border-red-100 bg-red-50 px-5 py-4 rounded-t-2xl">
              <h3 id="past-slot-alert-title" className="text-lg font-semibold text-red-950">
                This appointment is in the past
              </h3>
            </div>
            <div className="px-5 py-4">
              <p id="past-slot-alert-desc" className="text-sm leading-relaxed text-slate-700">
                The date and time you entered are <span className="font-semibold text-slate-900">already over</span> in
                the business timezone (Pacific). The booking was not sent.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-slate-700">
                <span className="font-medium text-slate-900">What you can do:</span>
              </p>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-slate-700">
                <li>Pick a <strong>future</strong> date and/or time, then tap Book again, or</li>
                <li>
                  Scroll to <strong>Date override</strong> below Notes, check that box, then Book — only if you
                  intentionally need this past slot.
                </li>
              </ul>
            </div>
            <div className="border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={() => setPastSlotAlertOpen(false)}
                className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 active:bg-slate-950"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}


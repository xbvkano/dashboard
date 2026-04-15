import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Coupon, FormData } from '../../../../../external_prisma_schemas/website_schema'
import { formatPhone } from '../../../../../formatPhone'
import { API_BASE_URL, withApiAuth } from '../../../../../api'
import { buildDefaultFormMessage } from '../leadMessageDefaults'
import LeadMessageModal from './LeadMessageModal'
import { startConversationFromContact } from '../../Inbox/messagingApi'

interface FormCardProps {
  form: FormData
  onMarkVisited?: () => void
}

function formatDate(value: string | Date): string {
  const d = new Date(value as string)
  if (isNaN(d.getTime())) return String(value)
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  })
}

function toE164(digits: string): string | null {
  if (digits.length === 10) return '1' + digits
  if (digits.length === 11 && digits.startsWith('1')) return digits
  return null
}

function formatCouponValue(c: Coupon): string {
  if (c.type === 'percent') return `${c.value}% off`
  if (c.type === 'flat') return `$${c.value} off`
  return c.value
}

function formatCouponExpire(value: Date | string): string {
  const d = new Date(value as string)
  if (isNaN(d.getTime())) return String(value)
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function FormCard({ form, onMarkVisited }: FormCardProps) {
  const navigate = useNavigate()
  const [messageOpen, setMessageOpen] = useState(false)
  const [textBusy, setTextBusy] = useState(false)
  const defaultMessageText = useMemo(() => buildDefaultFormMessage(form), [form])
  const digits = (form.number || '').replace(/\D/g, '')
  const e164 = toE164(digits)
  const hasPhone = !!e164
  const isUnvisited = form.visited === false

  function markVisitedIfNeeded() {
    if (!isUnvisited || !onMarkVisited) return
    onMarkVisited()
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (import.meta.env.VITE_NGROK === 'true' || import.meta.env.VITE_NGROK === '1') {
      headers['ngrok-skip-browser-warning'] = '1'
    }
    fetch(`${API_BASE_URL}/api/quotes/${form.id}`, withApiAuth({
      method: 'PATCH',
      headers,
      body: JSON.stringify({ visited: true }),
      keepalive: true,
    })).catch(() => {})
  }

  async function handleOpenInboxText() {
    if (!hasPhone || !e164 || textBusy) return
    markVisitedIfNeeded()
    setTextBusy(true)
    try {
      const phoneRaw = `+${e164}`
      const nameTrim = form.name?.trim() ?? ''
      const notes =
        nameTrim && form.address?.trim()
          ? `Lead form · ${form.address.trim()}`
          : undefined
      const out = await startConversationFromContact({
        phoneRaw,
        name: nameTrim || undefined,
        notes,
        clientFrom: 'Form',
      })
      navigate(`/dashboard/messages/inbox?conversation=${out.conversationId}`)
    } catch (e) {
      console.error(e)
    } finally {
      setTextBusy(false)
    }
  }

  return (
    <article
      className={`rounded-xl border shadow-sm overflow-hidden hover:shadow-md transition-shadow ${
        isUnvisited
          ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-200/50'
          : 'bg-white border-slate-200'
      }`}
    >
      <div className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-slate-900 truncate">{form.name}</h3>
            <p className="text-sm text-slate-600 mt-0.5">{formatPhone(form.number)}</p>
            <p className="text-sm text-slate-500 mt-1 truncate">{form.address}</p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0 justify-end sm:justify-start">
            {hasPhone && (
              <button
                type="button"
                onClick={() => void handleOpenInboxText()}
                disabled={textBusy}
                className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg active:opacity-90 disabled:opacity-60"
              >
                {textBusy ? 'Opening…' : 'Text'}
              </button>
            )}
            <button
              type="button"
              onClick={() => setMessageOpen(true)}
              className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg active:opacity-90"
            >
              Default message
            </button>
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-sm">
          <div>
            <dt className="text-slate-500">Date</dt>
            <dd className="font-medium text-slate-800">{form.date}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Service</dt>
            <dd className="font-medium text-slate-800">{form.service}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Size</dt>
            <dd className="font-medium text-slate-800">{form.size}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Price</dt>
            <dd className="font-medium text-slate-800">${form.price}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Carpet rooms</dt>
            <dd className="font-medium text-slate-800">{form.carpetShampooRooms}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Source</dt>
            <dd className="font-medium text-slate-800">{form.otherSource || form.source}</dd>
          </div>
        </dl>

        {form.coupon && (
          <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/90 px-3 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Coupon</p>
            <p className="text-sm font-semibold text-emerald-950 mt-0.5">{form.coupon.name}</p>
            <p className="text-sm text-emerald-800 mt-0.5">
              {formatCouponValue(form.coupon)}
              <span className="text-emerald-700">
                {' · '}
                Expires {formatCouponExpire(form.coupon.expireDate)}
                {' · '}
                {form.coupon.useCount} {form.coupon.useCount === 1 ? 'use' : 'uses'}
              </span>
            </p>
          </div>
        )}

        {(form.baseboards || form.fridgeInside || form.ovenInside) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {form.baseboards && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                Baseboards
              </span>
            )}
            {form.fridgeInside && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                Fridge inside
              </span>
            )}
            {form.ovenInside && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                Oven inside
              </span>
            )}
          </div>
        )}

        {form.blacklist && (
          <span className="mt-2 inline-block px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
            Blacklisted
          </span>
        )}

        <p className="mt-3 text-xs text-slate-400">
          Submitted {formatDate(form.dateCreated)}
        </p>
      </div>

      <LeadMessageModal
        open={messageOpen}
        onClose={() => setMessageOpen(false)}
        defaultText={defaultMessageText}
        title="Default message"
      />
    </article>
  )
}

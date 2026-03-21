import type { FormData } from '../../../../../external_prisma_schemas/website_schema'
import { formatPhone } from '../../../../../formatPhone'
import { API_BASE_URL } from '../../../../../api'

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

export default function FormCard({ form, onMarkVisited }: FormCardProps) {
  const digits = (form.number || '').replace(/\D/g, '')
  const e164 = toE164(digits)
  const hasPhone = !!e164
  const isUnvisited = form.visited === false

  function handlePhoneAction(url: string) {
    if (isUnvisited && onMarkVisited) {
      onMarkVisited()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (import.meta.env.VITE_NGROK === 'true' || import.meta.env.VITE_NGROK === '1') {
        headers['ngrok-skip-browser-warning'] = '1'
      }
      fetch(`${API_BASE_URL}/api/quotes/${form.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ visited: true }),
        keepalive: true,
      }).catch(() => {})
    }
    window.location.href = url
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
          {hasPhone && (
            <div className="flex gap-2 shrink-0 md:hidden">
              <button
                type="button"
                onClick={() => handlePhoneAction(`tel:+${e164}`)}
                className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg active:opacity-90"
              >
                Call
              </button>
              <button
                type="button"
                onClick={() => handlePhoneAction(`sms:+${e164}`)}
                className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg active:opacity-90"
              >
                Text
              </button>
            </div>
          )}
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
    </article>
  )
}

import type { Call } from '../../../../../external_prisma_schemas/website_schema'
import { formatPhone } from '../../../../../formatPhone'

interface CallCardProps {
  call: Call
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

export default function CallCard({ call }: CallCardProps) {
  const digits = (call.caller || '').replace(/\D/g, '')
  const e164 = toE164(digits)
  const hasPhone = !!e164

  return (
    <article className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      <div className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-slate-900 truncate">
              {formatPhone(call.caller)}
            </h3>
            <p className="text-sm text-slate-600 mt-0.5">Called: {formatPhone(call.called)}</p>
          </div>
          {hasPhone && (
            <div className="flex gap-2 shrink-0 md:hidden">
              <a
                href={`tel:+${e164}`}
                className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg active:opacity-90 no-underline"
              >
                Call
              </a>
              <a
                href={`sms:+${e164}`}
                className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg active:opacity-90 no-underline"
              >
                Text
              </a>
            </div>
          )}
        </div>

        <dl className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-sm">
          <div>
            <dt className="text-slate-500">Service</dt>
            <dd className="font-medium text-slate-800">{call.service}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Size</dt>
            <dd className="font-medium text-slate-800">{call.size}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Price</dt>
            <dd className="font-medium text-slate-800">
              {call.price != null ? `$${call.price}` : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Section</dt>
            <dd className="font-medium text-slate-800">{call.section || '—'}</dd>
          </div>
        </dl>

        <p className="mt-3 text-xs text-slate-400">
          {formatDate(call.createdAt)}
        </p>
      </div>
    </article>
  )
}

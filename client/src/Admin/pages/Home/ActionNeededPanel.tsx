import { Link } from 'react-router-dom'
import { messagesHomeHref } from '../../actionCounts'
import { useActionCounts } from '../../ActionCountsProvider'

function tileClass(tone: 'red' | 'blue' | 'green'): string {
  const base =
    'flex flex-col items-center justify-center rounded-2xl border-2 text-center transition-colors w-full min-h-[7.5rem] md:min-h-[14rem] px-4 py-4 md:px-6 md:py-7 shadow-md'
  if (tone === 'blue') {
    return `${base} bg-blue-50 border-blue-400 hover:border-blue-500 text-blue-800`
  }
  if (tone === 'green') {
    return `${base} bg-green-50 border-green-400 hover:border-green-500 text-green-800`
  }
  return `${base} bg-red-50 border-red-400 hover:border-red-500 text-red-800`
}

function GlanceTile({
  title,
  total,
  href,
  tone,
  breakdown,
}: {
  title: string
  total: number
  href: string
  tone: 'red' | 'blue' | 'green'
  breakdown: Array<{ label: string; count: number }>
}) {
  return (
    <Link to={href} className={tileClass(tone)} aria-label={`${title}: ${total} need attention`}>
      <span className="text-base md:text-2xl font-semibold tracking-wide uppercase">{title}</span>
      <span className="mt-1.5 md:mt-3 text-4xl md:text-7xl font-bold tabular-nums leading-none">{total}</span>
      <span className="mt-2 md:mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-sm md:text-xl font-medium tabular-nums">
        {breakdown.map((item) => (
          <span key={item.label}>
            {item.label} {item.count}
          </span>
        ))}
      </span>
    </Link>
  )
}

export default function ActionNeededPanel() {
  const { counts: value } = useActionCounts()
  const showMessages = value.messages.total > 0
  const showLeads = value.leads.total > 0
  if (!showMessages && !showLeads) return null

  const both = showMessages && showLeads
  return (
    <section
      className={`grid grid-cols-1 gap-3 md:gap-4 ${both ? 'md:grid-cols-2' : ''}`}
      aria-label="Action needed"
    >
      {showMessages && (
        <GlanceTile
          title="Messages"
          total={value.messages.total}
          href={messagesHomeHref(value.messages)}
          tone="green"
          breakdown={[
            { label: 'Client', count: value.messages.client },
            { label: 'Employee', count: value.messages.employee },
          ]}
        />
      )}
      {showLeads && (
        <GlanceTile
          title="Leads"
          total={value.leads.total}
          href="/dashboard/messages/leads"
          tone="blue"
          breakdown={[
            { label: 'Forms', count: value.leads.forms },
            { label: 'Calls', count: value.leads.calls },
          ]}
        />
      )}
    </section>
  )
}

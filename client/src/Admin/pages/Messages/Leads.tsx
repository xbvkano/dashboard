import { useEffect, useState } from 'react'
import { API_BASE_URL, fetchJson } from '../../../api'
import FormList from './Leads/components/FormList'
import CallList from './Leads/components/CallList'

function toYYYYMMDD(d: Date) {
  return d.toISOString().slice(0, 10)
}

type LeadsTab = 'forms' | 'calls'

export default function Leads() {
  const [sources, setSources] = useState<string[]>([])
  const [sections, setSections] = useState<string[]>([])
  const [mobileTab, setMobileTab] = useState<LeadsTab>('forms')

  useEffect(() => {
    const end = new Date()
    const start = new Date()
    start.setFullYear(start.getFullYear() - 1)
    const params = `startDate=${toYYYYMMDD(start)}&endDate=${toYYYYMMDD(end)}`
    fetchJson<{
      quotes?: { bySource?: Array<{ source: string }> }
      calls?: { bySection?: Array<{ section: string }> }
    }>(`${API_BASE_URL}/api/stats?${params}`)
      .then((res) => {
        setSources((res.quotes?.bySource ?? []).map((s) => s.source).filter(Boolean))
        const fromStats = (res.calls?.bySection ?? []).map((s) => s.section).filter(Boolean)
        if (fromStats.length > 0) {
          setSections(fromStats)
        } else {
          // Fallback: derive sections from calls when stats doesn't return bySection
          fetchJson<{ data?: Array<{ section?: string }> }>(
            `${API_BASE_URL}/api/calls?count=500&offset=0&${params}`
          )
            .then((callsRes) => {
              const seen = new Set<string>()
              for (const c of callsRes.data ?? []) {
                if (c.section) seen.add(c.section)
              }
              setSections([...seen].sort())
            })
            .catch(() => {})
        }
      })
      .catch(() => {})
  }, [])

  return (
    <div className="p-2 md:p-3 flex flex-col h-[calc(100dvh-3.5rem)] md:h-[calc(100dvh-3.5rem)] min-h-0">
      <h2 className="text-xl font-semibold text-slate-900 mb-2 shrink-0">Leads</h2>

      {/* Mobile: switch between Forms and Calls */}
      <div className="md:hidden mb-2 shrink-0 flex gap-0 rounded-lg border border-slate-300 overflow-hidden">
        <button
          type="button"
          onClick={() => setMobileTab('forms')}
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
            mobileTab === 'forms'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          Forms
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('calls')}
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
            mobileTab === 'calls'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          Calls
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4 flex-1 min-h-0">
        <div className={`flex flex-col min-h-0 ${mobileTab !== 'forms' ? 'hidden md:flex' : ''}`}>
          <FormList sources={sources} />
        </div>
        <div className={`flex flex-col min-h-0 ${mobileTab !== 'calls' ? 'hidden md:flex' : ''}`}>
          <CallList sections={sections} />
        </div>
      </div>
    </div>
  )
}

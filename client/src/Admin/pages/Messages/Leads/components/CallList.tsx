import { useEffect, useState } from 'react'
import { API_BASE_URL, fetchJson } from '../../../../../api'
import type { Call } from '../../../../../external_prisma_schemas/website_schema'
import CallCard from './CallCard'

const CARDS_PER_PAGE = 5
const INITIAL_PAGES = 4
const FETCH_COUNT = CARDS_PER_PAGE * INITIAL_PAGES

interface CallsResponse {
  data: Call[]
  total: number
  hasMore: boolean
  nextOffset: number | null
}

interface CallListProps {
  sections?: string[]
}

export default function CallList({ sections = [] }: CallListProps) {
  const [items, setItems] = useState<Call[]>([])
  const [total, setTotal] = useState(0)
  const [nextOffset, setNextOffset] = useState<number | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [sectionFilter, setSectionFilter] = useState<string>('')

  const totalPages = Math.max(1, Math.ceil(total / CARDS_PER_PAGE))
  const pageItems = items.slice(
    (currentPage - 1) * CARDS_PER_PAGE,
    currentPage * CARDS_PER_PAGE
  )

  function fetchPage(offset: number) {
    if (loading) return
    setLoading(true)
    const params = new URLSearchParams({
      count: String(FETCH_COUNT),
      offset: String(offset),
    })
    if (sectionFilter) params.set('section', sectionFilter)
    const url = `${API_BASE_URL}/api/calls?${params}`
    fetchJson<CallsResponse>(url)
      .then((res) => {
        const list = res.data ?? []
        setItems((prev) => (offset === 0 ? list : [...prev, ...list]))
        setTotal(res.total ?? list.length)
        setNextOffset(res.nextOffset ?? null)
      })
      .catch((err) => {
        console.error('Failed to fetch calls:', err)
        setItems([])
        setTotal(0)
        setNextOffset(null)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    setItems([])
    setNextOffset(null)
    setCurrentPage(1)
    fetchPage(0)
  }, [sectionFilter])

  useEffect(() => {
    const needIndex = currentPage * CARDS_PER_PAGE - 1
    if (
      currentPage > INITIAL_PAGES &&
      needIndex >= items.length &&
      nextOffset != null &&
      !loading
    ) {
      fetchPage(nextOffset)
    }
  }, [currentPage, items.length, nextOffset, loading])

  return (
    <section className="flex flex-col min-h-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 shrink-0 space-y-2">
        <h3 className="text-lg font-semibold text-slate-800">Calls</h3>
        <select
          value={sectionFilter}
          onChange={(e) => setSectionFilter(e.target.value)}
          className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        >
          <option value="">All sections</option>
          {(sections ?? []).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div className="flex-1 overflow-y-auto overscroll-contain min-h-0">
        <div className="p-4 space-y-4">
          {loading && items.length === 0 ? (
            <div className="p-8 text-center text-slate-500">Loading…</div>
          ) : pageItems.length === 0 ? (
            <div className="p-8 text-center text-slate-500">No calls yet</div>
          ) : (
            pageItems.map((call) => <CallCard key={call.id} call={call} />)
          )}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-slate-200 shrink-0">
        <button
          type="button"
          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          disabled={currentPage <= 1}
          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Prev
        </button>
        <span className="text-sm text-slate-600">
          Page {currentPage} of {totalPages}
          {total > 0 && (
            <span className="ml-1 text-slate-400">({total} total)</span>
          )}
        </span>
        <button
          type="button"
          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          disabled={currentPage >= totalPages}
          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </section>
  )
}

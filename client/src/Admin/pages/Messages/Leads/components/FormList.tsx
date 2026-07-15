import { useEffect, useMemo, useState } from 'react'
import { API_BASE_URL, fetchJson } from '../../../../../api'
import type { FormData } from '../../../../../external_prisma_schemas/website_schema'
import FormCard from './FormCard'

const CARDS_PER_PAGE = 5
const INITIAL_PAGES = 4
const FETCH_COUNT = CARDS_PER_PAGE * INITIAL_PAGES
const SEARCH_FETCH_COUNT = 500

interface QuotesResponse {
  data: FormData[]
  total: number
  hasMore: boolean
  nextOffset: number | null
}

interface FormListProps {
  sources?: string[]
}

export default function FormList({ sources = [] }: FormListProps) {
  const [items, setItems] = useState<FormData[]>([])
  const [total, setTotal] = useState(0)
  const [nextOffset, setNextOffset] = useState<number | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [sourceFilter, setSourceFilter] = useState<string>('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const filteredItems = useMemo(() => {
    if (!debouncedSearch) return items
    const q = debouncedSearch.toLowerCase()
    return items.filter((f) => (f.name || '').toLowerCase().includes(q))
  }, [items, debouncedSearch])

  const displayTotal = debouncedSearch ? filteredItems.length : total
  const totalPages = Math.max(1, Math.ceil(displayTotal / CARDS_PER_PAGE))
  const pageItems = filteredItems.slice(
    (currentPage - 1) * CARDS_PER_PAGE,
    currentPage * CARDS_PER_PAGE
  )

  function fetchPage(offset: number) {
    if (loading) return
    setLoading(true)
    const count = debouncedSearch ? SEARCH_FETCH_COUNT : FETCH_COUNT
    const params = new URLSearchParams({
      count: String(count),
      offset: String(offset),
    })
    if (sourceFilter) params.set('source', sourceFilter)
    const url = `${API_BASE_URL}/api/quotes?${params}`
    fetchJson<QuotesResponse>(url)
      .then((res) => {
        const list = res.data ?? []
        setItems((prev) => (offset === 0 ? list : [...prev, ...list]))
        setTotal(res.total ?? list.length)
        setNextOffset(res.nextOffset ?? null)
      })
      .catch((err) => {
        console.error('Failed to fetch forms:', err)
        setItems([])
        setTotal(0)
        setNextOffset(null)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => window.clearTimeout(timeout)
  }, [search])

  useEffect(() => {
    setItems([])
    setNextOffset(null)
    setCurrentPage(1)
    fetchPage(0)
  }, [sourceFilter, debouncedSearch])

  useEffect(() => {
    if (debouncedSearch) return
    const needIndex = currentPage * CARDS_PER_PAGE - 1
    if (
      currentPage > INITIAL_PAGES &&
      needIndex >= items.length &&
      nextOffset != null &&
      !loading
    ) {
      fetchPage(nextOffset)
    }
  }, [currentPage, items.length, nextOffset, loading, debouncedSearch])

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(displayTotal / CARDS_PER_PAGE))
    if (currentPage > maxPage) setCurrentPage(maxPage)
  }, [displayTotal, currentPage])

  return (
    <section className="flex flex-col flex-1 min-h-0 h-full bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 shrink-0 space-y-2">
        <h3 className="text-lg font-semibold text-slate-800">Form submissions</h3>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search leads by name"
            aria-label="Search form leads by name"
            className="w-full sm:flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="w-full sm:w-auto sm:max-w-xs rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All sources</option>
            {(sources ?? []).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto overscroll-contain min-h-0">
        <div className="p-4 space-y-4">
          {loading && items.length === 0 ? (
            <div className="p-8 text-center text-slate-500">Loading…</div>
          ) : pageItems.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              {debouncedSearch ? 'No leads match that name' : 'No form submissions yet'}
            </div>
          ) : (
            pageItems.map((form) => (
              <FormCard
                key={form.id}
                form={form}
                onMarkVisited={() =>
                  setItems((prev) =>
                    prev.map((f) => (f.id === form.id ? { ...f, visited: true } : f))
                  )
                }
              />
            ))
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
          {displayTotal > 0 && (
            <span className="ml-1 text-slate-400">
              ({displayTotal} total)
            </span>
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

import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Employee } from './types'
import { API_BASE_URL, fetchJson } from '../../../../api'
import { formatPhone } from '../../../../formatPhone'
import EmployeeCodeBadge from '../../../components/EmployeeCodeBadge'

const PAGE_SIZE = 20

function dedupeEmployees(rows: Employee[]): Employee[] {
  const seen = new Set<number>()
  return rows.filter((c) => {
    if (c.id === undefined) return false
    if (seen.has(c.id)) return false
    seen.add(c.id)
    return true
  })
}

export default function EmployeeList() {
  const [items, setItems] = useState<Employee[]>([])
  const [search, setSearch] = useState('')
  const loader = useRef<HTMLDivElement | null>(null)
  const skipRef = useRef(0)
  const loadingRef = useRef(false)
  const hasMoreRef = useRef(true)
  const searchRef = useRef(search)
  const reqIdRef = useRef(0)

  const loadPage = useCallback(async (reset: boolean) => {
    if (!reset && loadingRef.current) return
    if (!reset && !hasMoreRef.current) return

    const reqId = reset ? ++reqIdRef.current : reqIdRef.current
    loadingRef.current = true
    const skip = reset ? 0 : skipRef.current
    const searchTerm = searchRef.current

    try {
      const data: Employee[] = await fetchJson(
        `${API_BASE_URL}/employees?search=${encodeURIComponent(searchTerm)}&skip=${skip}&take=${PAGE_SIZE}&all=true`,
      )
      if (reqId !== reqIdRef.current) return

      skipRef.current = skip + data.length
      hasMoreRef.current = data.length === PAGE_SIZE
      setItems((prev) => dedupeEmployees(reset ? data : [...prev, ...data]))
    } catch (err) {
      if (reqId !== reqIdRef.current) return
      console.error(err)
      hasMoreRef.current = false
    } finally {
      if (reqId !== reqIdRef.current) return
      loadingRef.current = false

      requestAnimationFrame(() => {
        if (reqId !== reqIdRef.current) return
        const el = loader.current
        if (!el || !hasMoreRef.current || loadingRef.current) return
        const rect = el.getBoundingClientRect()
        if (rect.top < window.innerHeight + 80) {
          void loadPage(false)
        }
      })
    }
  }, [])

  useEffect(() => {
    searchRef.current = search
    skipRef.current = 0
    hasMoreRef.current = true
    loadingRef.current = false
    setItems([])
    void loadPage(true)
  }, [search, loadPage])

  useEffect(() => {
    const el = loader.current
    if (!el) return
    const obs = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) void loadPage(false)
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [loadPage])

  const enabledItems = items.filter((c) => !c.disabled)
  const disabledItems = items.filter((c) => c.disabled)

  return (
    <div className="p-4 pb-16">
      <Link to=".." className="text-blue-500 text-sm">&larr; Back</Link>
      <h2 className="text-xl font-semibold mb-2">Employee user accounts</h2>
      <div className="flex items-center gap-2 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or number"
          className="flex-1 border p-2 rounded"
        />
        <Link to="new" className="bg-blue-500 text-white px-3 py-1 rounded text-sm">
          New
        </Link>
      </div>

      <section className="mb-8">
        <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-2">
          Enabled ({enabledItems.length})
        </h3>
        <ul className="divide-y border border-slate-200 rounded-lg overflow-hidden">
          {enabledItems.length === 0 ? (
            <li className="py-3 px-3 text-sm text-slate-500">No enabled employees</li>
          ) : (
            enabledItems.map((c) => (
              <li key={c.id} className="bg-white">
                <Link to={String(c.id)} className="block py-2 px-3 hover:bg-slate-50">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{c.name}</span>
                    <EmployeeCodeBadge employeeId={c.id} />
                  </div>
                  <div className="text-sm text-gray-600">{formatPhone(c.number)}</div>
                </Link>
              </li>
            ))
          )}
        </ul>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-2">
          Disabled ({disabledItems.length})
        </h3>
        <ul className="divide-y border border-red-200 rounded-lg overflow-hidden bg-red-50">
          {disabledItems.length === 0 ? (
            <li className="py-3 px-3 text-sm text-slate-500 bg-red-50">No disabled employees</li>
          ) : (
            disabledItems.map((c) => (
              <li key={c.id} className="bg-red-50">
                <Link to={String(c.id)} className="block py-2 px-3 hover:bg-red-100">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-slate-700">{c.name}</span>
                    <EmployeeCodeBadge employeeId={c.id} />
                  </div>
                  <div className="text-sm text-slate-500">{formatPhone(c.number)}</div>
                </Link>
              </li>
            ))
          )}
        </ul>
      </section>

      <div ref={loader} className="h-5" />
    </div>
  )
}

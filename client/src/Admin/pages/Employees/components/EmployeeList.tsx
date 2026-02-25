import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Employee } from './types'
import { API_BASE_URL, fetchJson } from '../../../../api'
import { formatPhone } from '../../../../formatPhone'

interface EmployeeListProps {}

export default function EmployeeList(_: EmployeeListProps) {
  const [items, setItems] = useState<Employee[]>([])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const loader = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setItems([])
    setPage(0)
    setHasMore(true)
  }, [search])

  useEffect(() => {
    load()
  }, [page, search])

  function load() {
    fetchJson(
      `${API_BASE_URL}/employees?search=${encodeURIComponent(search)}&skip=${
        page * 20
      }&take=20&all=true`,
    )
      .then((data: Employee[]) => {
        setItems((prev) => {
          const next = page === 0 ? data : [...prev, ...data]
          const seen = new Set<number>()
          return next.filter((c) => {
            if (c.id === undefined) return false
            const exists = seen.has(c.id)
            seen.add(c.id)
            return !exists
          })
        })
        if (data.length < 20) setHasMore(false)
      })
      .catch((err) => {
        console.error(err)
        setHasMore(false)
      })
  }

  useEffect(() => {
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore) {
        setPage((p) => p + 1)
      }
    })
    if (loader.current) obs.observe(loader.current)
    return () => {
      if (loader.current) obs.unobserve(loader.current)
    }
  }, [hasMore])

  const enabledItems = items.filter((c) => !c.disabled)
  const disabledItems = items.filter((c) => c.disabled)

  return (
    <div className="p-4 pb-16">
      <Link to=".." className="text-blue-500 text-sm">&larr; Back</Link>
      <h2 className="text-xl font-semibold mb-2">Accounts</h2>
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
                  <div className="font-medium">{c.name}</div>
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
                  <div className="font-medium text-slate-700">{c.name}</div>
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

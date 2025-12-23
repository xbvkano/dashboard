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
      <ul className="divide-y">
        {items.map((c) => (
          <li key={c.id} className="py-2">
            <Link to={String(c.id)} className="block">
              <div className="font-medium">{c.name}</div>
              <div className="text-sm text-gray-600">{formatPhone(c.number)}</div>
            </Link>
          </li>
        ))}
      </ul>
      <div ref={loader} className="h-5" />
    </div>
  )
}

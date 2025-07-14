import { useState, useEffect, useRef } from 'react'
import { Routes, Route, Link, useNavigate, useParams } from 'react-router-dom'

interface Client {
  id?: number
  name: string
  number: string
  notes?: string
}

function List() {
  const [items, setItems] = useState<Client[]>([])
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
    fetch(`http://localhost:3000/clients?search=${encodeURIComponent(search)}&skip=${page * 20}&take=20`)
      .then((r) => r.json())
      .then((data: Client[]) => {
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
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-2">Clients</h2>
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
              <div className="text-sm text-gray-600">{c.number}</div>
            </Link>
          </li>
        ))}
      </ul>
      <div ref={loader} className="h-5" />
    </div>
  )
}

function Form() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = id === undefined
  const [data, setData] = useState<Client>({ name: '', number: '', notes: '' })

  useEffect(() => {
    if (!isNew) {
      fetch(`http://localhost:3000/clients/${id}`)
        .then((r) => r.json())
        .then((d) => setData(d))
    }
  }, [id, isNew])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setData({ ...data, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload = { name: data.name, number: data.number, notes: data.notes }
    const res = await fetch(`http://localhost:3000/clients${isNew ? '' : '/' + id}`, {
      method: isNew ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err.error || 'Failed to save')
      return
    }
    navigate('..')
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 space-y-3">
      <div>
        <label className="block text-sm">Name</label>
        <input name="name" value={data.name} onChange={handleChange} className="w-full border p-2 rounded" />
      </div>
      <div>
        <label className="block text-sm">Number</label>
        <input
          name="number"
          value={data.number}
          onChange={handleChange}
          type="tel"
          pattern="\d{10}"
          className="w-full border p-2 rounded"
        />
      </div>
      <div>
        <label className="block text-sm">Notes</label>
        <textarea name="notes" value={data.notes || ''} onChange={handleChange} className="w-full border p-2 rounded" />
      </div>
      <button className="bg-blue-500 text-white px-4 py-2 rounded" type="submit">
        Save
      </button>
    </form>
  )
}

export default function Clients() {
  return (
    <Routes>
      <Route index element={<List />} />
      <Route path="new" element={<Form />} />
      <Route path=":id" element={<Form />} />
    </Routes>
  )
}

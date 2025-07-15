import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Client } from './types'
import { API_BASE_URL, fetchJson } from '../../../../api'

export default function ClientForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = id === undefined
  const [data, setData] = useState<Client>({ name: '', number: '', notes: '' })

  useEffect(() => {
    if (!isNew) {
      fetchJson(`${API_BASE_URL}/clients/${id}`)
        .then((d) => setData(d))
        .catch((err) => console.error(err))
    }
  }, [id, isNew])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setData({ ...data, [e.target.name]: e.target.value })
  }

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    if (/^\d{0,10}$/.test(value)) {
      setData({ ...data, [name]: value })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload = { name: data.name, number: data.number, notes: data.notes }
    const res = await fetch(`${API_BASE_URL}/clients${isNew ? '' : '/' + id}`, {
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
        <label className="block text-sm">
          Name <span className="text-red-500">*</span>
        </label>
        <input
          name="name"
          value={data.name}
          onChange={handleChange}
          required
          className="w-full border p-2 rounded"
        />
      </div>
      <div>
        <label className="block text-sm">
          Number <span className="text-red-500">*</span>
        </label>
        <input
          name="number"
          value={data.number}
          onChange={handleNumberChange}
          type="tel"
          pattern="\d{10}"
          required
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

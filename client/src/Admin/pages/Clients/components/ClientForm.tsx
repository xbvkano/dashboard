import { useEffect, useState } from 'react'
import { useModal } from '../../../../ModalProvider'
import useFormPersistence, { clearFormPersistence, loadFormPersistence } from "../../../../useFormPersistence"
import { useNavigate, useParams } from 'react-router-dom'
import { Client } from './types'
import { API_BASE_URL, fetchJson } from '../../../../api'

export default function ClientForm() {
  const { alert } = useModal()
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = id === undefined
  const storageKey = `clientForm-${id || 'new'}`
  const [data, setData] = useState<Client>(() =>
    loadFormPersistence(storageKey, { name: '', number: '', notes: '' }),
  )
  useFormPersistence(storageKey, data)

  useEffect(() => {
    if (!isNew) {
      fetchJson(`${API_BASE_URL}/clients/${id}`)
        .then((d) => setData(d))
        .catch((err) => console.error(err))
    }
  }, [id, isNew])

  const persist = (updated: Client) => {
    Object.entries(updated).forEach(([field, value]) => {
      localStorage.setItem(`${storageKey}-${field}`, JSON.stringify(value))
    })
    localStorage.setItem(storageKey, JSON.stringify(updated))
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const updated = { ...data, [e.target.name]: e.target.value }
    persist(updated)
    setData(updated)
  }

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    const digits = value.replace(/\D/g, '').slice(0, 10)
    const updated = { ...data, [name]: digits }
    persist(updated)
    setData(updated)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload = { name: data.name, number: data.number, notes: data.notes }
    const res = await fetch(`${API_BASE_URL}/clients${isNew ? '' : '/' + id}`, {
      method: isNew ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json', "ngrok-skip-browser-warning": "1" },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      await alert(err.error || 'Failed to save')
      return
    }
    clearFormPersistence(storageKey)
    navigate('..')
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 space-y-3">
      <div>
        <label htmlFor="client-name" className="block text-sm">
          Name <span className="text-red-500">*</span>
        </label>
        <input
          id="client-name"
          name="name"
          value={data.name}
          onChange={handleChange}
          required
          className="w-full border p-2 rounded"
        />
      </div>
      <div>
        <label htmlFor="client-number" className="block text-sm">
          Number <span className="text-red-500">*</span>
        </label>
        <input
          id="client-number"
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
        <label htmlFor="client-notes" className="block text-sm">Notes</label>
        <textarea
          id="client-notes"
          name="notes"
          value={data.notes || ''}
          onChange={handleChange}
          className="w-full border p-2 rounded"
        />
      </div>
      <button className="bg-blue-500 text-white px-4 py-2 rounded" type="submit">
        Save
      </button>
    </form>
  )
}

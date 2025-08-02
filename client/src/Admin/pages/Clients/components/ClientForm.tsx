import { useEffect, useState } from 'react'
import { useModal } from '../../../../ModalProvider'
import useFormPersistence, { clearFormPersistence, loadFormPersistence } from "../../../../useFormPersistence"
import { useNavigate, useParams } from 'react-router-dom'
import { Client } from './types'
import { API_BASE_URL, fetchJson } from '../../../../api'
import { formatPhone } from '../../../../formatPhone'

import AppointmentsSection from "../../../components/AppointmentsSection"
export default function ClientForm() {
  const { alert, confirm } = useModal()
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = id === undefined
  const storageKey = `clientForm-${id || 'new'}`
  const [data, setData] = useState<Client>(() =>
    loadFormPersistence(storageKey, { name: '', number: '', from: '', notes: '', disabled: false }),
  )
  useFormPersistence(storageKey, data)

  useEffect(() => {
    if (!isNew) {
      fetchJson(`${API_BASE_URL}/clients/${id}`)
        .then((d) => setData({ from: '', ...d }))
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
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const updated = { ...data, [e.target.name]: e.target.value }
    persist(updated)
    setData(updated)
  }

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    const digits = value.replace(/\D/g, '').slice(0, 11)
    const updated = { ...data, [name]: digits }
    persist(updated)
    setData(updated)
  }

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const updated = { ...data, [e.target.name]: e.target.checked }
    persist(updated)
    setData(updated)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload = {
      name: data.name,
      number: data.number.length === 10 ? '1' + data.number : data.number,
      from: data.from,
      notes: data.notes,
      disabled: data.disabled ?? false,
    }
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

  const handleDelete = async () => {
    if (!id) return
    const ok = await confirm('Delete this client?')
    if (!ok) return
    const res = await fetch(`${API_BASE_URL}/clients/${id}`, {
      method: 'DELETE',
      headers: { 'ngrok-skip-browser-warning': '1' },
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      await alert(err.error || 'Failed to delete')
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
          Phone number <span className="text-red-500">*</span>
        </label>
        <input
          id="client-number"
          name="number"
          value={formatPhone(data.number)}
          onChange={handleNumberChange}
          type="tel"
          required
          className="w-full border p-2 rounded"
        />
      </div>
      <div>
        <label htmlFor="client-from" className="block text-sm">
          From <span className="text-red-500">*</span>
        </label>
        <select
          id="client-from"
          name="from"
          value={data.from}
          onChange={handleChange}
          required
          className="w-full border p-2 rounded"
        >
          <option value="" disabled>
            Select source
          </option>
          <option value="Yelp">Yelp</option>
          <option value="Form">Form</option>
          <option value="Call">Call</option>
          <option value="Rita">Rita's phone</option>
          <option value="Marcelo">Marcelo's phone</option>
        </select>
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
      <div className="flex items-center gap-2">
        <input
          id="disabled"
          name="disabled"
          type="checkbox"
          checked={data.disabled ?? false}
          onChange={handleCheckboxChange}
        />
        <label htmlFor="disabled" className="text-sm">Disable</label>
      </div>
      <div className="flex gap-2">
        <button className="bg-blue-500 text-white px-4 py-2 rounded" type="submit">
          Save
        </button>
        <button
          type="button"
          onClick={() => {
            clearFormPersistence(storageKey)
            navigate('..')
          }}
          className="bg-gray-300 px-4 py-2 rounded"
        >
          Cancel
        </button>
        {!isNew && (
          <button
            type="button"
            onClick={handleDelete}
            className="bg-red-500 text-white px-4 py-2 rounded"
          >
            Delete
          </button>
        )}
      </div>
      {!isNew && (
        <AppointmentsSection
          url={`${API_BASE_URL}/clients/${id}/appointments`}
        />
      )}
    </form>
  )
}

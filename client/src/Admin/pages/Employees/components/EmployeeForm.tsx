import { useEffect, useState } from 'react'
import { useModal } from '../../../../ModalProvider'
import { useNavigate, useParams } from 'react-router-dom'
import { Employee } from './types'
import { API_BASE_URL, fetchJson } from '../../../../api'
import useFormPersistence, { clearFormPersistence, loadFormPersistence } from '../../../../useFormPersistence'

export default function EmployeeForm() {
  const { alert } = useModal()
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = id === undefined
  const storageKey = `employeeForm-${id || 'new'}`
  const [data, setData] = useState<Employee>(() =>
    loadFormPersistence(storageKey, {
      name: '',
      number: '',
      notes: '',
      experienced: false,
      disabled: false,
    }),
  )
  useFormPersistence(storageKey, data)

  useEffect(() => {
    if (!isNew) {
      fetchJson(`${API_BASE_URL}/employees/${id}`)
        .then((d) => setData({ experienced: false, disabled: false, ...d }))
        .catch((err) => console.error(err))
    }
  }, [id, isNew])

  const persist = (updated: Employee) => {
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

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const updated = { ...data, [e.target.name]: e.target.checked }
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload = {
      name: data.name,
      number: data.number.length === 10 ? '1' + data.number : data.number,
      notes: data.notes,
      experienced: data.experienced,
      disabled: data.disabled ?? false,
    }
    const res = await fetch(`${API_BASE_URL}/employees${isNew ? '' : '/' + id}` ,{
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
        <label htmlFor="employee-name" className="block text-sm">
          Name <span className="text-red-500">*</span>
        </label>
        <input
          id="employee-name"
          name="name"
          value={data.name}
          onChange={handleChange}
          required
          className="w-full border p-2 rounded"
        />
      </div>
      <div>
        <label htmlFor="employee-number" className="block text-sm">
          Phone number <span className="text-red-500">*</span>
        </label>
        <input
          id="employee-number"
          name="number"
          value={data.number}
          onChange={handleNumberChange}
          type="tel"
          pattern="\d{10,11}"
          required
          className="w-full border p-2 rounded"
        />
      </div>
      <div>
        <label htmlFor="employee-notes" className="block text-sm">Notes</label>
        <textarea
          id="employee-notes"
          name="notes"
          value={data.notes || ''}
          onChange={handleChange}
          className="w-full border p-2 rounded"
        />
      </div>
      <div className="flex items-center gap-2">
        <input
          id="experienced"
          name="experienced"
          type="checkbox"
          checked={data.experienced ?? false}
          onChange={handleCheckboxChange}
        />
        <label htmlFor="experienced" className="text-sm">Experienced</label>
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
      </div>
    </form>
  )
}

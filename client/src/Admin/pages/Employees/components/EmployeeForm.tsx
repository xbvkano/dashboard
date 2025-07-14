import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Employee } from './types'

export default function EmployeeForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = id === undefined
  const [data, setData] = useState<Employee>({
    name: '',
    number: '',
    notes: '',
    experienced: false,
  })

  useEffect(() => {
    if (!isNew) {
      fetch(`http://localhost:3000/employees/${id}`)
        .then((r) => r.json())
        .then((d) => setData({ experienced: false, ...d }))
    }
  }, [id, isNew])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setData({ ...data, [e.target.name]: e.target.value })
  }

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setData({ ...data, experienced: e.target.checked })
  }

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    if (/^\d{0,10}$/.test(value)) {
      setData({ ...data, [name]: value })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload = {
      name: data.name,
      number: data.number,
      notes: data.notes,
      experienced: data.experienced,
    }
    const res = await fetch(`http://localhost:3000/employees${isNew ? '' : '/' + id}` ,{
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
      <div className="flex items-center gap-2">
        <input
          id="experienced"
          type="checkbox"
          checked={data.experienced ?? false}
          onChange={handleCheckboxChange}
        />
        <label htmlFor="experienced" className="text-sm">Experienced</label>
      </div>
      <div className="flex gap-2">
        <button className="bg-blue-500 text-white px-4 py-2 rounded" type="submit">
          Save
        </button>
        <button
          type="button"
          onClick={() => navigate('..')}
          className="bg-gray-300 px-4 py-2 rounded"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

import { useEffect, useState } from 'react'
import { useModal } from '../../../../ModalProvider'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { Employee, SupervisorOption } from './types'
import { API_BASE_URL, fetchJson, withApiAuth } from '../../../../api'
import useFormPersistence, { clearFormPersistence, loadFormPersistence } from '../../../../useFormPersistence'
import AppointmentsSection from "../../../components/AppointmentsSection"
import { phoneHasMinDigits, phoneToApiPayload } from '../../../../formatPhone'
import PhoneInput from '../../../components/PhoneInput'

function normalizeNumberForCompare(num: string): string {
  return num.replace(/\D/g, '')
}

export default function EmployeeForm() {
  const { alert, confirm } = useModal()
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = id === undefined
  const storageKey = `employeeForm-${id || 'new'}`
  const [data, setData] = useState<Employee>(() =>
    loadFormPersistence(storageKey, {
      name: '',
      number: '',
      notes: '',
      disabled: false,
      password: '',
      supervisorId: null,
    }),
  )
  const [supervisors, setSupervisors] = useState<SupervisorOption[]>([])
  const [lastSaved, setLastSaved] = useState<Pick<Employee, 'name' | 'number' | 'notes' | 'disabled' | 'supervisorId'> | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  useFormPersistence(storageKey, { ...data, password: '' })

  useEffect(() => {
    fetchJson<SupervisorOption[]>(`${API_BASE_URL}/employees/supervisors`)
      .then(setSupervisors)
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!isNew) {
      fetchJson<Employee>(`${API_BASE_URL}/employees/${id}`)
        .then((d) => {
          const base = { disabled: false, ...d }
          if (base.supervisorId === undefined) base.supervisorId = null
          setData(base)
          setLastSaved({
            name: base.name,
            number: base.number,
            notes: base.notes ?? '',
            disabled: base.disabled ?? false,
            supervisorId: base.supervisorId ?? null,
          })
        })
        .catch((err) => console.error(err))
    } else {
      setLastSaved(null)
    }
  }, [id, isNew])

  const hasSaveableChange = ((): boolean => {
    if (isNew) {
      const hasRequired = data.name.trim() !== '' && phoneHasMinDigits(data.number) && (data.supervisorId != null && data.supervisorId !== '') && data.password?.trim() !== ''
      return !!hasRequired
    }
    if (lastSaved == null) return false
    const numCur = normalizeNumberForCompare(data.number)
    const numSaved = normalizeNumberForCompare(lastSaved.number)
    if (data.name !== lastSaved.name || numCur !== numSaved || (data.notes ?? '') !== lastSaved.notes || (data.disabled ?? false) !== lastSaved.disabled || (data.supervisorId ?? null) !== lastSaved.supervisorId) return true
    if (data.password != null && data.password.trim() !== '') return true
    return false
  })()

  useEffect(() => {
    if (!saveSuccess) return
    const t = setTimeout(() => setSaveSuccess(false), 2500)
    return () => clearTimeout(t)
  }, [saveSuccess])

  const persist = (updated: Employee) => {
    const { password, ...dataToPersist } = updated
    Object.entries(dataToPersist).forEach(([field, value]) => {
      localStorage.setItem(`${storageKey}-${field}`, JSON.stringify(value))
    })
    localStorage.setItem(storageKey, JSON.stringify(dataToPersist))
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const name = e.target.name
    const value = e.target.value
    const updated =
      name === 'supervisorId'
        ? { ...data, [name]: value === '' ? null : Number(value) }
        : { ...data, [name]: value }
    persist(updated as Employee)
    setData(updated as Employee)
  }

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const updated = { ...data, [e.target.name]: e.target.checked }
    persist(updated)
    setData(updated)
  }

  const handleNumberChange = (combined: string) => {
    const updated = { ...data, number: combined }
    persist(updated)
    setData(updated)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const supervisorId = data.supervisorId === '' || data.supervisorId == null ? null : data.supervisorId
    if (supervisorId == null) {
      await alert('Assigned supervisor is required')
      return
    }
    const payload: any = {
      name: data.name,
      number: phoneToApiPayload(data.number),
      notes: data.notes,
      disabled: data.disabled ?? false,
      supervisorId,
    }
    if (isNew) {
      if (!data.password || data.password.trim() === '') {
        await alert('Password is required')
        return
      }
      payload.password = data.password
    } else {
      if (data.password && data.password.trim() !== '') {
        payload.password = data.password
      }
    }
    setSaving(true)
    const res = await fetch(`${API_BASE_URL}/employees${isNew ? '' : '/' + id}`, withApiAuth({
      method: isNew ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json', "ngrok-skip-browser-warning": "1" },
      body: JSON.stringify(payload),
    }))
    setSaving(false)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      await alert(err.error || 'Failed to save')
      return
    }
    clearFormPersistence(storageKey)
    const normalizedNumber = phoneToApiPayload(data.number)
    setData((prev) => ({
      ...prev,
      password: '',
      hasPassword: true,
    }))
    setLastSaved({
      name: data.name,
      number: normalizedNumber,
      notes: data.notes ?? '',
      disabled: data.disabled ?? false,
      supervisorId,
    })
    setSaveSuccess(true)
    if (isNew) navigate('/dashboard/contacts/employees/accounts')
  }

  const handleDelete = async () => {
    if (!id) return
    const ok = await confirm('Delete this employee?')
    if (!ok) return
    const res = await fetch(`${API_BASE_URL}/employees/${id}`, withApiAuth({
      method: 'DELETE',
      headers: { 'ngrok-skip-browser-warning': '1' },
    }))
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      await alert(err.error || 'Failed to delete')
      return
    }
    clearFormPersistence(storageKey)
    navigate('..')
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 pb-16 space-y-3 relative">
      {saveSuccess && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg shadow-lg">
          Saved
        </div>
      )}
      <Link to="/dashboard/contacts/employees/accounts" className="text-blue-500 text-sm">&larr; Back to employee users</Link>
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
        <PhoneInput
          id="employee-number"
          value={data.number}
          onChange={handleNumberChange}
          required
          className="border p-2 rounded"
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
      <div>
        <label htmlFor="employee-password" className="block text-sm">
          Password {isNew && <span className="text-red-500">*</span>}
          {!isNew && data.hasPassword && (
            <span className="text-gray-500 text-xs ml-2">(password is set; enter a new value to change it)</span>
          )}
          {!isNew && !data.hasPassword && (
            <span className="text-amber-600 text-xs ml-2">(no password set; enter one to enable login)</span>
          )}
        </label>
        <input
          id="employee-password"
          name="password"
          type="text"
          value={data.password ?? ''}
          onChange={handleChange}
          required={isNew}
          placeholder={!isNew && data.hasPassword ? 'Leave blank to keep current' : ''}
          className="w-full border p-2 rounded"
          autoComplete={isNew ? 'new-password' : 'off'}
        />
      </div>
      <div>
        <label htmlFor="employee-supervisor" className="block text-sm">
          Assigned supervisor <span className="text-red-500">*</span>
        </label>
        <select
          id="employee-supervisor"
          name="supervisorId"
          value={data.supervisorId ?? ''}
          onChange={handleChange}
          required
          className="w-full border p-2 rounded"
        >
          <option value="">Select a supervisor</option>
          {supervisors.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name || s.userName || `User #${s.id}`} ({s.role})
            </option>
          ))}
        </select>
        {supervisors.length === 0 && (
          <p className="text-amber-600 text-xs mt-1">No OWNER or SUPERVISOR users found. Create one first.</p>
        )}
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
        <button
          type="submit"
          disabled={!hasSaveableChange || saving}
          className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : 'Save'}
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
          url={`${API_BASE_URL}/employees/${id}/appointments`}
        />
      )}
    </form>
  )
}

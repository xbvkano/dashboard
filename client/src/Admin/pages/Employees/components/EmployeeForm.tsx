import { useEffect, useMemo, useRef, useState } from 'react'
import { useModal } from '../../../../ModalProvider'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { Employee, SupervisorOption } from './types'
import { API_BASE_URL, fetchJson, withApiAuth } from '../../../../api'
import useFormPersistence, { clearFormPersistence, loadFormPersistence } from '../../../../useFormPersistence'
import AppointmentsSection from "../../../components/AppointmentsSection"
import { formatPhone, phoneHasMinDigits, phoneToApiPayload } from '../../../../formatPhone'
import EmployeeCodeBadge from '../../../components/EmployeeCodeBadge'
import PhoneInput from '../../../components/PhoneInput'
import { copyTextToClipboard, phoneToE164 } from '../../../contactActions'
import { formatApiError, startConversationFromContact } from '../../Messages/Inbox/messagingApi'

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
  const [contactMenuOpen, setContactMenuOpen] = useState(false)
  const [textBusy, setTextBusy] = useState(false)
  const [phoneCopied, setPhoneCopied] = useState(false)
  const contactMenuRef = useRef<HTMLDivElement>(null)
  useFormPersistence(storageKey, { ...data, password: '' })

  const phoneE164 = useMemo(() => phoneToE164(data.number), [data.number])
  const telHref = phoneE164 ? `tel:${phoneE164}` : null
  const contactActionsEnabled = !isNew && !!phoneE164

  useEffect(() => {
    if (!contactMenuOpen) return
    const onDoc = (e: MouseEvent) => {
      if (contactMenuRef.current && !contactMenuRef.current.contains(e.target as Node)) {
        setContactMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [contactMenuOpen])

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

  const handleCopyPhone = async () => {
    if (!data.number) return
    try {
      await copyTextToClipboard(formatPhone(data.number))
      setPhoneCopied(true)
      setContactMenuOpen(false)
      window.setTimeout(() => setPhoneCopied(false), 2000)
    } catch (e) {
      console.error(e)
      await alert('Failed to copy phone number')
    }
  }

  const handleOpenInboxText = async () => {
    if (!phoneE164 || textBusy) return
    setTextBusy(true)
    setContactMenuOpen(false)
    try {
      const out = await startConversationFromContact({
        phoneRaw: phoneE164,
        name: data.name || null,
        inbox: 'employee',
      })
      navigate(`/dashboard/messages/employee-inbox?conversation=${out.conversationId}`)
    } catch (e) {
      console.error(e)
      await alert(formatApiError(e))
    } finally {
      setTextBusy(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const supervisorId = data.supervisorId === '' || data.supervisorId == null ? null : data.supervisorId
    if (supervisorId == null) {
      await alert('Assigned supervisor is required')
      return
    }
    const payload: Record<string, unknown> = {
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
      <div className="flex items-center justify-between gap-2">
        <Link to="/dashboard/contacts/employees/accounts" className="text-blue-500 text-sm">&larr; Back to employee users</Link>
        {contactActionsEnabled && (
          <div className="relative md:hidden" ref={contactMenuRef}>
            <button
              type="button"
              className="p-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
              aria-label="Contact actions"
              aria-expanded={contactMenuOpen}
              onClick={() => setContactMenuOpen((o) => !o)}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <circle cx="12" cy="6" r="1.75" />
                <circle cx="12" cy="12" r="1.75" />
                <circle cx="12" cy="18" r="1.75" />
              </svg>
            </button>
            {contactMenuOpen && (
              <div className="absolute right-0 mt-1 w-44 rounded-lg border border-slate-200 bg-white shadow-lg z-20 py-1">
                {telHref && (
                  <a
                    href={telHref}
                    className="block px-4 py-2.5 text-sm text-slate-800 hover:bg-slate-50"
                    onClick={() => setContactMenuOpen(false)}
                  >
                    Call
                  </a>
                )}
                <button
                  type="button"
                  className="block w-full text-left px-4 py-2.5 text-sm text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                  onClick={() => void handleOpenInboxText()}
                  disabled={textBusy}
                >
                  {textBusy ? 'Opening...' : 'Text'}
                </button>
                <button
                  type="button"
                  className="block w-full text-left px-4 py-2.5 text-sm text-slate-800 hover:bg-slate-50"
                  onClick={() => void handleCopyPhone()}
                >
                  {phoneCopied ? 'Copied' : 'Copy phone'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      {!isNew && data.id != null && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 flex flex-wrap items-center gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Employee call code
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              What they enter on the admin phone keypad (same as their account id).
            </p>
          </div>
          <EmployeeCodeBadge employeeId={data.id} size="md" />
        </div>
      )}
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
        {contactActionsEnabled && telHref && (
          <div className="mt-2 hidden md:flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleOpenInboxText()}
              disabled={textBusy}
              className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors disabled:opacity-60"
            >
              {textBusy ? 'Opening...' : 'Text'}
            </button>
            <button
              type="button"
              onClick={() => void handleCopyPhone()}
              className="px-3 py-1.5 bg-slate-100 text-slate-800 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
            >
              {phoneCopied ? 'Copied' : 'Copy phone'}
            </button>
            <a
              href={telHref}
              className="px-3 py-1.5 bg-slate-100 text-slate-800 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
            >
              Call
            </a>
          </div>
        )}
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
            onClick={() => void handleDelete()}
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

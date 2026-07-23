import { useEffect, useMemo, useRef, useState } from 'react'
import { useModal } from '../../../../ModalProvider'
import useFormPersistence, { clearFormPersistence, loadFormPersistence } from "../../../../useFormPersistence"
import { useNavigate, useParams } from 'react-router-dom'
import { Client } from './types'
import { API_BASE_URL, fetchJson, withApiAuth } from '../../../../api'
import { formatPhone, phoneToApiPayload } from '../../../../formatPhone'
import PhoneInput from '../../../components/PhoneInput'
import { copyTextToClipboard, phoneToE164 } from '../../../contactActions'
import { formatApiError, startConversationFromContact } from '../../Messages/Inbox/messagingApi'

import AppointmentsSection from "../../../components/AppointmentsSection"
import RecurrenceFamiliesSection from "../../../components/RecurrenceFamiliesSection"
export default function ClientForm() {
  const { alert, confirm } = useModal()
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = id === undefined
  const storageKey = `clientForm-${id || 'new'}`
  const [data, setData] = useState<Client>(() =>
    loadFormPersistence(storageKey, { name: '', number: '', from: '', notes: '', disabled: false }),
  )
  const [contactMenuOpen, setContactMenuOpen] = useState(false)
  const [textBusy, setTextBusy] = useState(false)
  const [phoneCopied, setPhoneCopied] = useState(false)
  const contactMenuRef = useRef<HTMLDivElement>(null)
  useFormPersistence(storageKey, data)

  const phoneE164 = useMemo(() => phoneToE164(data.number), [data.number])
  const telHref = phoneE164 ? `tel:${phoneE164}` : null
  const contactActionsEnabled = !isNew && !!phoneE164
  const canBookAppointment = !isNew && Number.isFinite(Number(id))

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

  const handleNumberChange = (combined: string) => {
    const updated = { ...data, number: combined }
    persist(updated)
    setData(updated)
  }

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const updated = { ...data, [e.target.name]: e.target.checked }
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
        notes: data.notes || null,
        clientFrom: data.from || 'Client',
      })
      navigate(`/dashboard/messages/inbox?conversation=${out.conversationId}`)
    } catch (e) {
      console.error(e)
      await alert(formatApiError(e))
    } finally {
      setTextBusy(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload = {
      name: data.name,
      number: phoneToApiPayload(data.number),
      from: data.from,
      notes: data.notes,
      disabled: data.disabled ?? false,
    }
    const res = await fetch(`${API_BASE_URL}/clients${isNew ? '' : '/' + id}`, withApiAuth({
      method: isNew ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json', "ngrok-skip-browser-warning": "1" },
      body: JSON.stringify(payload),
    }))
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
    const res = await fetch(`${API_BASE_URL}/clients/${id}`, withApiAuth({
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
    <form onSubmit={handleSubmit} className="p-4 space-y-3">
      <div className="flex justify-end md:hidden min-h-[40px]">
        {(contactActionsEnabled || canBookAppointment) && (
          <div className="relative" ref={contactMenuRef}>
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
                {canBookAppointment && (
                  <button
                    type="button"
                    className="block w-full text-left px-4 py-2.5 text-sm text-slate-800 hover:bg-slate-50"
                    onClick={() => {
                      setContactMenuOpen(false)
                      navigate(`/dashboard/contacts/clients/${id}/book-appointment`)
                    }}
                  >
                    Book appointment
                  </button>
                )}
                {contactActionsEnabled && telHref && (
                  <>
                    <a
                      href={telHref}
                      className="block px-4 py-2.5 text-sm text-slate-800 hover:bg-slate-50"
                      onClick={() => setContactMenuOpen(false)}
                    >
                      Call
                    </a>
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
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
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
        {(contactActionsEnabled || canBookAppointment) && (
          <div className="mt-2 hidden md:flex flex-wrap gap-2">
            {canBookAppointment && (
              <button
                type="button"
                onClick={() => navigate(`/dashboard/contacts/clients/${id}/book-appointment`)}
                className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
              >
                Book appointment
              </button>
            )}
            {contactActionsEnabled && telHref && (
              <>
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
              </>
            )}
          </div>
        )}
      </div>
      <div>
        <label htmlFor="client-number" className="block text-sm">
          Phone number <span className="text-red-500">*</span>
        </label>
        <PhoneInput
          id="client-number"
          value={data.number}
          onChange={handleNumberChange}
          required
          className="border p-2 rounded"
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
      {!isNew && id && (
        <>
          <RecurrenceFamiliesSection clientId={parseInt(id, 10)} />
          <AppointmentsSection
            url={`${API_BASE_URL}/clients/${id}/appointments`}
          />
        </>
      )}
    </form>
  )
}

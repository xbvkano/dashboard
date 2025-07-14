import { useEffect, useState } from 'react'
import { Client } from '../../Clients/components/types'
import type { AppointmentTemplate } from '../types'

interface Props {
  onClose: () => void
  onCreated: () => void
}

const sizeOptions = [
  '0-1000',
  '1000-1500',
  '1500-2000',
  '2000-2500',
  '2500-3000',
  '3000-3500',
  '3500-4000',
  '4000-4500',
  '4500-5000',
  '5500-6000',
  '6000+',
]

export default function CreateAppointmentModal({ onClose, onCreated }: Props) {
  const [clientSearch, setClientSearch] = useState('')
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [newClient, setNewClient] = useState({ name: '', number: '', notes: '' })
  const [showNewClient, setShowNewClient] = useState(false)

  const handleNewClientNumberChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = e.target.value
    if (/^\d{0,10}$/.test(value)) {
      setNewClient({ ...newClient, number: value })
    }
  }

  const [templates, setTemplates] = useState<AppointmentTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null)
  const [showNewTemplate, setShowNewTemplate] = useState(false)
  const [templateForm, setTemplateForm] = useState({
    templateName: '',
    type: 'STANDARD',
    size: '',
    address: '',
    price: '',
    notes: '',
  })

  const [date, setDate] = useState('')
  const [time, setTime] = useState('')

  // Load clients when search changes
  useEffect(() => {
    fetch(
      `http://localhost:3000/clients?search=${encodeURIComponent(
        clientSearch
      )}&skip=0&take=20`
    )
      .then((r) => r.json())
      .then((d) => setClients(d))
  }, [clientSearch])

  // Load templates when client selected
  useEffect(() => {
    if (!selectedClient) {
      setTemplates([])
      setSelectedTemplate(null)
      return
    }
    fetch(`http://localhost:3000/appointment-templates?clientId=${selectedClient.id}`)
      .then((r) => r.json())
      .then((d) => setTemplates(d))
  }, [selectedClient])

  const createClient = async () => {
    const res = await fetch('http://localhost:3000/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newClient),
    })
    if (res.ok) {
      const c = await res.json()
      setSelectedClient(c)
      setShowNewClient(false)
      setClientSearch('')
    } else {
      const err = await res.json().catch(() => ({}))
      alert(err.error || 'Failed to create client')
    }
  }

  const createTemplate = async () => {
    if (!selectedClient) return
    const payload = {
      clientId: selectedClient.id,
      templateName: templateForm.templateName,
      type: templateForm.type,
      size: templateForm.size || undefined,
      address: templateForm.address,
      price: parseFloat(templateForm.price),
      notes: templateForm.notes || undefined,
    }
    const res = await fetch('http://localhost:3000/appointment-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      const t = await res.json()
      setTemplates((p) => [...p, t])
      setSelectedTemplate(t.id)
      setShowNewTemplate(false)
    } else {
      alert('Failed to create template')
    }
  }

  const createAppointment = async () => {
    if (!selectedClient || !selectedTemplate) return
    const res = await fetch('http://localhost:3000/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: selectedClient.id,
        templateId: selectedTemplate,
        date,
        time,
      }),
    })
    if (res.ok) {
      onCreated()
      onClose()
    } else {
      alert('Failed to create appointment')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-20">
      <div className="bg-white p-4 rounded w-96 max-h-full overflow-y-auto space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">New Appointment</h2>
          <button onClick={onClose}>X</button>
        </div>

        {/* Client selection */}
        {selectedClient ? (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium">Client: {selectedClient.name}</div>
              <button className="text-sm text-blue-500" onClick={() => setSelectedClient(null)}>
                change
              </button>
            </div>
          </div>
        ) : showNewClient ? (
          <div className="space-y-2 border p-2 rounded">
            <h3 className="font-medium">New Client</h3>
            <input
              className="w-full border p-1 rounded"
              placeholder="Name"
              value={newClient.name}
              onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
            />
            <input
              className="w-full border p-1 rounded"
              placeholder="Number"
              value={newClient.number}
              onChange={handleNewClientNumberChange}
            />
            <textarea
              className="w-full border p-1 rounded"
              placeholder="Notes"
              value={newClient.notes}
              onChange={(e) => setNewClient({ ...newClient, notes: e.target.value })}
            />
            <div className="flex gap-2 justify-end">
              <button className="px-2" onClick={() => setShowNewClient(false)}>
                Cancel
              </button>
              <button className="px-2 text-blue-600" onClick={createClient}>
                Save
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex gap-2 mb-1">
              <input
                className="flex-1 border p-1 rounded"
                placeholder="Search clients"
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
              />
              <button className="px-2 text-sm" onClick={() => setShowNewClient(true)}>
                New
              </button>
            </div>
            <ul className="max-h-32 overflow-y-auto border rounded">
              {clients.map((c) => (
                <li key={c.id} className="p-1 hover:bg-gray-100 cursor-pointer" onClick={() => setSelectedClient(c)}>
                  {c.name}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Template selection */}
        {selectedClient && (
          <div>
            {selectedTemplate ? (
              <div className="mb-2">
                <div className="flex items-center justify-between">
                  <div className="font-medium">
                    Template: {templates.find((t) => t.id === selectedTemplate)?.templateName}
                  </div>
                  <button className="text-sm text-blue-500" onClick={() => setSelectedTemplate(null)}>
                    change
                  </button>
                </div>
                {(() => {
                  const t = templates.find((tt) => tt.id === selectedTemplate)
                  if (!t) return null
                  return (
                    <div className="text-sm border rounded p-2 mt-1 space-y-1">
                      <div>Type: {t.type}</div>
                      {t.size && <div>Size: {t.size}</div>}
                      <div>Address: {t.address}</div>
                      <div>Price: ${t.price.toFixed(2)}</div>
                      {t.cityStateZip && <div>Notes: {t.cityStateZip}</div>}
                    </div>
                  )
                })()}
              </div>
            ) : showNewTemplate ? (
              <div className="space-y-2 border p-2 rounded">
                <h3 className="font-medium">New Template</h3>
                <input
                  className="w-full border p-1 rounded"
                  placeholder="Name"
                  value={templateForm.templateName}
                  onChange={(e) => setTemplateForm({ ...templateForm, templateName: e.target.value })}
                />
                <select
                  className="w-full border p-1 rounded"
                  value={templateForm.type}
                  onChange={(e) => setTemplateForm({ ...templateForm, type: e.target.value })}
                >
                  <option value="DEEP">Deep</option>
                  <option value="MOVE_IN_OUT">Move in/out</option>
                  <option value="STANDARD">Standard</option>
                </select>
                <select
                  className="w-full border p-1 rounded"
                  value={templateForm.size}
                  onChange={(e) => setTemplateForm({ ...templateForm, size: e.target.value })}
                >
                  <option value="">Select size</option>
                  {sizeOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <input
                  className="w-full border p-1 rounded"
                  placeholder="Price"
                  type="number"
                  value={templateForm.price}
                  onChange={(e) => setTemplateForm({ ...templateForm, price: e.target.value })}
                />
                <input
                  className="w-full border p-1 rounded"
                  placeholder="Address"
                  value={templateForm.address}
                  onChange={(e) => setTemplateForm({ ...templateForm, address: e.target.value })}
                />
                <textarea
                  className="w-full border p-1 rounded"
                  placeholder="Notes"
                  value={templateForm.notes}
                  onChange={(e) => setTemplateForm({ ...templateForm, notes: e.target.value })}
                />
                <div className="flex gap-2 justify-end">
                  <button className="px-2" onClick={() => setShowNewTemplate(false)}>
                    Cancel
                  </button>
                  <button className="px-2 text-blue-600" onClick={createTemplate}>
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex gap-2 mb-1">
                  <select
                    className="flex-1 border p-1 rounded"
                    value={selectedTemplate ?? ''}
                    onChange={(e) => setSelectedTemplate(Number(e.target.value))}
                  >
                    <option value="">Select template</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.templateName}
                      </option>
                    ))}
                  </select>
                  <button className="px-2 text-sm" onClick={() => setShowNewTemplate(true)}>
                    New
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Date and time */}
        {selectedTemplate && (
          <div className="space-y-2">
            <input
              type="date"
              className="w-full border p-1 rounded"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <input
              type="time"
              className="w-full border p-1 rounded"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
        )}

        <div className="text-right">
          <button
            className="bg-blue-500 text-white px-4 py-1 rounded disabled:opacity-50"
            disabled={!selectedTemplate || !date || !time}
            onClick={createAppointment}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { API_BASE_URL, fetchJson } from '../../../../api'
import { useModal } from '../../../../ModalProvider'
import { formatPhone } from '../../../../formatPhone'
import type { RecurrenceRule } from '../../../../types'

interface Client {
  id: number
  name: string
  number: string
  from: string
}

interface AppointmentTemplate {
  id: number
  templateName: string
  type: string
  address: string
  size: string | null
  price: number
  notes?: string | null
  instructions?: string | null
}

interface Admin {
  id: number
  name: string | null
  email: string | null
}

interface Props {
  onClose: () => void
  onCreated: () => void
  initialClientId?: number
}

export default function CreateRecurrenceFamilyModal({
  onClose,
  onCreated,
  initialClientId,
}: Props) {
  const { alert } = useModal()
  const [clients, setClients] = useState<Client[]>([])
  const [clientSearch, setClientSearch] = useState<string>('')
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [selectedClientId, setSelectedClientId] = useState<number | null>(
    initialClientId || null
  )
  const [templates, setTemplates] = useState<AppointmentTemplate[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null)
  const [showNewTemplate, setShowNewTemplate] = useState(false)
  const [templateForm, setTemplateForm] = useState({
    templateName: '',
    type: 'STANDARD',
    size: '',
    address: '',
    price: '',
    notes: '',
    instructions: '',
    carpetEnabled: false,
    carpetRooms: '',
    carpetPrice: '',
  })
  const [admins, setAdmins] = useState<Admin[]>([])
  const [selectedAdminId, setSelectedAdminId] = useState<number | null>(null)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [ruleType, setRuleType] = useState<'weekly' | 'biweekly' | 'every3weeks' | 'monthly' | 'customMonths' | 'monthlyPattern'>('weekly')
  const [interval, setInterval] = useState(1)
  const [monthlyPatternType, setMonthlyPatternType] = useState<'weekDay' | 'dayOfMonth'>('weekDay')
  const [dayOfWeek, setDayOfWeek] = useState<number | undefined>(undefined)
  const [weekOfMonth, setWeekOfMonth] = useState<number | undefined>(undefined)
  const [dayOfMonth, setDayOfMonth] = useState<number | undefined>(undefined)
  const [loading, setLoading] = useState(false)

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
    '5000-5500',
    '5500-6000',
    '6000+',
  ]

  useEffect(() => {
    fetchJson(`${API_BASE_URL}/admins`)
      .then((data) => {
        setAdmins(data)
        if (data.length > 0) {
          setSelectedAdminId(data[0].id)
        }
      })
      .catch((err) => console.error('Failed to load admins:', err))
  }, [])

  // Load initial client if initialClientId is provided
  useEffect(() => {
    if (initialClientId) {
      fetchJson(`${API_BASE_URL}/clients`)
        .then((data: Client[]) => {
          const client = data.find((c) => c.id === initialClientId)
          if (client) {
            setSelectedClient(client)
            setSelectedClientId(client.id)
          }
        })
        .catch((err) => console.error('Failed to load clients:', err))
    }
  }, [initialClientId])

  // Search clients with debounce
  const searchClients = async (search: string) => {
    if (search.trim().length < 2) {
      setClients([])
      return
    }
    try {
      const data = await fetchJson(`${API_BASE_URL}/clients?search=${encodeURIComponent(search)}`)
      setClients(data)
    } catch {
      setClients([])
    }
  }

  useEffect(() => {
    const timeout = setTimeout(() => searchClients(clientSearch), 300)
    return () => clearTimeout(timeout)
  }, [clientSearch])

  useEffect(() => {
    if (selectedClientId) {
      fetchJson(`${API_BASE_URL}/appointment-templates?clientId=${selectedClientId}`)
        .then((data) => {
          setTemplates(data)
          if (data.length > 0) {
            setSelectedTemplateId(data[0].id)
          }
        })
        .catch((err) => console.error('Failed to load templates:', err))
    } else {
      setTemplates([])
      setSelectedTemplateId(null)
    }
  }, [selectedClientId])

  const createTemplate = async () => {
    if (!templateForm.templateName.trim() || !templateForm.address.trim() || !templateForm.price.trim() || !selectedClientId) {
      await alert('Please fill in template name, address, and price')
      return
    }
    try {
      const template = await fetchJson(`${API_BASE_URL}/appointment-templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: selectedClientId,
          templateName: templateForm.templateName,
          type: templateForm.type,
          size: templateForm.size,
          address: templateForm.address,
          price: Number(templateForm.price),
          notes: templateForm.notes,
          instructions: templateForm.instructions,
          carpetRooms: templateForm.carpetEnabled ? Number(templateForm.carpetRooms) : null,
          carpetPrice: templateForm.carpetEnabled ? Number(templateForm.carpetPrice) : null,
        }),
      })
      setSelectedTemplateId(template.id)
      setShowNewTemplate(false)
      setTemplateForm({
        templateName: '',
        type: 'STANDARD',
        size: '',
        address: '',
        price: '',
        notes: '',
        instructions: '',
        carpetEnabled: false,
        carpetRooms: '',
        carpetPrice: '',
      })
      // Reload templates
      if (selectedClientId) {
        fetchJson(`${API_BASE_URL}/appointment-templates?clientId=${selectedClientId}`)
          .then((data) => setTemplates(data))
          .catch((err) => console.error('Failed to load templates:', err))
      }
    } catch (error: any) {
      await alert(error.error || 'Failed to create template')
    }
  }

  const buildRecurrenceRule = (): RecurrenceRule => {
    const rule: RecurrenceRule = { type: ruleType }
    
    if (ruleType === 'customMonths') {
      rule.interval = interval
    } else if (ruleType === 'monthlyPattern') {
      if (monthlyPatternType === 'weekDay' && weekOfMonth && dayOfWeek !== undefined) {
        rule.weekOfMonth = weekOfMonth
        rule.dayOfWeek = dayOfWeek
      } else if (monthlyPatternType === 'dayOfMonth' && dayOfMonth) {
        rule.dayOfMonth = dayOfMonth
      }
    }
    
    return rule
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedClientId || !selectedTemplateId || !date || !time || !selectedAdminId) {
      await alert('Please fill in all required fields: Client, Template, Date, Time, and Admin')
      return
    }

    const recurrenceRule = buildRecurrenceRule()

    setLoading(true)
    try {
      await fetchJson(`${API_BASE_URL}/recurring`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: selectedClientId,
          templateId: selectedTemplateId,
          date,
          time,
          adminId: selectedAdminId,
          recurrenceRule,
        }),
      })
      
      onCreated()
      onClose()
    } catch (err: any) {
      await alert(err.error || 'Failed to create recurrence family')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold">Create Recurrence Family</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Client Selection */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Client <span className="text-red-500">*</span>
            </label>
            {selectedClient ? (
              <div className="bg-gray-100 p-3 rounded">
                <div className="font-medium">{selectedClient.name}</div>
                <div className="text-sm text-gray-600">{formatPhone(selectedClient.number)}</div>
                <div className="text-sm text-gray-600">From: {selectedClient.from}</div>
                <button
                  type="button"
                  className="text-blue-500 text-sm mt-1 hover:text-blue-700"
                  onClick={() => {
                    setSelectedClient(null)
                    setSelectedClientId(null)
                    setClientSearch('')
                    setClients([])
                  }}
                >
                  Change
                </button>
              </div>
            ) : (
              <div>
                <input
                  type="text"
                  className="w-full border p-2 rounded mb-2"
                  placeholder="Search clients by name or number"
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                />
                {clients.length > 0 && (
                  <ul className="max-h-40 overflow-y-auto border rounded divide-y">
                    {clients.map((client) => (
                      <li
                        key={client.id}
                        className="p-2 hover:bg-gray-100 cursor-pointer border-b last:border-b-0"
                        onClick={() => {
                          setSelectedClient(client)
                          setSelectedClientId(client.id)
                          setClientSearch('')
                          setClients([])
                        }}
                      >
                        <div className="font-medium">{client.name}</div>
                        <div className="text-sm text-gray-600">{formatPhone(client.number)}</div>
                        <div className="text-sm text-gray-600">From: {client.from}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Template Selection */}
          {selectedClientId && (
            <div>
              <label className="block text-sm font-medium mb-1">
                Template <span className="text-red-500">*</span>
              </label>
              {!showNewTemplate ? (
                <>
                  {selectedTemplateId ? (() => {
                    const selectedTemplate = templates.find(t => t.id === selectedTemplateId)
                    return selectedTemplate ? (
                      <div className="bg-gray-100 p-3 rounded mb-2">
                        <div className="font-medium">{selectedTemplate.templateName}</div>
                        <div className="text-sm text-gray-600">Type: {selectedTemplate.type}</div>
                        {selectedTemplate.size && (
                          <div className="text-sm text-gray-600">Size: {selectedTemplate.size}</div>
                        )}
                        <div className="text-sm text-gray-600">Address: {selectedTemplate.address}</div>
                        <div className="text-sm text-gray-600">Price: ${selectedTemplate.price.toFixed(2)}</div>
                        {selectedTemplate.notes && (
                          <div className="text-sm text-gray-600">Notes: {selectedTemplate.notes}</div>
                        )}
                        {selectedTemplate.instructions && (
                          <div className="text-sm text-gray-600">Instructions: {selectedTemplate.instructions}</div>
                        )}
                        <button
                          type="button"
                          className="text-blue-500 text-sm mt-1 hover:text-blue-700"
                          onClick={() => setSelectedTemplateId(null)}
                        >
                          Change
                        </button>
                      </div>
                    ) : null
                  })() : templates.length > 0 ? (
                    <select
                      value={selectedTemplateId || ''}
                      onChange={(e) => setSelectedTemplateId(parseInt(e.target.value, 10) || null)}
                      className="w-full border p-2 rounded mb-2"
                      required
                    >
                      <option value="">Select a template</option>
                      {templates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.templateName} - {template.address}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-sm text-gray-500 mb-2">
                      No templates found for this client.
                    </p>
                  )}
                  {!selectedTemplateId && (
                    <button
                      type="button"
                      onClick={() => setShowNewTemplate(true)}
                      className="text-blue-500 text-sm hover:text-blue-700"
                    >
                      + Create new template
                    </button>
                  )}
                </>
              ) : (
                <div className="border rounded p-4 bg-gray-50 space-y-2">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-medium">New Template</h4>
                    <button
                      type="button"
                      onClick={() => {
                        setShowNewTemplate(false)
                        setTemplateForm({
                          templateName: '',
                          type: 'STANDARD',
                          size: '',
                          address: '',
                          price: '',
                          notes: '',
                          instructions: '',
                          carpetEnabled: false,
                          carpetRooms: '',
                          carpetPrice: '',
                        })
                      }}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="Template name *"
                    value={templateForm.templateName}
                    onChange={(e) => setTemplateForm({ ...templateForm, templateName: e.target.value })}
                    className="w-full border p-2 rounded"
                  />
                  <select
                    value={templateForm.type}
                    onChange={(e) => setTemplateForm({ ...templateForm, type: e.target.value })}
                    className="w-full border p-2 rounded"
                  >
                    <option value="STANDARD">Standard</option>
                    <option value="DEEP">Deep</option>
                    <option value="MOVE_IN_OUT">Move in/out</option>
                  </select>
                  <select
                    value={templateForm.size}
                    onChange={(e) => setTemplateForm({ ...templateForm, size: e.target.value })}
                    className="w-full border p-2 rounded"
                  >
                    <option value="">Select size</option>
                    {sizeOptions.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Address *"
                    value={templateForm.address}
                    onChange={(e) => setTemplateForm({ ...templateForm, address: e.target.value })}
                    className="w-full border p-2 rounded"
                  />
                  <input
                    type="number"
                    placeholder="Price *"
                    value={templateForm.price}
                    onChange={(e) => setTemplateForm({ ...templateForm, price: e.target.value })}
                    className="w-full border p-2 rounded"
                  />
                  <textarea
                    placeholder="Notes (optional)"
                    value={templateForm.notes}
                    onChange={(e) => setTemplateForm({ ...templateForm, notes: e.target.value })}
                    className="w-full border p-2 rounded"
                  />
                  <textarea
                    placeholder="Instructions (optional)"
                    value={templateForm.instructions}
                    onChange={(e) => setTemplateForm({ ...templateForm, instructions: e.target.value })}
                    className="w-full border p-2 rounded"
                  />
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={templateForm.carpetEnabled}
                      onChange={(e) => setTemplateForm({ ...templateForm, carpetEnabled: e.target.checked })}
                      className="mr-2"
                    />
                    Include carpet cleaning
                  </label>
                  {templateForm.carpetEnabled && (
                    <>
                      <input
                        type="number"
                        placeholder="Number of carpet rooms"
                        value={templateForm.carpetRooms}
                        onChange={(e) => setTemplateForm({ ...templateForm, carpetRooms: e.target.value })}
                        className="w-full border p-2 rounded"
                      />
                      <input
                        type="number"
                        placeholder="Carpet price"
                        value={templateForm.carpetPrice}
                        onChange={(e) => setTemplateForm({ ...templateForm, carpetPrice: e.target.value })}
                        className="w-full border p-2 rounded"
                      />
                    </>
                  )}
                  <button
                    type="button"
                    onClick={createTemplate}
                    disabled={!templateForm.templateName.trim() || !templateForm.address.trim() || !templateForm.price.trim()}
                    className="w-full bg-blue-500 text-white px-4 py-2 rounded disabled:bg-gray-400"
                  >
                    Create Template
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                First Appointment Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full border p-2 rounded"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Time <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full border p-2 rounded"
                required
              />
            </div>
          </div>

          {/* Admin Selection */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Admin <span className="text-red-500">*</span>
            </label>
            {admins.length === 0 ? (
              <p className="text-sm text-gray-500">Loading admins...</p>
            ) : (
              <select
                value={selectedAdminId || ''}
                onChange={(e) => setSelectedAdminId(parseInt(e.target.value, 10) || null)}
                className="w-full border p-2 rounded"
                required
              >
                <option value="">Select an admin</option>
                {admins.map((admin) => (
                  <option key={admin.id} value={admin.id}>
                    {admin.name || admin.email || `Admin ${admin.id}`}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Recurrence Rule */}
          <div className="border-t pt-4">
            <h4 className="font-medium mb-3">Recurrence Rule <span className="text-red-500">*</span></h4>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Frequency Type</label>
                <select
                  value={ruleType}
                  onChange={(e) => {
                    setRuleType(e.target.value as any)
                    // Reset pattern type when switching
                    if (e.target.value !== 'monthlyPattern') {
                      setMonthlyPatternType('weekDay')
                      setWeekOfMonth(undefined)
                      setDayOfWeek(undefined)
                      setDayOfMonth(undefined)
                    }
                  }}
                  className="w-full border p-2 rounded"
                >
                  <option value="weekly">Every week</option>
                  <option value="biweekly">Every 2 weeks</option>
                  <option value="every3weeks">Every 3 weeks</option>
                  <option value="monthly">Every month</option>
                  <option value="customMonths">Monthly intervals</option>
                  <option value="monthlyPattern">Monthly pattern</option>
                </select>
              </div>

              {ruleType === 'customMonths' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Interval (months)</label>
                  <input
                    type="number"
                    min="1"
                    value={interval}
                    onChange={(e) => setInterval(parseInt(e.target.value, 10) || 1)}
                    className="w-full border p-2 rounded"
                    placeholder="e.g., 3 for every 3 months"
                  />
                </div>
              )}

              {ruleType === 'monthlyPattern' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-2">Pattern Type</label>
                    <div className="flex gap-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="monthlyPatternType"
                          value="weekDay"
                          checked={monthlyPatternType === 'weekDay'}
                          onChange={(e) => {
                            setMonthlyPatternType('weekDay')
                            setDayOfMonth(undefined)
                          }}
                          className="mr-2"
                        />
                        Week + Day of Week
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="monthlyPatternType"
                          value="dayOfMonth"
                          checked={monthlyPatternType === 'dayOfMonth'}
                          onChange={(e) => {
                            setMonthlyPatternType('dayOfMonth')
                            setWeekOfMonth(undefined)
                            setDayOfWeek(undefined)
                          }}
                          className="mr-2"
                        />
                        Day of Month
                      </label>
                    </div>
                  </div>

                  {monthlyPatternType === 'weekDay' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium mb-1">Week of Month</label>
                        <select
                          value={weekOfMonth || ''}
                          onChange={(e) => setWeekOfMonth(parseInt(e.target.value, 10) || undefined)}
                          className="w-full border p-2 rounded"
                        >
                          <option value="">Select week</option>
                          <option value="1">First</option>
                          <option value="2">Second</option>
                          <option value="3">Third</option>
                          <option value="4">Fourth</option>
                          <option value="-1">Last</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Day of Week</label>
                        <select
                          value={dayOfWeek !== undefined ? dayOfWeek : ''}
                          onChange={(e) => setDayOfWeek(parseInt(e.target.value, 10) || undefined)}
                          className="w-full border p-2 rounded"
                        >
                          <option value="">Select day</option>
                          <option value="0">Sunday</option>
                          <option value="1">Monday</option>
                          <option value="2">Tuesday</option>
                          <option value="3">Wednesday</option>
                          <option value="4">Thursday</option>
                          <option value="5">Friday</option>
                          <option value="6">Saturday</option>
                        </select>
                      </div>
                    </>
                  )}

                  {monthlyPatternType === 'dayOfMonth' && (
                    <div>
                      <label className="block text-sm font-medium mb-1">Day of Month (1-31)</label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={dayOfMonth || ''}
                        onChange={(e) => setDayOfMonth(parseInt(e.target.value, 10) || undefined)}
                        className="w-full border p-2 rounded"
                        placeholder="e.g., 5 for 5th of every month"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-2 justify-end pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !selectedClient || !selectedClientId || !selectedTemplateId || !date || !time || !selectedAdminId}
              className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:bg-gray-400"
            >
              {loading ? 'Creating...' : 'Create Recurrence Family'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

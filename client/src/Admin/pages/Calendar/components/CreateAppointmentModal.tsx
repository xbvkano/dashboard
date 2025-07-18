import { useEffect, useState, useRef } from 'react'
import { Client } from '../../Clients/components/types'
import type { AppointmentTemplate } from '../types'
import type { Employee } from '../../Employees/components/types'
import { API_BASE_URL, fetchJson } from '../../../../api'

interface Props {
  onClose: () => void
  onCreated: () => void
  initialClientId?: number
  initialTemplateId?: number
  newStatus?: import('../types').Appointment['status']
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

export default function CreateAppointmentModal({ onClose, onCreated, initialClientId, initialTemplateId, newStatus }: Props) {
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
  const [editing, setEditing] = useState(false)
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

  const [admins, setAdmins] = useState<{ id: number; name: string | null; email: string }[]>([])
  const [adminId, setAdminId] = useState<number | ''>('')
  const [paid, setPaid] = useState(false)
  const [tip, setTip] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [otherPayment, setOtherPayment] = useState('')

  // staff options and employee selection
  const [staffOptions, setStaffOptions] = useState<{ sem: number; com: number; hours: number }[]>([])
  const [selectedOption, setSelectedOption] = useState<number>(0)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedEmployees, setSelectedEmployees] = useState<number[]>([])
  const [showTeamModal, setShowTeamModal] = useState(false)
  const [employeeSearch, setEmployeeSearch] = useState('')
  const [payRate, setPayRate] = useState<number | null>(null)
  const filteredEmployees = employees.filter(
    (e) =>
      e.name.toLowerCase().includes(employeeSearch.toLowerCase()) ||
      e.number.includes(employeeSearch)
  )

  // carpet cleaning options
  const [carpetEnabled, setCarpetEnabled] = useState(false)
  const [showCarpetModal, setShowCarpetModal] = useState(false)
  const [carpetRooms, setCarpetRooms] = useState<string>('')
  const [carpetEmployees, setCarpetEmployees] = useState<number[]>([])
  const [carpetRate, setCarpetRate] = useState<number | null>(null)

  // recurring options
  const recurringOptions = [
    'Weekly',
    'Biweekly',
    'Thrweekly',
    'Monthly',
    'Other',
  ] as const
  type RecurringOption = (typeof recurringOptions)[number]
  const [recurringEnabled, setRecurringEnabled] = useState(false)
  const [showRecurringModal, setShowRecurringModal] = useState(false)
  const [recurringOption, setRecurringOption] = useState<RecurringOption>('Weekly')
  const [recurringMonths, setRecurringMonths] = useState('')

  const handleClose = () => {
    sessionStorage.removeItem('createAppointmentState')
    onClose()
  }

  const initializedRef = useRef(false)
  const storedTemplateIdRef = useRef<number | null>(null)

  useEffect(() => {
    const stored = sessionStorage.getItem('createAppointmentState')
    if (stored) {
      try {
        const s = JSON.parse(stored)
        if (s.clientSearch) setClientSearch(s.clientSearch)
        if (s.selectedClient) setSelectedClient(s.selectedClient)
        if (s.newClient) setNewClient(s.newClient)
        if (typeof s.showNewClient === 'boolean') setShowNewClient(s.showNewClient)
        if (typeof s.selectedTemplate !== 'undefined') {
          setSelectedTemplate(s.selectedTemplate)
          storedTemplateIdRef.current = s.selectedTemplate
        }
        if (typeof s.showNewTemplate === 'boolean') setShowNewTemplate(s.showNewTemplate)
        if (typeof s.editing === 'boolean') setEditing(s.editing)
        if (s.templateForm) setTemplateForm({ ...templateForm, ...s.templateForm })
        if (s.date) setDate(s.date)
        if (s.time) setTime(s.time)
        if (typeof s.adminId !== 'undefined') setAdminId(s.adminId)
        if (typeof s.paid === 'boolean') setPaid(s.paid)
        if (s.tip) setTip(s.tip)
        if (s.paymentMethod) setPaymentMethod(s.paymentMethod)
        if (s.otherPayment) setOtherPayment(s.otherPayment)
        if (Array.isArray(s.selectedEmployees)) setSelectedEmployees(s.selectedEmployees)
        if (typeof s.selectedOption === 'number') setSelectedOption(s.selectedOption)
        if (typeof s.carpetEnabled === 'boolean') setCarpetEnabled(s.carpetEnabled)
        if (s.carpetRooms) setCarpetRooms(s.carpetRooms)
        if (Array.isArray(s.carpetEmployees)) setCarpetEmployees(s.carpetEmployees)
        if (typeof s.recurringEnabled === 'boolean') setRecurringEnabled(s.recurringEnabled)
        if (s.recurringOption) setRecurringOption(s.recurringOption)
        if (s.recurringMonths) setRecurringMonths(s.recurringMonths)
      } catch {}
    }
    initializedRef.current = true
  }, [])

  useEffect(() => {
    if (!initializedRef.current) return
    const data = {
      clientSearch,
      selectedClient,
      newClient,
      showNewClient,
      selectedTemplate,
      showNewTemplate,
      editing,
      templateForm,
      date,
      time,
      adminId,
      paid,
      tip,
      paymentMethod,
      otherPayment,
      selectedEmployees,
      selectedOption,
      carpetEnabled,
      carpetRooms,
      carpetEmployees,
      recurringEnabled,
      recurringOption,
      recurringMonths,
    }
    sessionStorage.setItem('createAppointmentState', JSON.stringify(data))
  }, [clientSearch, selectedClient, newClient, showNewClient, selectedTemplate, showNewTemplate, editing, templateForm, date, time, adminId, paid, tip, paymentMethod, otherPayment, selectedEmployees, selectedOption, carpetEnabled, carpetRooms, carpetEmployees, recurringEnabled, recurringOption, recurringMonths])

  const resetCarpet = () => {
    setCarpetEnabled(false)
    setShowCarpetModal(false)
    setCarpetRooms('')
    setCarpetEmployees([])
    setCarpetRate(null)
  }

  const resetTemplateRelated = () => {
    setSelectedTemplate(null)
    setShowNewTemplate(false)
    setEditing(false)
    setTemplateForm({
      templateName: '',
      type: 'STANDARD',
      size: '',
      address: '',
      price: '',
      notes: '',
    })
    setDate('')
    setTime('')
    setStaffOptions([])
    setSelectedOption(0)
    setEmployees([])
    setSelectedEmployees([])
    setShowTeamModal(false)
    setEmployeeSearch('')
    setPayRate(null)
    resetCarpet()
    setRecurringEnabled(false)
    setShowRecurringModal(false)
    setRecurringOption('Weekly')
    setRecurringMonths('')
    setPaid(false)
    setTip('')
    setPaymentMethod('')
    setOtherPayment('')
  }

  const resetAll = () => {
    setSelectedClient(null)
    setClientSearch('')
    setShowNewClient(false)
    setNewClient({ name: '', number: '', notes: '' })
    setTemplates([])
    resetTemplateRelated()
    setAdminId('')
  }

  // Load admins on mount
  useEffect(() => {
    fetchJson(`${API_BASE_URL}/admins`)
      .then((d) => setAdmins(d))
      .catch((err) => console.error(err))
  }, [])

  // Preload client if provided
  useEffect(() => {
    if (!initialClientId) return
    fetchJson(`${API_BASE_URL}/clients/${initialClientId}`)
      .then((c) => setSelectedClient(c))
      .catch(() => {})
  }, [initialClientId])

  // Load clients when search changes
  useEffect(() => {
    fetchJson(
      `${API_BASE_URL}/clients?search=${encodeURIComponent(
        clientSearch
      )}&skip=0&take=20`
    )
      .then((d) => setClients(d))
      .catch((err) => console.error(err))
  }, [clientSearch])

  // Load templates when client selected
  const prevClientRef = useRef<Client | null>(null)
  useEffect(() => {
    if (!selectedClient) {
      setTemplates([])
      if (prevClientRef.current) setSelectedTemplate(null)
      prevClientRef.current = selectedClient
      return
    }
    fetchJson(`${API_BASE_URL}/appointment-templates?clientId=${selectedClient.id}`)
      .then((d) => {
        setTemplates(d)
        const storedId = storedTemplateIdRef.current
        if (storedId !== null) {
          const match = d.find((t: any) => t.id === storedId)
          if (match) {
            setSelectedTemplate(match.id)
            storedTemplateIdRef.current = null
            return
          }
        }
        if (initialTemplateId) {
          const match = d.find((t: any) => t.id === initialTemplateId)
          if (match) setSelectedTemplate(match.id)
        }
      })
      .catch((err) => console.error(err))
    prevClientRef.current = selectedClient
  }, [selectedClient, initialTemplateId])

  useEffect(() => {
    if (templates.length === 0) return
    const storedId = storedTemplateIdRef.current
    if (storedId !== null) {
      const match = templates.find((t) => t.id === storedId)
      if (match) setSelectedTemplate(match.id)
      storedTemplateIdRef.current = null
    }
  }, [templates])

  // Load staff options when template selected
  useEffect(() => {
    if (!selectedTemplate) {
      setStaffOptions([])
      return
    }
    const t = templates.find((tt) => tt.id === selectedTemplate)
    if (!t || !t.size) return
    fetchJson(`${API_BASE_URL}/staff-options?size=${encodeURIComponent(t.size)}&type=${t.type}`)
      .then((d) => {
        setStaffOptions(d)
        setSelectedOption(0)
      })
      .catch((err) => console.error(err))
    fetchJson(`${API_BASE_URL}/employees?search=&skip=0&take=1000`)
      .then((d) => setEmployees(d))
      .catch((err) => console.error(err))
  }, [selectedTemplate])

  // calculate pay rate when team changes
  useEffect(() => {
    const t = templates.find((tt) => tt.id === selectedTemplate)
    if (!t || !t.size || selectedEmployees.length === 0) {
      setPayRate(null)
      return
    }
    fetchJson(
      `${API_BASE_URL}/pay-rate?type=${t.type}&size=${encodeURIComponent(
        t.size
      )}&count=${selectedEmployees.length}`
    )
      .then((d) => setPayRate(d.rate))
      .catch(() => setPayRate(null))
  }, [selectedEmployees.length, selectedTemplate])

  // calculate carpet cleaning rate per employee
  useEffect(() => {
    if (!carpetEnabled) {
      setCarpetRate(null)
      return
    }
    const t = templates.find((tt) => tt.id === selectedTemplate)
    if (!t || !t.size || !carpetRooms || carpetEmployees.length === 0) {
      setCarpetRate(null)
      return
    }
    fetchJson(
      `${API_BASE_URL}/carpet-rate?size=${encodeURIComponent(
        t.size
      )}&rooms=${carpetRooms}`
    )
      .then((d) => setCarpetRate(d.rate / carpetEmployees.length))
      .catch(() => setCarpetRate(null))
  }, [carpetEnabled, carpetRooms, carpetEmployees.length, selectedTemplate])

  

  const createClient = async () => {
    const res = await fetch(`${API_BASE_URL}/clients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', "ngrok-skip-browser-warning": "1" },
      body: JSON.stringify(newClient),
    })
    if (res.ok) {
      const c = await res.json()
      setSelectedClient(c)
      resetTemplateRelated()
      setShowNewClient(false)
      setClientSearch('')
    } else {
      const err = await res.json().catch(() => ({}))
      alert(err.error || 'Failed to create client')
    }
  }

  const startEditTemplate = () => {
    if (!selectedTemplate) return
    const t = templates.find((tt) => tt.id === selectedTemplate)
    if (!t) return
    const base = t.templateName.replace(/_\d+$/, '')
    let max = 0
    templates
      .filter((tt) =>
        tt.templateName === base || tt.templateName.startsWith(base + '_')
      )
      .forEach((tt) => {
        const match = tt.templateName.match(/_(\d+)$/)
        if (match) {
          const n = parseInt(match[1], 10)
          if (n > max) max = n
        }
      })
    setTemplateForm({
      templateName: `${base}_${max + 1}`,
      type: t.type,
      size: t.size || '',
      address: t.address,
      price: String(t.price),
      notes: t.cityStateZip || '',
    })
    setEditing(true)
    setShowNewTemplate(true)
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
    const res = await fetch(`${API_BASE_URL}/appointment-templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', "ngrok-skip-browser-warning": "1" },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      const t = await res.json()
      setTemplates((p) => [...p, t])
      resetTemplateRelated()
      setSelectedTemplate(t.id)
      setShowNewTemplate(false)
      setEditing(false)
    } else {
      alert('Failed to create template')
    }
  }

  const isValidSelection = () => {
    if (staffOptions.length === 0) return true
    const opt = staffOptions[selectedOption]
    if (!opt) return false
    const experienced = selectedEmployees.filter((id) => employees.find((e) => e.id === id)?.experienced).length
    const total = selectedEmployees.length
    return total >= opt.sem + opt.com && experienced >= opt.com
  }

  const isValidCarpet = () => {
    if (!carpetEnabled) return true
    return carpetRooms !== '' && carpetEmployees.length > 0
  }

  const createAppointment = async () => {
    if (!selectedClient || !selectedTemplate) return
    const res = await fetch(`${API_BASE_URL}/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', "ngrok-skip-browser-warning": "1" },
      body: JSON.stringify({
        clientId: selectedClient.id,
        templateId: selectedTemplate,
        date,
        time,
        hours: staffOptions[selectedOption]?.hours,
        employeeIds: selectedEmployees,
        adminId: adminId || undefined,
        paid,
        paymentMethod: paid ? (paymentMethod || 'CASH') : 'CASH',
        paymentMethodNote:
          paid && paymentMethod === 'OTHER' && otherPayment ? otherPayment : undefined,
        tip: paid ? parseFloat(tip) || 0 : 0,
        status: newStatus ?? 'APPOINTED',
      }),
    })
    if (res.ok) {
      onCreated()
      handleClose()
    } else {
      alert('Failed to create appointment')
    }
  }

  return (
    <>
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-20 p-2"
      onClick={handleClose}
    >
      <div
        className="bg-white p-4 sm:p-6 rounded w-full max-w-md max-h-full overflow-y-auto overflow-x-hidden space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">New Appointment</h2>
          <button onClick={handleClose}>X</button>
        </div>

        {/* Client selection */}
        {selectedClient ? (
          <div className="mb-2">
            <div className="flex items-center justify-between">
              <div className="font-medium">Client: {selectedClient.name}</div>
              <button
                className="text-sm text-blue-500"
                onClick={resetAll}
              >
                change
              </button>
            </div>
            <div className="text-sm border rounded p-2 mt-1 space-y-1">
              <div>Number: {selectedClient.number}</div>
              {selectedClient.notes && <div>Notes: {selectedClient.notes}</div>}
            </div>
          </div>
        ) : showNewClient ? (
          <div className="space-y-2 border p-2 rounded">
              <h3 className="font-medium">New Client</h3>
              <h4 className="font-light">Name <span className="text-red-500">*</span></h4>
            <input
              className="w-full border p-2 rounded text-base"
              placeholder="Name"
              value={newClient.name}
              onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
              />
              <h4 className="font-light">Number <span className="text-red-500">*</span></h4>
            <input
              className="w-full border p-2 rounded text-base"
              placeholder="Number"
              value={newClient.number}
              onChange={handleNewClientNumberChange}
              />
              <h4 className="font-light">Notes:</h4>
            <textarea
              className="w-full border p-2 rounded text-base"
              placeholder="Notes"
              value={newClient.notes}
              onChange={(e) => setNewClient({ ...newClient, notes: e.target.value })}
            />
            <div className="flex gap-2 justify-end">
              <button className="px-3 py-2" onClick={() => setShowNewClient(false)}>
                Cancel
              </button>
              <button className="px-3 py-2 text-blue-600" onClick={createClient}>
                Save
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex gap-2 mb-1">
              <input
                className="flex-1 border p-2 rounded text-base"
                placeholder="Search clients"
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
              />
              <button className="px-3 py-2 text-sm" onClick={() => setShowNewClient(true)}>
                New
              </button>
            </div>
            <ul className="max-h-32 overflow-y-auto border rounded divide-y">
              {clients.map((c) => (
                <li
                  key={c.id}
                  className="p-1 hover:bg-gray-100 cursor-pointer"
                  onClick={() => {
                    setSelectedClient(c)
                    resetTemplateRelated()
                  }}
                >
                  <div className="font-medium">{c.name}</div>
                  <div className="text-sm text-gray-600">{c.number}</div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Template selection */}
        {selectedClient && (
          <div>
            {showNewTemplate ? (
              <div className="space-y-2 border p-2 rounded">
                  <h3 className="font-medium">{editing ? 'Edit Template' : 'New Template'}</h3>
                  <h4 className="font-light">Name: <span className="text-red-500">*</span></h4>
                <input
                  className="w-full border p-2 rounded text-base"
                  placeholder="Name"
                  value={templateForm.templateName}
                  onChange={(e) => setTemplateForm({ ...templateForm, templateName: e.target.value })}
                  />
                  <h4 className="font-light">Type: <span className="text-red-500">*</span></h4>
                <select
                  className="w-full border p-2 rounded text-base"
                  value={templateForm.type}
                  onChange={(e) => setTemplateForm({ ...templateForm, type: e.target.value })}
                >
                  <option value="DEEP">Deep</option>
                  <option value="MOVE_IN_OUT">Move in/out</option>
                  <option value="STANDARD">Standard</option>
                  </select>
                  <h4 className="font-light">Size: <span className="text-red-500">*</span></h4>
                <select
                  className="w-full border p-2 rounded text-base"
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
                  <h4 className="font-light">Price: <span className="text-red-500">*</span></h4>
                <input
                  className="w-full border p-2 rounded text-base"
                  placeholder="Price"
                  type="number"
                  value={templateForm.price}
                  onChange={(e) => setTemplateForm({ ...templateForm, price: e.target.value })}
                  />
                  <h4 className="font-light">Address: <span className="text-red-500">*</span></h4>
                <input
                  className="w-full border p-2 rounded text-base"
                  placeholder="Address"
                  value={templateForm.address}
                  onChange={(e) => setTemplateForm({ ...templateForm, address: e.target.value })}
                  />
                  <h4 className="font-light">Notes: </h4>
                <textarea
                  className="w-full border p-2 rounded text-base"
                  placeholder="Notes"
                  value={templateForm.notes}
                  onChange={(e) => setTemplateForm({ ...templateForm, notes: e.target.value })}
                />
                <div className="flex gap-2 justify-end">
                  <button className="px-3 py-2" onClick={() => { setShowNewTemplate(false); setEditing(false) }}>
                    Cancel
                  </button>
                  <button className="px-3 py-2 text-blue-600" onClick={createTemplate}>
                    Save
                  </button>
                </div>
              </div>
            ) : selectedTemplate ? (
              <div className="mb-2">
                <div className="flex items-center justify-between">
                  <div className="font-medium">
                    Template: {templates.find((t) => t.id === selectedTemplate)?.templateName}
                  </div>
                  <div className="flex gap-4">
                    <button className="text-sm text-blue-500" onClick={resetTemplateRelated}>
                      change
                    </button>
                    <button className="text-sm text-blue-500" onClick={startEditTemplate}>
                      edit
                    </button>
                  </div>
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
            ) : (
              <div>
                <div className="flex gap-2 mb-1">
                  <select
                    className="flex-1 border p-2 rounded text-base"
                    value={selectedTemplate ?? ''}
                    onChange={(e) => {
                      resetTemplateRelated()
                      setSelectedTemplate(Number(e.target.value))
                    }}
                  >
                    <option value="">Select template</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.templateName}
                      </option>
                    ))}
                  </select>
                  <button className="px-3 py-2 text-sm" onClick={() => { setEditing(false); setShowNewTemplate(true) }}>
                    New
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        

        {/* Team selection */}
        {selectedTemplate && staffOptions.length > 0 && (
          <div className="space-y-1">
            <button
              className="border px-3 py-2 rounded"
              onClick={() => setShowTeamModal(true)}
            >
              Team Options
            </button>
            {selectedEmployees.length > 0 && staffOptions[selectedOption] && (
              <div className="text-sm border rounded p-2 space-y-1">
                <div>Team:</div>
                <ul className="pl-2 list-disc space-y-0.5">
                  {selectedEmployees.map((id) => {
                    const emp = employees.find((e) => e.id === id)
                    if (!emp) return null
                    return (
                      <li key={id}>
                        {emp.name}{' '}
                        {emp.experienced ? <span className="font-bold">(Exp)</span> : ''}{' '}
                        {payRate !== null && (
                          <span className="ml-1 text-sm text-gray-600">${payRate.toFixed(2)}</span>
                        )}
                      </li>
                    )
                  })}
                </ul>
                <div>
                  {staffOptions[selectedOption].sem} SEM / {staffOptions[selectedOption].com}{' '}
                  COM - {staffOptions[selectedOption].hours}h
                </div>
              </div>
            )}
          </div>
        )}

        {/* Carpet cleaning */}
        {selectedTemplate && selectedEmployees.length > 0 && (
          <div className="space-y-1">
            <label className="flex items-center gap-2">
              <span>Carpet Cleaning</span>
              <input
                type="checkbox"
                checked={carpetEnabled}
                onChange={(e) => {
                  setCarpetEnabled(e.target.checked)
                  if (!e.target.checked) {
                    setCarpetEmployees([])
                    setCarpetRooms('')
                  }
                }}
              />
            </label>
            {carpetEnabled && (
              <>
                <button
                  className="border px-3 py-2 rounded"
                  onClick={() => setShowCarpetModal(true)}
                >
                  Carpet Options
                </button>
                {carpetEmployees.length > 0 && carpetRate !== null && (
                  <div className="text-sm border rounded p-2 space-y-1">
                    <div>Carpet Team:</div>
                    <ul className="pl-2 list-disc space-y-0.5">
                      {carpetEmployees.map((id) => {
                        const emp = employees.find((e) => e.id === id)
                        if (!emp) return null
                        return (
                          <li key={id}>
                            {emp.name}{' '}
                            {emp.experienced ? (
                              <span className="font-bold">(Exp)</span>
                            ) : (
                              ''
                            )}{' '}
                            <span className="ml-1 text-sm text-gray-600">
                              ${carpetRate.toFixed(2)}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                    <div>Rooms: {carpetRooms}</div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Recurring */}
        {selectedTemplate && selectedEmployees.length > 0 && (
          <div className="space-y-1">
            <label className="flex items-center gap-2">
              <span>Recurring</span>
              <input
                type="checkbox"
                checked={recurringEnabled}
                onChange={(e) => {
                  setRecurringEnabled(e.target.checked)
                  if (!e.target.checked) {
                    setRecurringOption('Weekly')
                    setRecurringMonths('')
                  }
                }}
              />
            </label>
            {recurringEnabled && (
              <>
                <button
                  className="border px-3 py-2 rounded"
                  onClick={() => setShowRecurringModal(true)}
                >
                  Recurring Options
                </button>
                <div className="text-sm border rounded p-2">
                  Frequency:{' '}
                  {recurringOption === 'Other'
                    ? `${recurringMonths} months`
                    : recurringOption}
                </div>
              </>
            )}
          </div>
        )}

        {/* Date and time */}
        {selectedTemplate && (
          <div className="space-y-2">
            <div>
              <h4 className="font-light">
                Date <span className="text-red-500">*</span>
              </h4>
              <input
                type="date"
                className="w-full border p-2 rounded text-base"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div>
              <h4 className="font-light">
                Time <span className="text-red-500">*</span>
              </h4>
              <input
                type="time"
                className="w-full border p-2 rounded text-base"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>
          )}
          
          {/* Admin selection */}
        {selectedTemplate && (
          <div>
            <h4 className="font-light">
              Admin <span className="text-red-500">*</span>
            </h4>
            <select
              className="w-full border p-2 rounded text-base"
              value={adminId}
              onChange={(e) => setAdminId(Number(e.target.value))}
            >
              <option value="">Select admin</option>
              {admins.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name || a.email}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Payment details */}
        {selectedTemplate && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={paid}
                  onChange={(e) => setPaid(e.target.checked)}
                />
                Paid
              </label>
              {paid && (
                <input
                  type="number"
                  className="border p-2 rounded text-base flex-1"
                  placeholder="Tip"
                  value={tip}
                  onChange={(e) => setTip(e.target.value)}
                />
              )}
            </div>
            {paid && (
              <div className="flex flex-col gap-1">
                <select
                  className="w-full border p-2 rounded text-base"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <option value="">Select payment method</option>
                  <option value="CASH">Cash</option>
                  <option value="ZELLE">Zelle</option>
                  <option value="VENMO">Venmo</option>
                  <option value="PAYPAL">Paypal</option>
                  <option value="OTHER">Other</option>
                </select>
                {paymentMethod === 'OTHER' && (
                  <input
                    className="w-full border p-2 rounded text-base"
                    placeholder="Payment method"
                    value={otherPayment}
                    onChange={(e) => setOtherPayment(e.target.value)}
                  />
                )}
              </div>
            )}
          </div>
        )}

        <div className="text-right">
          <button
            className="bg-blue-500 text-white px-6 py-2 rounded disabled:opacity-50"
            disabled={
              !selectedTemplate ||
              !date ||
              !time ||
              !isValidSelection() ||
              !isValidCarpet() ||
              !adminId ||
              (paid && (!paymentMethod || (paymentMethod === 'OTHER' && !otherPayment)))
            }
            onClick={createAppointment}
          >
            Create
          </button>
        </div>
      </div>
    </div>
    {showTeamModal && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-30">
        <div className="bg-white p-4 rounded w-full max-w-xs max-h-full overflow-y-auto overflow-x-hidden space-y-2">
          <div className="flex justify-between items-center">
            <h4 className="font-medium">Team Options</h4>
            <button onClick={() => setShowTeamModal(false)}>X</button>
          </div>
          <div className="space-y-2">
            {staffOptions.map((o, idx) => (
              <button
                key={idx}
              className={`w-full px-3 py-2 border rounded ${selectedOption === idx ? 'bg-blue-500 text-white' : ''}`}
                onClick={() => {
                  setSelectedOption(idx)
                  setSelectedEmployees([])
                  resetCarpet()
                }}
              >
                {o.sem} SEM / {o.com} COM - {o.hours}h
              </button>
            ))}
          </div>
          {staffOptions[selectedOption] && (
            <div className="space-y-1">
              {(() => {
                const opt = staffOptions[selectedOption]
                const exp = selectedEmployees.filter((id) => employees.find((e) => e.id === id)?.experienced).length
                const tot = selectedEmployees.length
                const ok = tot >= opt.sem + opt.com && exp >= opt.com
                return (
                  <div className={ok ? 'text-green-600' : 'text-red-600'}>
                    {tot}/{opt.sem + opt.com} total, {exp}/{opt.com} experienced
                  </div>
                )
              })()}
              <input
                className="w-full border p-2 rounded text-base"
                placeholder="Search employees"
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
              />
              <div className="max-h-32 overflow-y-auto border rounded p-1 space-y-1">
                {filteredEmployees.map((e) => (
                  <label key={e.id} className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={selectedEmployees.includes(e.id!)}
                      onChange={() => {
                        setSelectedEmployees((prev) =>
                          prev.includes(e.id!) ? prev.filter((id) => id !== e.id) : [...prev, e.id!]
                        )
                      }}
                    />
                    {e.name}
                    {e.experienced ? <span className="font-bold">(Exp)</span> : ''}
                    {selectedEmployees.includes(e.id!) && payRate !== null && (
                      <span className="ml-1 text-sm text-gray-600">${payRate.toFixed(2)}</span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="text-right">
            <button
              className="px-3 py-2 text-blue-600 disabled:text-gray-400"
              disabled={!isValidSelection()}
              onClick={() => {
                if (isValidSelection()) setShowTeamModal(false)
              }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    )}
    {showCarpetModal && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-30">
        <div className="bg-white p-4 rounded w-full max-w-xs max-h-full overflow-y-auto overflow-x-hidden space-y-2">
          <div className="flex justify-between items-center">
            <h4 className="font-medium">Carpet Options</h4>
            <button onClick={() => setShowCarpetModal(false)}>X</button>
          </div>
          <div className="space-y-2">
            <div>
              <h4 className="font-light">How many rooms?</h4>
              <input
                type="number"
                min="1"
                className="w-full border p-2 rounded text-base"
                value={carpetRooms}
                onChange={(e) => setCarpetRooms(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <div>Employees:</div>
              <div className="max-h-32 overflow-y-auto border rounded p-1 space-y-1">
                {employees
                  .filter((e) => selectedEmployees.includes(e.id!))
                  .map((e) => (
                    <label key={e.id} className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={carpetEmployees.includes(e.id!)}
                        onChange={() => {
                          setCarpetEmployees((prev) =>
                            prev.includes(e.id!) ? prev.filter((id) => id !== e.id) : [...prev, e.id!]
                          )
                        }}
                      />
                      {e.name}
                    </label>
                  ))}
              </div>
            </div>
          </div>
          <div className="text-right">
            <button
              className="px-3 py-2 text-blue-600 disabled:text-gray-400"
              disabled={!carpetRooms || carpetEmployees.length === 0}
              onClick={() => {
                if (carpetRooms && carpetEmployees.length > 0) setShowCarpetModal(false)
              }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    )}
    {showRecurringModal && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-30">
        <div className="bg-white p-4 rounded w-full max-w-xs max-h-full overflow-y-auto overflow-x-hidden space-y-2">
          <div className="flex justify-between items-center">
            <h4 className="font-medium">Recurring Options</h4>
            <button onClick={() => setShowRecurringModal(false)}>X</button>
          </div>
          <div className="space-y-2">
            <select
              className="w-full border p-2 rounded text-base"
              value={recurringOption}
              onChange={(e) => setRecurringOption(e.target.value as RecurringOption)}
            >
              {recurringOptions.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
            {recurringOption === 'Other' && (
              <div>
                <h4 className="font-light">Every how many months?</h4>
                <input
                  type="number"
                  min="1"
                  className="w-full border p-2 rounded text-base"
                  value={recurringMonths}
                  onChange={(e) => setRecurringMonths(e.target.value)}
                />
              </div>
            )}
          </div>
          <div className="text-right">
            <button
              className="px-3 py-2 text-blue-600 disabled:text-gray-400"
              disabled={recurringOption === 'Other' && !recurringMonths}
              onClick={() => {
                if (recurringOption !== 'Other' || recurringMonths) setShowRecurringModal(false)
              }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}

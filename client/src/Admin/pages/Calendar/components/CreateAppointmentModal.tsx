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
  initialAppointment?: import('../types').Appointment
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

export default function CreateAppointmentModal({ onClose, onCreated, initialClientId, initialTemplateId, newStatus, initialAppointment }: Props) {
  const persisted = (() => {
    const stored = localStorage.getItem('createAppointmentState')
    if (stored) {
      try {
        return JSON.parse(stored) as Record<string, any>
      } catch {
        // ignore parse errors
      }
    }
    return {}
  })()

  const [clientSearch, setClientSearch] = useState<string>(persisted.clientSearch ?? '')
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClient, setSelectedClient] = useState<Client | null>(persisted.selectedClient ?? null)
  const [newClient, setNewClient] = useState<{ name: string; number: string; notes: string }>(
    persisted.newClient ?? { name: '', number: '', notes: '' },
  )
  const [showNewClient, setShowNewClient] = useState<boolean>(persisted.showNewClient ?? false)

  const handleNewClientNumberChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = e.target.value
    const digits = value.replace(/\D/g, '').slice(0, 10)
    setNewClient({ ...newClient, number: digits })
  }

  const getInitialTemplate = () => {
    const stored = localStorage.getItem('createAppointmentState')
    if (stored) {
      try {
        const s = JSON.parse(stored)
        if (typeof s.selectedTemplate === 'number') return s.selectedTemplate
      } catch {}
    }
    const local = localStorage.getItem('createAppointmentSelectedTemplateId')
    if (local) {
      const id = Number(local)
      if (!isNaN(id)) return id
    }
    return null
  }

  const storedInitialTemplateId = getInitialTemplate()
  const [templates, setTemplates] = useState<AppointmentTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(storedInitialTemplateId)
  const [showNewTemplate, setShowNewTemplate] = useState<boolean>(persisted.showNewTemplate ?? false)
  const [editing, setEditing] = useState<boolean>(persisted.editing ?? false)
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(persisted.editingTemplateId ?? null)
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
    ...(persisted.templateForm || {}),
  })

  const [date, setDate] = useState<string>(persisted.date ?? '')
  const [time, setTime] = useState<string>(persisted.time ?? '')

  const [admins, setAdmins] = useState<{ id: number; name: string | null; email: string }[]>([])
  const [adminId, setAdminId] = useState<number | ''>(persisted.adminId ?? '')
  const [paid, setPaid] = useState<boolean>(persisted.paid ?? false)
  const [tip, setTip] = useState<string>(persisted.tip ?? '')
  const [paymentMethod, setPaymentMethod] = useState<string>(persisted.paymentMethod ?? '')
  const [otherPayment, setOtherPayment] = useState<string>(persisted.otherPayment ?? '')

  // staff options and employee selection
  const [staffOptions, setStaffOptions] = useState<{ sem: number; com: number; hours: number }[]>([])
  const [selectedOption, setSelectedOption] = useState<number>(persisted.selectedOption ?? 0)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedEmployees, setSelectedEmployees] = useState<number[]>(persisted.selectedEmployees ?? [])
  const [showTeamModal, setShowTeamModal] = useState<boolean>(persisted.showTeamModal ?? false)
  const [employeeSearch, setEmployeeSearch] = useState<string>(persisted.employeeSearch ?? '')
  const [payRate, setPayRate] = useState<number | null>(null)
  const filteredEmployees = employees.filter(
    (e) =>
      e.name.toLowerCase().includes(employeeSearch.toLowerCase()) ||
      e.number.includes(employeeSearch)
  )

  // carpet cleaning options
  const [carpetEnabled, setCarpetEnabled] = useState<boolean>(persisted.carpetEnabled ?? false)
  const [carpetRooms, setCarpetRooms] = useState<string>(persisted.carpetRooms ?? '')
  const [carpetEmployees, setCarpetEmployees] = useState<number[]>(persisted.carpetEmployees ?? [])
  const [carpetRate, setCarpetRate] = useState<number | null>(null)
  const [defaultCarpetPrice, setDefaultCarpetPrice] = useState<number | null>(null)
  const [overrideCarpetPrice, setOverrideCarpetPrice] = useState<boolean>(
    persisted.overrideCarpetPrice ?? false,
  )

  const selectedTemplateData = selectedTemplate
    ? templates.find((tt) => tt.id === selectedTemplate)
    : null

  // recurring options
  const recurringOptions = [
    'Weekly',
    'Biweekly',
    'Thrweekly',
    'Monthly',
    'Other',
  ] as const
  type RecurringOption = (typeof recurringOptions)[number]
  const [recurringEnabled, setRecurringEnabled] = useState<boolean>(persisted.recurringEnabled ?? false)
  const [showRecurringModal, setShowRecurringModal] = useState(false)
  const [recurringOption, setRecurringOption] = useState<RecurringOption>(persisted.recurringOption ?? 'Weekly')
  const [recurringMonths, setRecurringMonths] = useState<string>(persisted.recurringMonths ?? '')

  const handleClose = () => {
    onClose()
  }

  const handleCancel = () => {
    localStorage.removeItem('createAppointmentState')
    localStorage.removeItem('createAppointmentSelectedTemplateId')
    onClose()
  }

const initializedRef = useRef(false)
const storedTemplateIdRef = useRef<number | null>(storedInitialTemplateId)
const preserveTeamRef = useRef(false)

  const loadStaffData = (templateId: number) => {
    const t = templates.find((tt) => tt.id === templateId)
    if (!t || !t.size) return
    fetchJson(`${API_BASE_URL}/staff-options?size=${encodeURIComponent(t.size)}&type=${t.type}`)
      .then((d) => {
        setStaffOptions(d)
      })
      .catch((err) => console.error(err))
    fetchJson(`${API_BASE_URL}/employees?search=&skip=0&take=1000`)
      .then((d) => setEmployees(d))
      .catch((err) => console.error(err))
  }

  useEffect(() => {
    if (initialAppointment) {
      if (initialAppointment.client) setSelectedClient(initialAppointment.client)
      setDate(initialAppointment.date.slice(0, 10))
      setTime(initialAppointment.time)
      if (initialAppointment.employees)
        setSelectedEmployees(initialAppointment.employees.map((e) => e.id))
      if (initialAppointment.adminId)
        setAdminId(initialAppointment.adminId)
      if (initialAppointment.paid !== undefined) setPaid(initialAppointment.paid)
      if (initialAppointment.tip != null) setTip(String(initialAppointment.tip))
      if (initialAppointment.paymentMethod)
        setPaymentMethod(initialAppointment.paymentMethod)
      if ((initialAppointment as any).carpetRooms) {
        setCarpetEnabled(true)
        setCarpetRooms(String((initialAppointment as any).carpetRooms))
      }
      if (initialAppointment.reoccurring) setRecurringEnabled(true)
      initializedRef.current = true
      localStorage.removeItem('createAppointmentState')
    } else {
      const stored = localStorage.getItem('createAppointmentState')
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
          if (typeof s.editingTemplateId === 'number')
            setEditingTemplateId(s.editingTemplateId)
          if (s.templateForm) setTemplateForm({ ...templateForm, ...s.templateForm })
          if (s.date) setDate(s.date)
          if (s.time) setTime(s.time)
          if (typeof s.adminId !== 'undefined')
            setAdminId(s.adminId === '' ? '' : Number(s.adminId))
          if (typeof s.paid === 'boolean') setPaid(s.paid)
          if (s.tip) setTip(s.tip)
          if (s.paymentMethod) setPaymentMethod(s.paymentMethod)
          if (s.otherPayment) setOtherPayment(s.otherPayment)
          if (Array.isArray(s.selectedEmployees)) setSelectedEmployees(s.selectedEmployees)
          if (typeof s.selectedOption === 'number') setSelectedOption(s.selectedOption)
          if (typeof s.carpetEnabled === 'boolean') setCarpetEnabled(s.carpetEnabled)
          if (s.carpetRooms) setCarpetRooms(s.carpetRooms)
          if (Array.isArray(s.carpetEmployees)) setCarpetEmployees(s.carpetEmployees)
          if (typeof s.overrideCarpetPrice === 'boolean')
            setOverrideCarpetPrice(s.overrideCarpetPrice)
          if (typeof s.recurringEnabled === 'boolean') setRecurringEnabled(s.recurringEnabled)
          if (s.recurringOption) setRecurringOption(s.recurringOption)
          if (s.recurringMonths) setRecurringMonths(s.recurringMonths)
        } catch {}
      }
      initializedRef.current = true
    }
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
      editingTemplateId,
      templateForm,
      date,
      time,
      adminId,
      paid,
      tip,
      paymentMethod,
      otherPayment,
      showTeamModal,
      employeeSearch,
      selectedEmployees,
      selectedOption,
      carpetEnabled,
      carpetRooms,
      carpetPrice: templateForm.carpetPrice,
      overrideCarpetPrice,
      carpetEmployees,
      recurringEnabled,
      recurringOption,
      recurringMonths,
    }
    localStorage.setItem('createAppointmentState', JSON.stringify(data))
  }, [clientSearch, selectedClient, newClient, showNewClient, selectedTemplate, showNewTemplate, editing, editingTemplateId, templateForm, date, time, adminId, paid, tip, paymentMethod, otherPayment, showTeamModal, employeeSearch, selectedEmployees, selectedOption, carpetEnabled, carpetRooms, templateForm.carpetPrice, overrideCarpetPrice, carpetEmployees, recurringEnabled, recurringOption, recurringMonths])

  useEffect(() => {
    if (selectedTemplate !== null) {
      localStorage.setItem('createAppointmentSelectedTemplateId', String(selectedTemplate))
    } else {
      localStorage.removeItem('createAppointmentSelectedTemplateId')
    }

    const stored = localStorage.getItem('createAppointmentState')
    if (stored) {
      try {
        const data = JSON.parse(stored)
        data.selectedTemplate = selectedTemplate
        data.editingTemplateId = editingTemplateId
        localStorage.setItem('createAppointmentState', JSON.stringify(data))
      } catch {}
    }
  }, [selectedTemplate, templates, editingTemplateId])

  const resetCarpet = (disable: boolean = true) => {
    if (disable) setCarpetEnabled(false)
    setCarpetRooms('')
    setCarpetEmployees([])
    setCarpetRate(null)
    setDefaultCarpetPrice(null)
    setOverrideCarpetPrice(false)
  }

  const resetTemplateRelated = () => {
    setSelectedTemplate(null)
    setShowNewTemplate(false)
    setEditing(false)
    setEditingTemplateId(null)
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
    setDefaultCarpetPrice(null)
    setOverrideCarpetPrice(false)
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
          if (match && match.id !== undefined) {
            setSelectedTemplate(match.id)
            loadStaffData(match.id)
            storedTemplateIdRef.current = null
            return
          }
        }
        if (initialTemplateId) {
          const match = d.find((t: any) => t.id === initialTemplateId)
          if (match && match.id !== undefined) {
            setSelectedTemplate(match.id)
            loadStaffData(match.id)
          }
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
      if (match && match.id !== undefined) {
        setSelectedTemplate(match.id)
        loadStaffData(match.id)
      }
      storedTemplateIdRef.current = null
    }
    if (selectedTemplate) loadStaffData(selectedTemplate)
  }, [templates])

  // Load staff options when template selected
  useEffect(() => {
    if (!selectedTemplate) {
      setStaffOptions([])
      setCarpetEnabled(false)
      setCarpetRooms('')
      return
    }
    loadStaffData(selectedTemplate)
    if (preserveTeamRef.current) {
      preserveTeamRef.current = false
    } else {
      setSelectedOption(0)
    }
    const t = templates.find((tt) => tt.id === selectedTemplate)
    const hasCarpet = t?.carpetEnabled ?? (t?.carpetRooms != null && t.carpetRooms > 0)
    setCarpetEnabled(!!hasCarpet)
    setCarpetRooms(t?.carpetRooms || '')
  }, [selectedTemplate, templates])

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

  // calculate default carpet price
  useEffect(() => {
    if (!carpetEnabled) {
      setDefaultCarpetPrice(null)
      return
    }
    if (!carpetRooms) {
      setDefaultCarpetPrice(null)
      return
    }
    const size = selectedTemplate
      ? templates.find((tt) => tt.id === selectedTemplate)?.size
      : templateForm.size
    if (!size) return
    const parseSize = (s: string): number | null => {
      const parts = s.split('-')
      let n = parseInt(parts[1] || parts[0])
      if (isNaN(n)) n = parseInt(s)
      return isNaN(n) ? null : n
    }
    const sqft = parseSize(size)
    if (sqft === null) return
    const price = (parseInt(carpetRooms, 10) || 0) * (sqft >= 4000 ? 40 : 35)
    setDefaultCarpetPrice(price)
    if (!overrideCarpetPrice) {
      setTemplateForm((f) => ({ ...f, carpetPrice: String(price) }))
    }
  }, [carpetEnabled, carpetRooms, selectedTemplate, templateForm.size, overrideCarpetPrice])

  

  const createClient = async () => {
    const missing: string[] = []
    if (!newClient.name.trim()) missing.push('name')
    if (!newClient.number.trim()) missing.push('number')
    if (missing.length > 0) {
      alert('Please provide: ' + missing.join(', '))
      return
    }
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
      notes: t.notes || '',
      instructions: t.instructions || '',
      carpetEnabled: !!t.carpetEnabled,
      carpetRooms: t.carpetRooms || '',
      carpetPrice: t.carpetPrice != null ? String(t.carpetPrice) : '',
    })
    setEditing(true)
    setEditingTemplateId(selectedTemplate)
    setShowNewTemplate(true)
  }

  const createTemplate = async () => {
    if (!selectedClient) return
    const missing: string[] = []
    if (!templateForm.templateName.trim()) missing.push('template name')
    if (!templateForm.address.trim()) missing.push('address')
    if (templateForm.price === '') missing.push('price')
    if (templateForm.carpetEnabled) {
      const rooms = parseInt(templateForm.carpetRooms, 10)
      if (isNaN(rooms) || rooms < 1) {
        missing.push('carpet rooms (min 1)')
      }
    }
    if (missing.length > 0) {
      alert('Please provide: ' + missing.join(', '))
      return
    }
    const payload: any = {
      clientId: selectedClient.id,
      templateName: templateForm.templateName,
      type: templateForm.type,
      size: templateForm.size || undefined,
      address: templateForm.address,
      price: parseFloat(templateForm.price),
      notes: templateForm.notes || undefined,
      instructions: templateForm.instructions || undefined,
    }
    if (templateForm.carpetEnabled) {
      payload.carpetRooms = parseInt(templateForm.carpetRooms, 10) || 0
      if (editing) {
        payload.carpetPrice = parseFloat(templateForm.carpetPrice) || 0
      }
    }
    const res = await fetch(`${API_BASE_URL}/appointment-templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', "ngrok-skip-browser-warning": "1" },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      const t = await res.json()
      setTemplates((p) => {
        const filtered = editing && editingTemplateId
          ? p.filter((tt) => tt.id !== editingTemplateId)
          : p
        return [
          ...filtered,
          {
            ...t,
            carpetEnabled: templateForm.carpetEnabled,
            carpetRooms: templateForm.carpetRooms,
            carpetPrice: editing
              ? parseFloat(templateForm.carpetPrice)
              : t.carpetPrice,
          },
        ]
      })
      if (editing) {
        preserveTeamRef.current = true
      } else {
        resetTemplateRelated()
      }
      setSelectedTemplate(t.id)
      setShowNewTemplate(false)
      setEditing(false)
      setEditingTemplateId(null)
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
    const missing: string[] = []
    if (!selectedClient) missing.push('client')
    if (!selectedTemplate) missing.push('template')
    if (!date) missing.push('date')
    if (!time) missing.push('time')
    if (!adminId) missing.push('admin')
    if (missing.length > 0) {
      alert('Please provide: ' + missing.join(', '))
      return
    }
    if (!isValidCarpet()) {
      alert('Please complete carpet cleaning info')
      return
    }
    if (selectedEmployees.length < 1) {
      alert('Team must have at least one member')
      return
    }
    if (!isValidSelection()) {
      const proceed = confirm('Team is less than required. Continue?')
      if (!proceed) return
    }
    if (time) {
      const hour = parseInt(time.split(':')[0], 10)
      if (hour < 6 || hour >= 18) {
        const ok = confirm('Selected time is outside 6am-6pm. Continue?')
        if (!ok) return
      }
    }
    const body = {
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
      status: recurringEnabled ? 'REOCCURRING' : newStatus ?? 'APPOINTED',
      ...(carpetEnabled
        ? {
            carpetRooms: parseInt(carpetRooms, 10) || 0,
            carpetPrice: parseFloat(templateForm.carpetPrice) || undefined,
          }
        : {}),
    }

    let url = recurringEnabled ? `${API_BASE_URL}/appointments/recurring` : `${API_BASE_URL}/appointments`
    const extra: any = {}
    if (recurringEnabled) {
      extra.frequency =
        recurringOption === 'Weekly'
          ? 'WEEKLY'
          : recurringOption === 'Biweekly'
          ? 'BIWEEKLY'
          : recurringOption === 'Thrweekly'
          ? 'EVERY3'
          : recurringOption === 'Monthly'
          ? 'MONTHLY'
          : 'CUSTOM'
      if (recurringOption === 'Other') extra.months = parseInt(recurringMonths || '1', 10)
      extra.count = 6
    }
    let method: 'POST' | 'PUT' = 'POST'
    let payload: any = { ...body, ...extra }
    if (initialAppointment) {
      method = 'PUT'
      const applyAll =
        initialAppointment.reoccurring &&
        confirm('Apply changes to all future occurrences?')
      url = `${API_BASE_URL}/appointments/${initialAppointment.id}${applyAll ? '?future=true' : ''}`
    }

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      onCreated()
      handleCancel()
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
          <h2 className="text-lg font-semibold">
            {initialAppointment ? 'Edit Appointment' : 'New Appointment'}
          </h2>
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
              id="appointment-new-client-name"
              className="w-full border p-2 rounded text-base"
              placeholder="Name"
              value={newClient.name}
              onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
            />
              <h4 className="font-light">Number <span className="text-red-500">*</span></h4>
            <input
              id="appointment-new-client-number"
              className="w-full border p-2 rounded text-base"
              placeholder="Number"
              value={newClient.number}
              onChange={handleNewClientNumberChange}
            />
              <h4 className="font-light">Notes:</h4>
            <textarea
              id="appointment-new-client-notes"
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
                id="appointment-client-search"
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
                  id="appointment-template-name"
                  className="w-full border p-2 rounded text-base"
                  placeholder="Name"
                  value={templateForm.templateName}
                  onChange={(e) => setTemplateForm({ ...templateForm, templateName: e.target.value })}
                />
                  <h4 className="font-light">Type: <span className="text-red-500">*</span></h4>
                <select
                  id="appointment-template-type"
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
                  id="appointment-template-size"
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
                  id="appointment-template-price"
                  className="w-full border p-2 rounded text-base"
                  placeholder="Price"
                  type="number"
                  value={templateForm.price}
                  onChange={(e) => setTemplateForm({ ...templateForm, price: e.target.value })}
                />
                  <h4 className="font-light">Address: <span className="text-red-500">*</span></h4>
                <input
                  id="appointment-template-address"
                  className="w-full border p-2 rounded text-base"
                  placeholder="Address"
                  value={templateForm.address}
                  onChange={(e) => setTemplateForm({ ...templateForm, address: e.target.value })}
                />
                <h4 className="font-light">Instructions:</h4>
                <textarea
                  id="appointment-template-instructions"
                  className="w-full border p-2 rounded text-base"
                  placeholder="Instructions"
                  value={templateForm.instructions}
                  onChange={(e) =>
                    setTemplateForm({ ...templateForm, instructions: e.target.value })
                  }
                />
                <h4 className="font-light">Notes: </h4>
                <textarea
                  id="appointment-template-notes"
                  className="w-full border p-2 rounded text-base"
                  placeholder="Notes"
                  value={templateForm.notes}
                  onChange={(e) => setTemplateForm({ ...templateForm, notes: e.target.value })}
                />
                <>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={templateForm.carpetEnabled}
                      onChange={(e) => {
                        setTemplateForm({
                          ...templateForm,
                          carpetEnabled: e.target.checked,
                          ...(e.target.checked ? {} : { carpetRooms: '' }),
                        })
                      }}
                    />
                    <span>Carpet Cleaning</span>
                  </label>
                  {templateForm.carpetEnabled && (
                    <div>
                      <h4 className="font-light">How many rooms?</h4>
                      <input
                        id="appointment-template-carpet-rooms"
                        type="number"
                        min="1"
                        className="w-full border p-2 rounded text-base"
                        value={templateForm.carpetRooms}
                        onChange={(e) =>
                          setTemplateForm({ ...templateForm, carpetRooms: e.target.value })
                        }
                      />
                      {editing && defaultCarpetPrice !== null && !overrideCarpetPrice && (
                        <div className="mt-2 flex items-center gap-2">
                          <span>Carpet Price: ${defaultCarpetPrice.toFixed(2)}</span>
                          <button
                            type="button"
                            className="text-sm text-blue-500"
                            onClick={() => setOverrideCarpetPrice(true)}
                          >
                            Edit price
                          </button>
                        </div>
                      )}
                      {editing && overrideCarpetPrice && (
                        <div>
                          <h4 className="font-light mt-2">Carpet Price</h4>
                          <input
                            id="appointment-template-carpet-price"
                            type="number"
                            className="w-full border p-2 rounded text-base"
                            value={templateForm.carpetPrice}
                            onChange={(e) =>
                              setTemplateForm({
                                ...templateForm,
                                carpetPrice: e.target.value,
                              })
                            }
                          />
                          {defaultCarpetPrice !== null && (
                            <button
                              type="button"
                              className="text-sm text-blue-500 mt-1"
                              onClick={() => {
                                setOverrideCarpetPrice(false)
                                setTemplateForm({
                                  ...templateForm,
                                  carpetPrice: String(defaultCarpetPrice),
                                })
                              }}
                            >
                              Use default
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </>
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
                      {t.notes && <div>Notes: {t.notes}</div>}
                      {t.instructions && <div>Instructions: {t.instructions}</div>}
                      {t.carpetEnabled && (
                        <div>Carpet Rooms: {t.carpetRooms}</div>
                      )}
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
              Team Options <span className="text-red-500">*</span>
            </button>
            {selectedEmployees.length > 0 && staffOptions[selectedOption] && (
              <>
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
                {carpetEnabled && carpetEmployees.length > 0 && carpetRate !== null && (
                  <div className="text-sm border rounded p-2 space-y-1">
                    <div>Carpet Team:</div>
                    <ul className="pl-2 list-disc space-y-0.5">
                      {carpetEmployees.map((id) => {
                        const emp = employees.find((e) => e.id === id)
                        if (!emp) return null
                        return (
                          <li key={id}>
                            {emp.name}{' '}
                            {emp.experienced ? <span className="font-bold">(Exp)</span> : ''}{' '}
                            <span className="ml-1 text-sm text-gray-600">${carpetRate.toFixed(2)}</span>
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
                id="appointment-date"
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
                id="appointment-time"
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
              id="appointment-admin"
              className="w-full border p-2 rounded text-base"
              value={adminId}
              onChange={(e) => {
                const val = e.target.value
                setAdminId(val ? Number(val) : '')
              }}
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
                  id="appointment-tip"
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
                  id="appointment-payment-method"
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
                    id="appointment-other-payment"
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

        <div className="text-right space-x-2">
          <button className="px-3 py-2" onClick={handleCancel}>
            Cancel
          </button>
          <button
            className="bg-blue-500 text-white px-6 py-2 rounded disabled:opacity-50"
            disabled={
              !selectedTemplate ||
              !date ||
              !time ||
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
      <div
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-30"
        onClick={() => setShowTeamModal(false)}
      >
        <div
          className="bg-white p-4 rounded w-full max-w-xs max-h-full overflow-y-auto overflow-x-hidden space-y-2"
          onClick={(e) => e.stopPropagation()}
        >
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
                  setCarpetEmployees([])
                  setCarpetRate(null)
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
              {carpetEnabled && (
                <div className="space-y-1">
                  <div>Carpet Team:</div>
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
              )}
            </div>
          )}
          <div className="text-right">
            <button
              className="px-3 py-2 text-blue-600"
              onClick={() => setShowTeamModal(false)}
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

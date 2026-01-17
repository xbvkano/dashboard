import { useEffect, useState, useRef } from 'react'
import { Client } from '../../Clients/components/types'
import type { AppointmentTemplate } from '../types'
import type { Employee } from '../../Employees/components/types'
import { API_BASE_URL, fetchJson } from '../../../../api'
import { useModal } from '../../../../ModalProvider'
import { formatPhone } from '../../../../formatPhone'

interface Props {
  onClose: () => void
  onCreated: (appt: import('../types').Appointment) => void
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
  '5000-5500',
  '5500-6000',
  '6000+',
]

export default function CreateAppointmentModal({ onClose, onCreated, initialClientId, initialTemplateId, newStatus, initialAppointment }: Props) {
  const { alert, confirm } = useModal()
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
  const [newClient, setNewClient] = useState<{ name: string; number: string; notes: string; from: string }>(
    persisted.newClient ?? { name: '', number: '', notes: '', from: '' },
  )
  const [showNewClient, setShowNewClient] = useState<boolean>(persisted.showNewClient ?? false)

  const handleNewClientNumberChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = e.target.value
    const digits = value.replace(/\D/g, '').slice(0, 11)
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
  const [editingTemplateNotes, setEditingTemplateNotes] = useState<boolean>(false)
  const [editingTemplateNotesId, setEditingTemplateNotesId] = useState<number | null>(null)
  const [editingTemplateNotesValue, setEditingTemplateNotesValue] = useState<string>('')
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

  const isTemplateReady =
    templateForm.templateName.trim() !== '' &&
    templateForm.address.trim() !== '' &&
    templateForm.price !== '' &&
    templateForm.size !== '' &&
    (!templateForm.carpetEnabled || parseInt(templateForm.carpetRooms, 10) >= 1)

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
  const [noTeam, setNoTeam] = useState<boolean>(persisted.noTeam ?? false)

  const [showPhoneActions, setShowPhoneActions] = useState(false)
  const isMobile =
    typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  const handlePhoneClick = () => {
    if (isMobile) setShowPhoneActions((prev) => !prev)
  }

  const selectedTemplateData = selectedTemplate
    ? templates.find((tt) => tt.id === selectedTemplate)
    : null

  // Legacy recurring state removed - use Recurring Appointments page instead
  const [creating, setCreating] = useState(false)

  const handleClose = () => {
    localStorage.removeItem('createAppointmentState')
    localStorage.removeItem('createAppointmentSelectedTemplateId')
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
    if (!t) return
    
    // Use template size if available, otherwise use templateForm size (for editing)
    const size = t.size || templateForm.size
    const type = t.type || templateForm.type
    
    if (!size || !type) return
    
    fetchJson(`${API_BASE_URL}/staff-options?size=${encodeURIComponent(size)}&type=${type}`)
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
      // Display date directly from database (stored as local time, not UTC)
      // The date comes as either a string like "2026-01-13T00:00:00.000Z" or a Date object
      // We need to extract the YYYY-MM-DD part directly from the string representation
      // to avoid timezone conversion issues
      let dateStr = ''
      const appointmentDate = initialAppointment.date
      if (typeof appointmentDate === 'string') {
        // If it's a string, split by 'T' to get the date part (YYYY-MM-DD) before the time
        // This avoids any timezone conversion issues
        const datePart = appointmentDate.split('T')[0]
        
        // Verify it's in YYYY-MM-DD format
        if (datePart && datePart.match(/^\d{4}-\d{2}-\d{2}$/)) {
          dateStr = datePart
        } else {
          // Fallback: try to extract YYYY-MM-DD with regex
          const dateMatch = appointmentDate.match(/(\d{4}-\d{2}-\d{2})/)
          if (dateMatch && dateMatch[1]) {
            dateStr = dateMatch[1]
          }
        }
      } else {
        // If it's already a Date object, use UTC methods to extract the original date
        // The date string "2026-01-13T00:00:00.000Z" was parsed as UTC and converted to local
        // We need to use UTC methods to get back the original UTC date parts
        const dateObj = appointmentDate as Date
        const year = dateObj.getUTCFullYear()
        const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0')
        const day = String(dateObj.getUTCDate()).padStart(2, '0')
        dateStr = `${year}-${month}-${day}`
      }
      
      setDate(dateStr)
      setTime(initialAppointment.time)
      if (initialAppointment.employees) {
        const employeeIds = initialAppointment.employees.map((e) => e.id).filter((id): id is number => id !== undefined)
        setSelectedEmployees(employeeIds)
      }
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
      // Legacy recurring check removed
      // Set noTeam explicitly based on initialAppointment value
      const shouldHaveNoTeam = initialAppointment.noTeam === true
      setNoTeam(shouldHaveNoTeam)
      initializedRef.current = true
      localStorage.removeItem('createAppointmentState')
    } else {
      const stored = localStorage.getItem('createAppointmentState')
      if (stored) {
        try {
          const s = JSON.parse(stored)
          if (s.clientSearch) setClientSearch(s.clientSearch)
          if (s.selectedClient) setSelectedClient(s.selectedClient)
          if (s.newClient) setNewClient({ from: '', ...s.newClient })
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
          // Legacy recurring persistence removed
          if (typeof s.noTeam === 'boolean') setNoTeam(s.noTeam)
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
      // Legacy recurring state removed
      noTeam,
    }
    localStorage.setItem('createAppointmentState', JSON.stringify(data))
  }, [clientSearch, selectedClient, newClient, showNewClient, selectedTemplate, showNewTemplate, editing, editingTemplateId, templateForm, date, time, adminId, paid, tip, paymentMethod, otherPayment, showTeamModal, employeeSearch, selectedEmployees, selectedOption, carpetEnabled, carpetRooms, templateForm.carpetPrice, overrideCarpetPrice, carpetEmployees, noTeam])

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
    // Legacy recurring reset removed
    setPaid(false)
    setTip('')
    setPaymentMethod('')
    setOtherPayment('')
  }

  const resetAll = () => {
    setSelectedClient(null)
    setClientSearch('')
    setShowNewClient(false)
    setNewClient({ name: '', number: '', notes: '', from: '' })
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
            // Auto-populate size field
            if (match.size) {
              setTemplateForm(prev => ({ ...prev, size: match.size }))
            }
            storedTemplateIdRef.current = null
            return
          }
        }
        if (initialTemplateId) {
          const match = d.find((t: any) => t.id === initialTemplateId)
          if (match && match.id !== undefined) {
            setSelectedTemplate(match.id)
            loadStaffData(match.id)
            // Auto-populate size field
            if (match.size) {
              setTemplateForm(prev => ({ ...prev, size: match.size }))
            }
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
        // Auto-populate size field
        if (match.size) {
          setTemplateForm(prev => ({ ...prev, size: match.size }))
        }
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

  // Reload staff data when templateForm size changes during editing
  useEffect(() => {
    if (selectedTemplate && editing && templateForm.size && templateForm.type) {
      loadStaffData(selectedTemplate)
    }
  }, [templateForm.size, templateForm.type, editing, selectedTemplate])

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
    if (!newClient.from.trim()) missing.push('from')
    if (missing.length > 0) {
      await alert('Please provide: ' + missing.join(', '))
      return
    }
    const payload = {
      name: newClient.name,
      number: newClient.number.length === 10 ? '1' + newClient.number : newClient.number,
      from: newClient.from,
      notes: newClient.notes,
    }
    const res = await fetch(`${API_BASE_URL}/clients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', "ngrok-skip-browser-warning": "1" },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      const c = await res.json()
      setSelectedClient(c)
      resetTemplateRelated()
      setShowNewClient(false)
      setClientSearch('')
    } else {
      const err = await res.json().catch(() => ({}))
      await alert(err.error || 'Failed to create client')
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
    if (!templateForm.size) missing.push('size')
    if (templateForm.carpetEnabled) {
      const rooms = parseInt(templateForm.carpetRooms, 10)
      if (isNaN(rooms) || rooms < 1) {
        missing.push('carpet rooms (min 1)')
      }
    }
    if (missing.length > 0) {
      await alert('Please provide: ' + missing.join(', '))
      return
    }
    const payload: any = {
      clientId: selectedClient.id,
      templateName: templateForm.templateName,
      type: templateForm.type,
      size: templateForm.size,
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
      await alert('Failed to create template')
    }
  }

  const deleteTemplate = async () => {
    if (!selectedTemplate) return
    const ok = await confirm('Delete this template?')
    if (!ok) return
    const res = await fetch(`${API_BASE_URL}/appointment-templates/${selectedTemplate}`, {
      method: 'DELETE',
      headers: { "ngrok-skip-browser-warning": "1" },
    })
    if (res.ok) {
      setTemplates((p) => p.filter((tt) => tt.id !== selectedTemplate))
      resetTemplateRelated()
    } else {
      await alert('Failed to delete template')
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
    if (creating) return
    const missing: string[] = []
    if (!selectedClient) missing.push('client')
    if (!selectedTemplate) missing.push('template')
    if (!date) missing.push('date')
    if (!time) missing.push('time')
    if (!adminId) missing.push('admin')
    if (missing.length > 0) {
      await alert('Please provide: ' + missing.join(', '))
      return
    }
    if (!isValidCarpet()) {
      await alert('Please complete carpet cleaning info')
      return
    }
    if (!noTeam && selectedEmployees.length < 1) {
      await alert('Team must have at least one member')
      return
    }
    if (!noTeam && !isValidSelection()) {
      const proceed = await confirm('Team is less than required. Continue?')
      if (!proceed) return
    }
    if (time) {
      const hour = parseInt(time.split(':')[0], 10)
      if (hour < 6 || hour >= 18) {
        const ok = await confirm('Selected time is outside 6am-6pm. Continue?')
        if (!ok) return
      }
    }
    // Check if date is in the past (using local time for user experience)
    if (date) {
      // Parse date string as local date for validation
      const dateParts = date.split('-')
      if (dateParts.length === 3) {
        const selectedDate = new Date(
          parseInt(dateParts[0]),
          parseInt(dateParts[1]) - 1,
          parseInt(dateParts[2])
        )
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        selectedDate.setHours(0, 0, 0, 0)
        if (selectedDate < today) {
          const proceed = await confirm('The selected date is in the past. Are you sure you want to book the appointment for this date?')
          if (!proceed) return
        }
      }
    }
    
    // Convert local date to UTC date string for server
    // The date string from input (YYYY-MM-DD) represents the user's local date
    // We send it as-is, and server interprets it as UTC for consistent storage
    
    if (!selectedClient) {
      await alert('Please select a client')
      return
    }
    
    // Determine status - convert deprecated REOCCURRING to APPOINTED
    let appointmentStatus = newStatus ?? 'APPOINTED'
    if (initialAppointment && initialAppointment.status === 'REOCCURRING') {
      appointmentStatus = 'APPOINTED'
    } else if (!initialAppointment && appointmentStatus === 'REOCCURRING') {
      // Also handle new appointments with REOCCURRING status
      appointmentStatus = 'APPOINTED'
    }
    
    const body = {
      clientId: selectedClient.id,
      templateId: selectedTemplate,
      date, // Send as YYYY-MM-DD, server will parse as UTC
      time,
      hours: staffOptions[selectedOption]?.hours,
      employeeIds: noTeam ? [] : selectedEmployees,
      adminId: adminId || undefined,
      paid,
      paymentMethod: paid ? (paymentMethod || 'CASH') : 'CASH',
      paymentMethodNote:
        paid && paymentMethod === 'OTHER' && otherPayment ? otherPayment : undefined,
      tip: paid ? parseFloat(tip) || 0 : 0,
      status: appointmentStatus,
      noTeam,
      ...(carpetEnabled
        ? {
            carpetRooms: parseInt(carpetRooms, 10) || 0,
            carpetPrice: parseFloat(templateForm.carpetPrice) || undefined,
            carpetEmployees,
          }
        : {}),
    }

    // Legacy recurring removed - use Recurring Appointments page to create recurring appointments
    let url = `${API_BASE_URL}/appointments`
    const extra: any = {}
    let method: 'POST' | 'PUT' = 'POST'
    let payload: any = { ...body, ...extra }
    if (initialAppointment) {
      method = 'PUT'
      url = `${API_BASE_URL}/appointments/${initialAppointment.id}`
    }

    setCreating(true)
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' },
        body: JSON.stringify(payload),
      })
      
      if (res.ok) {
        const appt = await res.json()
        onCreated(appt)
        handleCancel()
      } else {
        const errorText = await res.text()
        let errorData
        try {
          errorData = JSON.parse(errorText)
        } catch {
          errorData = { raw: errorText }
        }
        
        // Show user-friendly error message
        const errorMessage = errorData.error || errorData.raw || 'Failed to save appointment'
        await alert(errorMessage)
      }
    } finally {
      setCreating(false)
    }
  }

  return (
    <>
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-20 p-2"
    >
      <div
        className="bg-white p-4 sm:p-6 rounded-lg w-full lg:w-3/5 max-w-md lg:max-w-none h-[70vh] overflow-hidden overflow-y-auto overflow-x-hidden space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">
            {initialAppointment ? 'Edit Appointment' : 'New Appointment'}
          </h2>
          <button onClick={handleClose} className="text-gray-500 hover:text-gray-700">
            ×
          </button>
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
              <div>
                Number:{' '}
                {isMobile ? (
                  <button
                    type="button"
                    className="underline text-blue-500"
                    onClick={handlePhoneClick}
                  >
                    {formatPhone(selectedClient.number)}
                  </button>
                ) : (
                  formatPhone(selectedClient.number)
                )}
              </div>
              {isMobile && showPhoneActions && (
                <div className="flex gap-2">
                  <a
                    href={`tel:${selectedClient.number}`}
                    className="px-2 py-1 bg-blue-500 text-white rounded"
                    onClick={() => setShowPhoneActions(false)}
                  >
                    Call
                  </a>
                  <a
                    href={`sms:${selectedClient.number}`}
                    className="px-2 py-1 bg-blue-500 text-white rounded"
                    onClick={() => setShowPhoneActions(false)}
                  >
                    Text
                  </a>
                </div>
              )}
              {selectedClient.from && <div>From: {selectedClient.from}</div>}
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
              value={formatPhone(newClient.number)}
              onChange={handleNewClientNumberChange}
            />
              <h4 className="font-light">From <span className="text-red-500">*</span></h4>
            <select
              id="appointment-new-client-from"
              className="w-full border p-2 rounded text-base"
              value={newClient.from}
              onChange={(e) => setNewClient({ ...newClient, from: e.target.value })}
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
              <h4 className="font-light">Notes:</h4>
            <textarea
              id="appointment-new-client-notes"
              className="w-full border p-2 rounded text-base"
              placeholder="Notes"
              value={newClient.notes}
              onChange={(e) => setNewClient({ ...newClient, notes: e.target.value })}
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                className="bg-gray-300 px-3 py-2 rounded"
                onClick={() => setShowNewClient(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="bg-blue-500 text-white px-3 py-2 rounded"
                onClick={createClient}
              >
                Save Client
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
                  <div className="text-sm text-gray-600">{formatPhone(c.number)}</div>
                  <div className="text-sm text-gray-600">From: {c.from}</div>
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
                <h4 className="font-light">Instructions: (Gate code, door code, pets, etc)</h4>
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
                  <button
                    type="button"
                    className="bg-gray-300 px-3 py-2 rounded"
                    onClick={() => { setShowNewTemplate(false); setEditing(false) }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="bg-blue-500 text-white px-3 py-2 rounded disabled:opacity-50"
                    onClick={createTemplate}
                    disabled={!isTemplateReady}
                  >
                    Save Template
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
                    <button className="text-sm text-red-500" onClick={deleteTemplate}>
                      delete
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
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <label className="font-medium">Notes:</label>
                          {!editingTemplateNotes || editingTemplateNotesId !== t.id ? (
                            <button
                              type="button"
                              className="text-xs text-blue-500 hover:text-blue-700 whitespace-nowrap"
                              onClick={() => {
                                setEditingTemplateNotes(true)
                                setEditingTemplateNotesId(t.id!)
                                setEditingTemplateNotesValue(t.notes || '')
                              }}
                            >
                              edit
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600 whitespace-nowrap"
                              onClick={async () => {
                                try {
                                  const updated = await fetchJson(`${API_BASE_URL}/appointment-templates/${t.id}`, {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ notes: editingTemplateNotesValue }),
                                  })
                                  
                                  // Update the template in the list
                                  setTemplates(templates.map(tmpl => tmpl.id === t.id ? updated : tmpl))
                                  
                                  // If editing an appointment that matches this template, update appointment notes too
                                  if (initialAppointment) {
                                    const matchesTemplate = 
                                      initialAppointment.address === t.address &&
                                      initialAppointment.type === t.type &&
                                      (initialAppointment.size || '') === (t.size || '')
                                    
                                    if (matchesTemplate) {
                                      try {
                                        await fetchJson(`${API_BASE_URL}/appointments/${initialAppointment.id}`, {
                                          method: 'PUT',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ notes: editingTemplateNotesValue || null }),
                                        })
                                      } catch (apptError) {
                                        // Don't fail the whole operation if appointment update fails
                                      }
                                    }
                                  }
                                  
                                  setEditingTemplateNotes(false)
                                  setEditingTemplateNotesId(null)
                                  setEditingTemplateNotesValue('')
                                } catch (error) {
                                  alert('Failed to update template notes')
                                }
                              }}
                            >
                              save
                            </button>
                          )}
                        </div>
                        <textarea
                          className="w-full border p-2 rounded text-sm"
                          rows={3}
                          value={editingTemplateNotes && editingTemplateNotesId === t.id ? editingTemplateNotesValue : (t.notes || '')}
                          onChange={(e) => {
                            if (editingTemplateNotes && editingTemplateNotesId === t.id) {
                              setEditingTemplateNotesValue(e.target.value)
                            }
                          }}
                          disabled={!editingTemplateNotes || editingTemplateNotesId !== t.id}
                          placeholder="No notes"
                        />
                      </div>
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
                      const templateId = Number(e.target.value)
                      setSelectedTemplate(templateId)
                      
                      // Auto-populate size field when template is selected
                      if (templateId) {
                        const selectedTemplate = templates.find(t => t.id === templateId)
                        if (selectedTemplate?.size) {
                          setTemplateForm(prev => ({ ...prev, size: selectedTemplate.size }))
                        }
                      }
                    }}
                  >
                    <option value="">Select template</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.templateName} {t.size ? `(${t.size})` : ''}
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
        {selectedTemplate && (
          <div className="space-y-1">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={noTeam}
                onChange={async (e) => {
                  const checked = e.target.checked
                  if (checked) {
                    const ok = await confirm('Create appointment with no team?')
                    if (!ok) {
                      return
                    }
                  }
                  setNoTeam(checked)
                  if (checked) {
                    setSelectedEmployees([])
                    setCarpetEmployees([])
                  }
                }}
              />
              <span>No Team</span>
            </label>
            {!noTeam && (
              <>
                <button
                  className="border px-3 py-2 rounded"
                  onClick={() => {
                    setShowTeamModal(true)
                  }}
                >
                  {staffOptions.length > 0 ? 'Team Options' : 'Select Team'} <span className="text-red-500">*</span>
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
              </>
            )}
          </div>
        )}

        {/* Recurring appointments should be created via the Recurring Appointments page */}

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
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setTime('09:00')}
                  className="flex-1 px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                >
                  9:00 AM
                </button>
                <button
                  type="button"
                  onClick={() => setTime('14:00')}
                  className="flex-1 px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                >
                  2:00 PM
                </button>
              </div>
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
              showNewTemplate ||
              !selectedTemplate ||
              !date ||
              !time ||
              !isValidCarpet() ||
              !adminId ||
              (paid && (!paymentMethod || (paymentMethod === 'OTHER' && !otherPayment))) ||
              creating
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
            {staffOptions.length > 0 ? (
              staffOptions.map((o, idx) => (
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
              ))
            ) : (
              <div className="text-center text-gray-500 py-4">
                <p>Please select a size for the template to see team options.</p>
                <p className="text-sm mt-1">Team options are calculated based on the appointment size and type.</p>
              </div>
            )}
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
                        const newSelected = selectedEmployees.includes(e.id!)
                          ? selectedEmployees.filter((id) => id !== e.id)
                          : [...selectedEmployees, e.id!]
                        setSelectedEmployees(newSelected)
                        // If employee is being added and noTeam is true, we should uncheck noTeam
                        if (!selectedEmployees.includes(e.id!) && noTeam) {
                          setNoTeam(false)
                        }
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
              onClick={() => {
                setShowTeamModal(false)
              }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    )}
    {/* Legacy recurring modal removed - use Recurring Appointments page */}
    </>
  )
}

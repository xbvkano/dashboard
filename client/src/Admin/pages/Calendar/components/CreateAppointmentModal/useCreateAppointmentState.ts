import { useState, useEffect } from 'react'
import { Client } from '../../../Clients/components/types'
import type { AppointmentTemplate } from '../../types'
import type { Employee } from '../../../Employees/components/types'
import { API_BASE_URL, fetchJson } from '../../../../../api'

export function useCreateAppointmentState(
  initialClientId?: number,
  initialTemplateId?: number,
  initialAppointment?: any
) {
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

  // Client state
  const [clientSearch, setClientSearch] = useState<string>(persisted.clientSearch ?? '')
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClient, setSelectedClient] = useState<Client | null>(persisted.selectedClient ?? null)
  const [newClient, setNewClient] = useState<{ name: string; number: string; notes: string; from: string }>(
    persisted.newClient ?? { name: '', number: '', notes: '', from: '' },
  )
  const [showNewClient, setShowNewClient] = useState<boolean>(persisted.showNewClient ?? false)

  // Template state
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

  // Appointment form state
  const [date, setDate] = useState(persisted.date ?? new Date().toISOString().slice(0, 10))
  const [time, setTime] = useState(persisted.time ?? '09:00')
  const [hours, setHours] = useState<string>(persisted.hours ?? '')
  const [employeeIds, setEmployeeIds] = useState<number[]>(persisted.employeeIds ?? [])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [paid, setPaid] = useState<boolean>(persisted.paid ?? false)
  const [paymentMethod, setPaymentMethod] = useState<string>(persisted.paymentMethod ?? 'CASH')
  const [paymentMethodNote, setPaymentMethodNote] = useState<string>(persisted.paymentMethodNote ?? '')
  const [tip, setTip] = useState<string>(persisted.tip ?? '0')
  const [carpetRooms, setCarpetRooms] = useState<string>(persisted.carpetRooms ?? '')
  const [carpetPrice, setCarpetPrice] = useState<string>(persisted.carpetPrice ?? '')
  const [carpetEmployees, setCarpetEmployees] = useState<number[]>(persisted.carpetEmployees ?? [])
  const [notes, setNotes] = useState<string>(persisted.notes ?? '')
  const [noTeam, setNoTeam] = useState<boolean>(persisted.noTeam ?? false)
  const [status, setStatus] = useState<string>(persisted.status ?? 'APPOINTED')

  // Recurring appointment state
  const [recurring, setRecurring] = useState<boolean>(persisted.recurring ?? false)
  const [frequency, setFrequency] = useState<string>(persisted.frequency ?? 'WEEKLY')
  const [months, setMonths] = useState<string>(persisted.months ?? '1')

  // Persist state to localStorage
  useEffect(() => {
    const state = {
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
      hours,
      employeeIds,
      paid,
      paymentMethod,
      paymentMethodNote,
      tip,
      carpetRooms,
      carpetPrice,
      carpetEmployees,
      notes,
      noTeam,
      status,
      recurring,
      frequency,
      months,
    }
    localStorage.setItem('createAppointmentState', JSON.stringify(state))
  }, [
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
    hours,
    employeeIds,
    paid,
    paymentMethod,
    paymentMethodNote,
    tip,
    carpetRooms,
    carpetPrice,
    carpetEmployees,
    notes,
    noTeam,
    status,
    recurring,
    frequency,
    months,
  ])

  // Load initial data
  useEffect(() => {
    if (initialClientId) {
      fetchJson(`${API_BASE_URL}/clients/${initialClientId}`)
        .then((client) => setSelectedClient(client))
        .catch(() => {})
    }
  }, [initialClientId])

  useEffect(() => {
    if (initialTemplateId) {
      setSelectedTemplate(initialTemplateId)
    }
  }, [initialTemplateId])

  useEffect(() => {
    if (initialAppointment) {
      setDate(initialAppointment.date.slice(0, 10))
      setTime(initialAppointment.time)
      setHours(String(initialAppointment.hours || ''))
      setEmployeeIds(initialAppointment.employees?.map((e: any) => e.id) || [])
      setPaid(initialAppointment.paid)
      setPaymentMethod(initialAppointment.paymentMethod)
      setTip(String(initialAppointment.tip || 0))
      setCarpetRooms(String(initialAppointment.carpetRooms || ''))
      setCarpetPrice(String(initialAppointment.carpetPrice || ''))
      setCarpetEmployees(initialAppointment.carpetEmployees || [])
      setNotes(initialAppointment.notes || '')
      setNoTeam(initialAppointment.noTeam)
      setStatus(initialAppointment.status)
    }
  }, [initialAppointment])

  // Fetch employees
  useEffect(() => {
    fetchJson(`${API_BASE_URL}/employees`)
      .then((data) => setEmployees(data))
      .catch(() => setEmployees([]))
  }, [])

  return {
    // Client state
    clientSearch,
    setClientSearch,
    clients,
    setClients,
    selectedClient,
    setSelectedClient,
    newClient,
    setNewClient,
    showNewClient,
    setShowNewClient,

    // Template state
    templates,
    setTemplates,
    selectedTemplate,
    setSelectedTemplate,
    showNewTemplate,
    setShowNewTemplate,
    editing,
    setEditing,
    editingTemplateId,
    setEditingTemplateId,
    templateForm,
    setTemplateForm,

    // Appointment form state
    date,
    setDate,
    time,
    setTime,
    hours,
    setHours,
    employeeIds,
    setEmployeeIds,
    employees,
    paid,
    setPaid,
    paymentMethod,
    setPaymentMethod,
    paymentMethodNote,
    setPaymentMethodNote,
    tip,
    setTip,
    carpetRooms,
    setCarpetRooms,
    carpetPrice,
    setCarpetPrice,
    carpetEmployees,
    setCarpetEmployees,
    notes,
    setNotes,
    noTeam,
    setNoTeam,
    status,
    setStatus,

    // Recurring state
    recurring,
    setRecurring,
    frequency,
    setFrequency,
    months,
    setMonths,
  }
}

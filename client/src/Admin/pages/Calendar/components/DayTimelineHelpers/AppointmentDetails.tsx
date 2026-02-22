import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { API_BASE_URL, fetchJson } from '../../../../../api'
import { useModal } from '../../../../../ModalProvider'
import { formatPhone } from '../../../../../formatPhone'
import type { Appointment } from '../../types'

function parseSqft(s: string | null | undefined): number | null {
  if (!s) return null
  const parts = s.split('-')
  const n = parseInt(parts[1] || parts[0], 10)
  return isNaN(n) ? parseInt(s, 10) : n
}

function calcPayRate(type: string, size: string | null | undefined, count: number): number {
  const sqft = parseSqft(size)
  const isLarge = sqft != null && sqft > 2500
  if (type === 'STANDARD') return isLarge ? 100 : 80
  if (type === 'DEEP' || type === 'MOVE_IN_OUT') {
    if (isLarge) return 100
    return count === 1 ? 100 : 90
  }
  return 80
}

function calcCarpetRate(size: string | null | undefined, rooms: number): number {
  const sqft = parseSqft(size)
  if (sqft === null) return 0
  const isLarge = sqft > 2500
  if (rooms === 1) return isLarge ? 20 : 10
  if (rooms <= 3) return isLarge ? 30 : 20
  if (rooms <= 5) return isLarge ? 40 : 30
  if (rooms <= 8) return isLarge ? 60 : 40
  return (isLarge ? 60 : 40) + 10 * (rooms - 8)
}

interface AppointmentDetailsProps {
  appointment: Appointment
  onUpdate: (appointment: Appointment) => void
  onClose: () => void
  onCreate: (appt: Appointment, status: Appointment['status']) => void
  onEdit: (appt: Appointment) => void
  onNavigateToDate?: (date: Date) => void
  onRefresh?: () => void
  onRequestSkip?: () => void
  onRequestConfirm?: () => void
  /** Called when user opens Team Options (so parent can switch modal view). */
  onOpenTeamOptions?: () => void
  /** Called when user opens Edit (so parent can switch to edit view; details go away). */
  onOpenEdit?: () => void
  /** Called when user opens Reschedule (so parent can switch to reschedule modal). */
  onOpenReschedule?: () => void
}

export default function AppointmentDetails({
  appointment,
  onUpdate,
  onClose,
  onCreate,
  onEdit,
  onNavigateToDate,
  onRefresh,
  onRequestSkip,
  onRequestConfirm,
  onOpenTeamOptions,
  onOpenEdit,
  onOpenReschedule,
}: AppointmentDetailsProps) {
  const { alert, confirm } = useModal()
  const navigate = useNavigate()
  const [paid, setPaid] = useState(appointment.paid)
  const [paymentMethod, setPaymentMethod] = useState(appointment.paymentMethod || 'CASH')
  const [otherPayment, setOtherPayment] = useState((appointment as any).paymentMethodNote || '')
  const [tip, setTip] = useState(String(appointment.tip || 0))
  const [showSendInfo, setShowSendInfo] = useState(false)
  const [note, setNote] = useState('')
  const [observation, setObservation] = useState(appointment.observation || '')
  const [extraFor, setExtraFor] = useState<number | null>(null)
  const [extraName, setExtraName] = useState('')
  const [extraAmount, setExtraAmount] = useState('')
  const [editingExtraId, setEditingExtraId] = useState<number | null>(null)
  const [showPhoneActions, setShowPhoneActions] = useState(false)
  const [showActionPanel, setShowActionPanel] = useState(false)
  const [showRescheduleModal, setShowRescheduleModal] = useState(false)
  const [showMoveModal, setShowMoveModal] = useState(false)
  const [newDate, setNewDate] = useState('')
  const [moveDate, setMoveDate] = useState('')
  const [moveTime, setMoveTime] = useState('')
  const [showPastDateConfirm, setShowPastDateConfirm] = useState(false)
  const [pendingMoveData, setPendingMoveData] = useState<{ date: string; time: string } | null>(null)
  const [template, setTemplate] = useState<any>(null)
  const [loadingTemplate, setLoadingTemplate] = useState(false)
  const [editingTemplateNotes, setEditingTemplateNotes] = useState(false)
  const [editingTemplateNotesId, setEditingTemplateNotesId] = useState<number | null>(null)
  const [editingTemplateNotesValue, setEditingTemplateNotesValue] = useState('')

  const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

  // Fetch template if we have clientId
  useEffect(() => {
    if (appointment.clientId) {
      setLoadingTemplate(true)
      fetchJson(`${API_BASE_URL}/appointment-templates?clientId=${appointment.clientId}`)
        .then((templates: any[]) => {
          // If appointment has templateId, use it directly; otherwise fall back to matching
          let match: any = null
          if (appointment.templateId) {
            match = templates.find((t: any) => t.id === appointment.templateId)
          }
          // Fall back to matching by address, type, and size if templateId not found or not available
          if (!match) {
            match = templates.find(
              (t: any) => 
                t.address === appointment.address && 
                t.type === appointment.type && 
                (t.size || '') === (appointment.size || '')
            )
          }
          if (match) {
            setTemplate(match)
          }
        })
        .catch(() => {})
        .finally(() => setLoadingTemplate(false))
    }
  }, [appointment.clientId, appointment.templateId, appointment.address, appointment.type, appointment.size])
  
  // Check if this is an unconfirmed recurring appointment - must have both familyId and RECURRING_UNCONFIRMED status
  const statusStr = String(appointment.status || '').toUpperCase()
  const statusMatches = statusStr === 'RECURRING_UNCONFIRMED'
  const hasFamilyId = !!appointment.familyId
  const isRecurringUnconfirmed = statusMatches && hasFamilyId
  
  // Note: isRecurringUnconfirmed is true when status is RECURRING_UNCONFIRMED and familyId exists
  // This determines whether to show recurring appointment action buttons vs regular action panel

  const handlePhoneClick = () => {
    if (isMobile) setShowPhoneActions((prev) => !prev)
  }

  const updateAppointment = async (data: { status?: Appointment['status']; observe?: boolean }) => {
    const url = `${API_BASE_URL}/appointments/${appointment.id}`
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '1',
      },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      const updated = await res.json()
      onUpdate(updated)
      onClose()
    } else {
      await alert('Failed to update appointment')
    }
  }

  const handleSave = async () => {
    const url = `${API_BASE_URL}/appointments/${appointment.id}`
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '1',
      },
      body: JSON.stringify({
        paid,
        paymentMethod: paid ? (paymentMethod || 'CASH') : 'CASH',
        paymentMethodNote: paid && paymentMethod === 'OTHER' && otherPayment ? otherPayment : undefined,
        tip: paid ? parseFloat(tip) || 0 : 0,
        observation: appointment.observe ? observation : undefined,
      }),
    })
    if (res.ok) {
      const updated = await res.json()
      onUpdate(updated)
      onClose()
    } else {
      await alert('Failed to update appointment')
    }
  }

  const handleSendInfo = async () => {
    // Check if appointment has a team assigned
    if (appointment.noTeam || !appointment.employees || appointment.employees.length === 0) {
      await alert('Cannot send info: No team assigned to this appointment. Please add at least one team member before sending info.')
      return
    }
    
    const res = await fetch(`${API_BASE_URL}/appointments/${appointment.id}/send-info`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '1',
      },
      body: JSON.stringify({ note }),
    })
    if (res.ok) {
      const updated = (await res.json()) as Appointment
      onUpdate(updated)
      setShowSendInfo(false)
      setNote('')
    } else {
      const errorData = await res.json().catch(() => ({}))
      const errorMessage = errorData.error || 'Failed to send info'
      await alert(errorMessage)
    }
  }

  const openExtra = (empId: number, ex?: { id: number; name: string; amount: number }) => {
    setExtraFor(empId)
    setExtraName(ex?.name || '')
    setExtraAmount(ex ? String(ex.amount) : '')
    setEditingExtraId(ex?.id ?? null)
  }

  const saveExtra = async () => {
    if (extraFor == null) return
    const amt = parseFloat(extraAmount) || 0
    if (editingExtraId) {
      const res = await fetch(`${API_BASE_URL}/payroll/extra/${editingExtraId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '1',
        },
        body: JSON.stringify({
          name: extraName || 'Extra',
          amount: amt,
        }),
      })
      if (res.ok) {
        const updated = await res.json()
        onUpdate(updated)
        setExtraFor(null)
        setExtraName('')
        setExtraAmount('')
        setEditingExtraId(null)
      } else {
        await alert('Failed to update extra')
      }
    } else {
      const res = await fetch(`${API_BASE_URL}/payroll/extra`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '1',
        },
        body: JSON.stringify({
          appointmentId: appointment.id,
          employeeId: extraFor,
          name: extraName || 'Extra',
          amount: amt,
        }),
      })
      if (res.ok) {
        const updated = await res.json()
        onUpdate(updated)
        setExtraFor(null)
        setExtraName('')
        setExtraAmount('')
      } else {
        await alert('Failed to create extra')
      }
    }
  }

  const deleteExtra = async (extraId: number) => {
    if (!(await confirm('Are you sure you want to delete this extra?'))) return
    const res = await fetch(`${API_BASE_URL}/payroll/extra/${extraId}`, {
      method: 'DELETE',
      headers: { 'ngrok-skip-browser-warning': '1' },
    })
    if (res.ok) {
      const updated = await res.json()
      onUpdate(updated)
    } else {
      await alert('Failed to delete extra')
    }
  }

  const handleConfirmRecurring = () => {
    if (onRequestConfirm) {
      onRequestConfirm()
    }
  }

  const handleConfirmAndReschedule = async () => {
    if (!appointment.id || !newDate) return
    const res = await fetch(`${API_BASE_URL}/recurring/appointments/${appointment.id}/confirm-reschedule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '1',
      },
      body: JSON.stringify({ newDate }),
    })
    if (res.ok) {
      const updated = await res.json()
      onUpdate(updated)
      setShowRescheduleModal(false)
      setNewDate('')
      onClose()
    } else {
      const errorData = await res.json().catch(() => ({}))
      await alert(errorData.error || 'Failed to confirm and reschedule appointment')
    }
  }

  const handleSkipRecurring = () => {
    if (onRequestSkip) {
      onRequestSkip()
    }
  }

  const handleRecurringSettings = () => {
    if (appointment.familyId) {
      navigate(`/dashboard/recurring?familyId=${appointment.familyId}`)
      onClose()
    }
  }

  const handleViewClient = () => {
    if (appointment.clientId) {
      navigate(`/dashboard/clients/${appointment.clientId}`)
      onClose()
    }
  }

  const handleMoveRecurring = async () => {
    if (!appointment.id || !moveDate || !moveTime) return
    
    // Check if date is in the past
    const selectedDate = new Date(moveDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    selectedDate.setHours(0, 0, 0, 0)
    if (selectedDate < today) {
      // Show confirmation modal in front of details modal
      setPendingMoveData({ date: moveDate, time: moveTime })
      setShowPastDateConfirm(true)
      return
    }
    
    await executeMoveRecurring(moveDate, moveTime)
  }

  const executeMoveRecurring = async (date: string, time: string) => {
    if (!appointment.id) return
    
    const res = await fetch(`${API_BASE_URL}/recurring/appointments/${appointment.id}/move`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '1',
      },
      body: JSON.stringify({ newDate: date, newTime: time }),
    })
    if (res.ok) {
      const updated = await res.json()
      onUpdate(updated)
      setShowMoveModal(false)
      setMoveDate('')
      setMoveTime('')
      setShowPastDateConfirm(false)
      setPendingMoveData(null)
      onClose()
      
      // Navigate to the new date when moving
      const dateStr = date
      const dateParts = typeof dateStr === 'string' ? dateStr.split('T')[0].split('-') : null
      if (dateParts && dateParts.length === 3 && onNavigateToDate) {
        const nextDate = new Date(
          parseInt(dateParts[0]),
          parseInt(dateParts[1]) - 1,
          parseInt(dateParts[2])
        )
        onNavigateToDate(nextDate)
        onRefresh?.()
      }
    } else {
      const errorData = await res.json().catch(() => ({}))
      await alert(errorData.error || 'Failed to move appointment')
    }
  }

  const apptDateStr = (() => {
    const apptDate = typeof appointment.date === 'string' ? new Date(appointment.date) : appointment.date
    const year = apptDate.getFullYear()
    const month = String(apptDate.getMonth() + 1).padStart(2, '0')
    const day = String(apptDate.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  })()
  const teamSizeDisplay = appointment.teamSize ?? template?.teamSize ?? 1

  return (
    <div className="bg-white rounded-xl shadow-lg w-full max-w-xl overflow-hidden max-h-[90vh] flex flex-col">
      <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center gap-2 shrink-0">
        <h3 className="text-lg font-semibold text-slate-800">Appointment Details</h3>
        <div className="flex items-center gap-2 shrink-0">
          {!isRecurringUnconfirmed && (
            <button
              type="button"
              onClick={() => onOpenEdit ? onOpenEdit() : onEdit(appointment)}
              className="px-4 py-2 text-sm font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Edit
            </button>
          )}
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded hover:bg-slate-200 transition-colors">
            ×
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4 overflow-y-auto overflow-x-hidden min-h-0 flex-1">
        {/* Block 1: Client + Admin */}
        <div className="rounded-xl border-2 border-slate-200 bg-white p-4 shadow-sm">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Client</h4>
          <p className="font-medium text-slate-900">{appointment.client?.name}</p>
          <p className="text-sm text-slate-600 mt-0.5">{formatPhone(appointment.client?.number || '')}</p>
          {appointment.admin && (
            <p className="text-sm text-slate-600 mt-2 pt-2 border-t border-slate-100">
              <span className="text-slate-500">Admin:</span> {appointment.admin.name ?? appointment.admin.email}
            </p>
          )}
        </div>

        {/* Block 2: Template – template selected at top, then Address, Type, Size, Team size, Date, Time, Hours, Price */}
        <div className="rounded-xl border-2 border-slate-200 bg-white p-4 shadow-sm">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Template</h4>
          <div className="mb-3 pb-3 border-b border-slate-100">
            <p className="text-xs text-slate-500">Template selected</p>
            <p className="font-medium text-slate-900">{loadingTemplate ? 'Loading...' : (template?.templateName ?? '—')}</p>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-slate-500">Address</dt>
            <dd className="font-medium text-slate-900">{appointment.address}</dd>
            <dt className="text-slate-500">Type</dt>
            <dd className="font-medium text-slate-900">{appointment.type?.replace(/_/g, ' ') ?? '—'}</dd>
            <dt className="text-slate-500">Size</dt>
            <dd className="font-medium text-slate-900">{appointment.size ?? '—'}</dd>
            <dt className="text-slate-500">Team size</dt>
            <dd className="font-medium text-slate-900">{teamSizeDisplay}</dd>
            <dt className="text-slate-500">Date</dt>
            <dd className="font-medium text-slate-900">{apptDateStr}</dd>
            <dt className="text-slate-500">Time</dt>
            <dd className="font-medium text-slate-900">{appointment.time}</dd>
            {appointment.hours != null && (
              <>
                <dt className="text-slate-500">Hours</dt>
                <dd className="font-medium text-slate-900">{appointment.hours}</dd>
              </>
            )}
            {appointment.price != null && appointment.price > 0 && (
              <>
                <dt className="text-slate-500">Price</dt>
                <dd className="font-medium text-slate-900">${Number(appointment.price).toFixed(2)}</dd>
              </>
            )}
          </dl>
        </div>

        {/* Notes – kept separate as-is */}
        {loadingTemplate ? (
          <div className="text-xs text-slate-400 italic py-2">Loading template...</div>
        ) : template ? (
          <div className="rounded-xl border-2 border-slate-200 bg-white p-4 shadow-sm space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</h4>
              {!editingTemplateNotes || editingTemplateNotesId !== template.id ? (
                <button
                  type="button"
                  className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline py-1.5 px-3 rounded border border-blue-200 hover:bg-blue-50 transition-colors"
                  onClick={() => {
                    setEditingTemplateNotes(true)
                    setEditingTemplateNotesId(template.id)
                    setEditingTemplateNotesValue(template.notes || '')
                  }}
                >
                  Edit
                </button>
              ) : (
                <button
                  type="button"
                  className="py-1.5 px-3 bg-green-500 text-white rounded text-sm font-medium hover:bg-green-600 transition-colors"
                  onClick={async () => {
                    try {
                      const updated = await fetchJson(`${API_BASE_URL}/appointment-templates/${template.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ notes: editingTemplateNotesValue }),
                      })
                      setTemplate(updated)
                      try {
                        const updatedAppointment = await fetchJson(`${API_BASE_URL}/appointments/${appointment.id}`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ notes: editingTemplateNotesValue || null }),
                        })
                        onUpdate(updatedAppointment)
                      } catch (apptError) {}
                      setEditingTemplateNotes(false)
                      setEditingTemplateNotesId(null)
                      setEditingTemplateNotesValue('')
                    } catch (error) {
                      await alert('Failed to update template notes')
                    }
                  }}
                >
                  Save
                </button>
              )}
            </div>
            <textarea
              className="w-full border border-slate-200 rounded-md p-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={3}
              value={editingTemplateNotes && editingTemplateNotesId === template.id ? editingTemplateNotesValue : (template.notes || '')}
              onChange={(e) => {
                if (editingTemplateNotes && editingTemplateNotesId === template.id) {
                  setEditingTemplateNotesValue(e.target.value)
                }
              }}
              disabled={!editingTemplateNotes || editingTemplateNotesId !== template.id}
              placeholder="No notes"
            />
          </div>
        ) : null}

        {/* Rest: Payment and Team – two equal columns to respect modal width */}
        <div className="space-y-4 border-t-2 border-slate-200 pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Payment */}
            <div className="rounded-xl border-2 border-slate-200 bg-white p-4 shadow-sm min-w-0">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Payment</h4>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={paid}
                    onChange={(e) => setPaid(e.target.checked)}
                    className="mr-2"
                  />
                  Paid
                </label>
                {paid && (
                  <>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as 'CASH' | 'ZELLE' | 'VENMO' | 'PAYPAL' | 'OTHER' | 'CHECK')}
                      className="w-full border p-2 rounded text-sm"
                    >
                      <option value="CASH">Cash</option>
                      <option value="CHECK">Check</option>
                      <option value="CARD">Card</option>
                      <option value="OTHER">Other</option>
                    </select>
                    {paymentMethod === 'OTHER' && (
                      <input
                        type="text"
                        placeholder="Payment method note"
                        value={otherPayment}
                        onChange={(e) => setOtherPayment(e.target.value)}
                        className="w-full border p-2 rounded text-sm"
                      />
                    )}
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Tip (optional)</label>
                      <input
                        type="number"
                        placeholder="Tip amount if provided"
                        value={tip}
                        onChange={(e) => setTip(e.target.value)}
                        className="w-full border border-slate-200 p-2 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <p className="text-xs text-slate-500 mt-1">Enter the tip amount if the client left a tip. Optional.</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Team */}
            <div className="rounded-xl border-2 border-slate-200 bg-white p-4 shadow-sm min-w-0">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Team</h4>
              <div className="space-y-1.5">
                {appointment.employees?.length ? appointment.employees.map((employee) => {
                  const payrollItem = appointment.payrollItems?.find((p: any) => p.employeeId === employee.id)
                  const carpetIds = (appointment as any).carpetEmployees as number[] | undefined
                  const onCarpet = carpetIds?.includes(employee.id!)
                  const count = appointment.employees?.length ?? 0
                  const base = (payrollItem as any)?.amount != null
                    ? (payrollItem as any).amount
                    : calcPayRate(appointment.type, appointment.size ?? null, count)
                  const carpetRooms = (appointment as any).carpetRooms ?? 0
                  const carpetTotal = carpetRooms > 0 ? calcCarpetRate(appointment.size ?? null, carpetRooms) : 0
                  const carpetShare = onCarpet && carpetTotal > 0 && (carpetIds?.length ?? 0) > 0
                    ? carpetTotal / (carpetIds!.length || 1)
                    : 0
                  const total = base + carpetShare
                  const extras = (payrollItem as any)?.extras ?? []
                  return (
                    <div key={employee.id} className="text-sm text-slate-800">
                      <span className="font-medium">{employee.name}</span>
                      <span className="ml-1.5 text-slate-600">
                        ${total.toFixed(2)}
                        {onCarpet && carpetShare > 0 && (
                          <span className="text-slate-500 text-xs"> (base ${base.toFixed(2)} + carpet ${carpetShare.toFixed(2)})</span>
                        )}
                        {extras.length > 0 && (
                          <span className="text-slate-500 text-xs">
                            {' '}+ {extras.map((ex: { name: string; amount: number }) => `${ex.name}: $${ex.amount.toFixed(2)}`).join(', ')}
                          </span>
                        )}
                      </span>
                    </div>
                  )
                }) : (
                  <p className="text-sm text-slate-500 italic">No team assigned</p>
                )}
              </div>
            </div>
          </div>

        {/* Recurring Unconfirmed Actions */}
        {isRecurringUnconfirmed && (
          <div className="space-y-2 border-t pt-4">
            <div className="text-sm font-medium text-blue-700 mb-2">
              Recurring Appointment Actions
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleConfirmRecurring}
                className="px-3 py-2 bg-green-500 text-white rounded text-sm hover:bg-green-600"
              >
                Confirm
              </button>
              <button
                onClick={handleSkipRecurring}
                className="px-3 py-2 bg-yellow-500 text-white rounded text-sm hover:bg-yellow-600"
              >
                Skip
              </button>
              <button
                onClick={() => {
                  setMoveTime(appointment.time || '')
                  setShowMoveModal(true)
                }}
                className="px-3 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
              >
                Move
              </button>
              <button
                onClick={handleRecurringSettings}
                className="px-3 py-2 bg-purple-500 text-white rounded text-sm hover:bg-purple-600"
              >
                View Family
              </button>
              <button
                onClick={handleViewClient}
                className="px-3 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
              >
                View Client
              </button>
              {appointment.observe ? (
                <button
                  onClick={() => updateAppointment({ observe: false })}
                  className="px-3 py-2 bg-yellow-500 text-white rounded text-sm hover:bg-yellow-600"
                >
                  Unobserve
                </button>
              ) : (
                <button
                  onClick={() => updateAppointment({ observe: true })}
                  className="px-3 py-2 bg-yellow-500 text-white rounded text-sm hover:bg-yellow-600"
                >
                  Observe
                </button>
              )}
            </div>
            {showMoveModal && (
              <div className="mt-2 p-3 bg-gray-50 rounded">
                <label className="block text-sm font-medium mb-1">New Date</label>
                <input
                  type="date"
                  value={moveDate}
                  onChange={(e) => setMoveDate(e.target.value)}
                  className="w-full border p-2 rounded text-sm"
                />
                <label className="block text-sm font-medium mb-1 mt-2">New Time</label>
                <input
                  type="time"
                  value={moveTime}
                  onChange={(e) => setMoveTime(e.target.value)}
                  className="w-full border p-2 rounded text-sm"
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={handleMoveRecurring}
                    disabled={!moveDate || !moveTime}
                    className="flex-1 px-3 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 disabled:bg-gray-400"
                  >
                    Move
                  </button>
                  <button
                    onClick={() => {
                      setShowMoveModal(false)
                      setMoveDate('')
                      setMoveTime('')
                    }}
                    className="flex-1 px-3 py-2 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Team Options & Action Panel – full width, stacked */}
        {!isRecurringUnconfirmed && (
          <div className="space-y-2 w-full">
            <button
              type="button"
              onClick={() => onOpenTeamOptions?.()}
              className="w-full px-4 py-2.5 bg-indigo-500 text-white rounded-lg text-sm font-medium hover:bg-indigo-600 transition-colors"
            >
              Team Options
            </button>
            <button
              type="button"
              onClick={() => setShowActionPanel(!showActionPanel)}
              className="w-full px-4 py-2.5 bg-slate-600 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
            >
              {showActionPanel ? '▼' : '▶'} Action Panel
            </button>
            {showActionPanel && (
            <div className="grid grid-cols-2 gap-2 w-full">
              {appointment.clientId && (
                <button
                  type="button"
                  onClick={() => {
                    navigate(`/dashboard/clients/${appointment.clientId}`)
                    onClose()
                  }}
                  className="px-4 py-2.5 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
                >
                  View Client
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  onCreate(appointment, 'APPOINTED')
                  onClose()
                }}
                className="px-4 py-2.5 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
              >
                Book Again
              </button>
              <button
                type="button"
                onClick={() => onOpenReschedule ? onOpenReschedule() : onCreate(appointment, 'RESCHEDULE_NEW')}
                className="px-4 py-2.5 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
              >
                Reschedule
              </button>
              <button
                type="button"
                onClick={() => {
                  navigate(`/dashboard/financing/invoice?appt=${appointment.id}&date=${apptDateStr}`)
                  onClose()
                }}
                className="px-4 py-2.5 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors"
              >
                Invoice
              </button>
              <button
                type="button"
                onClick={() => onOpenEdit ? onOpenEdit() : onEdit(appointment)}
                className="px-4 py-2.5 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors col-span-2 w-full"
              >
                Edit appointment
              </button>
              {appointment.observe ? (
                <button
                  type="button"
                  onClick={() => updateAppointment({ observe: false })}
                  className="px-4 py-2.5 bg-yellow-500 text-white rounded-lg text-sm font-medium hover:bg-yellow-600 transition-colors"
                >
                  Unobserve
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => updateAppointment({ observe: true })}
                  className="px-4 py-2.5 bg-yellow-500 text-white rounded-lg text-sm font-medium hover:bg-yellow-600 transition-colors"
                >
                  Observe
                </button>
              )}
              {appointment.status === 'CANCEL' ? (
                <button
                  type="button"
                  onClick={async () => {
                    if (!(await confirm('Restore this cancelled appointment?'))) return
                    await updateAppointment({ status: 'APPOINTED' })
                  }}
                  className="px-4 py-2.5 bg-purple-500 text-white rounded-lg text-sm font-medium hover:bg-purple-600 transition-colors"
                >
                  Uncancel
                </button>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    if (!(await confirm('Cancel this appointment?'))) return
                    await updateAppointment({ status: 'CANCEL' })
                  }}
                  className="px-4 py-2.5 bg-purple-500 text-white rounded-lg text-sm font-medium hover:bg-purple-600 transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                type="button"
                onClick={async () => {
                  if (!(await confirm('Delete this appointment permanently? This cannot be undone.'))) return
                  await updateAppointment({ status: 'DELETED' })
                }}
                className="px-4 py-2.5 bg-red-700 text-white rounded-lg text-sm font-medium hover:bg-red-800 transition-colors col-span-2 w-full"
              >
                Delete
              </button>
            </div>
            )}
          </div>
        )}

        {(() => {
          const paidChanged = paid !== appointment.paid
          const methodChanged = (paymentMethod || 'CASH') !== (appointment.paymentMethod || 'CASH')
          const tipChanged = (parseFloat(tip) || 0) !== (appointment.tip ?? 0)
          const otherNoteChanged = paymentMethod === 'OTHER' && otherPayment !== ((appointment as any).paymentMethodNote || '')
          const hasPaymentChanges = paidChanged || methodChanged || tipChanged || otherNoteChanged
          return hasPaymentChanges ? (
            <button
              type="button"
              onClick={handleSave}
              className="w-full px-4 py-2.5 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors"
            >
              Save Payment
            </button>
          ) : null
        })()}
        </div>
      </div>

      {/* Past Date Confirmation Modal */}
      {showPastDateConfirm && pendingMoveData && createPortal(
        <>
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[10003]"
            onClick={() => {
              setShowPastDateConfirm(false)
              setPendingMoveData(null)
            }}
          />
          <div
            className="bg-white rounded-xl shadow-lg border-2 border-slate-200 max-w-md w-full overflow-hidden"
            style={{ zIndex: 10004 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800">Move to Past Date?</h3>
            </div>
            <div className="p-4">
              <p className="text-sm text-slate-600 mb-4">
                The selected date is in the past. Are you sure you want to move the appointment to this date?
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowPastDateConfirm(false)
                    setPendingMoveData(null)
                  }}
                  className="px-4 py-2 text-sm font-medium bg-slate-200 text-slate-800 rounded-lg hover:bg-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (pendingMoveData) {
                      executeMoveRecurring(pendingMoveData.date, pendingMoveData.time)
                    }
                  }}
                  className="px-4 py-2 text-sm font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Move
                </button>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  )
}

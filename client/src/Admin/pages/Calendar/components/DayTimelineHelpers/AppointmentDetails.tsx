import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { API_BASE_URL, fetchJson } from '../../../../../api'
import { useModal } from '../../../../../ModalProvider'
import { formatPhone } from '../../../../../formatPhone'
import type { Appointment } from '../../types'
import TeamOptionsModal from '../TeamOptionsModal'

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
}: AppointmentDetailsProps) {
  const { alert, confirm } = useModal()
  const navigate = useNavigate()
  const [paid, setPaid] = useState(appointment.paid)
  const [paymentMethod, setPaymentMethod] = useState(appointment.paymentMethod || 'CASH')
  const [otherPayment, setOtherPayment] = useState('')
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
  const [showTeamOptions, setShowTeamOptions] = useState(false)

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

  return (
    <div className="bg-white p-4 rounded-lg shadow-lg max-w-md">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-lg font-semibold">Appointment Details</h3>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
          ×
        </button>
      </div>

      <div className="space-y-4">
        {/* Client Info */}
        <div>
          <h4 className="font-medium">{appointment.client?.name}</h4>
          <p className="text-sm text-gray-600">{formatPhone(appointment.client?.number || '')}</p>
          <p className="text-sm text-gray-600">{appointment.address}</p>
        </div>

        {/* Appointment Info */}
        <div>
          <p className="text-sm">
            <span className="font-medium">Date:</span> {(() => {
              // Display date directly from database (assumed to be stored as local time, not UTC)
              const apptDate = typeof appointment.date === 'string' ? new Date(appointment.date) : appointment.date
              const year = apptDate.getFullYear()
              const month = String(apptDate.getMonth() + 1).padStart(2, '0')
              const day = String(apptDate.getDate()).padStart(2, '0')
              return `${year}-${month}-${day}`
            })()}
          </p>
          <p className="text-sm">
            <span className="font-medium">Time:</span> {appointment.time}
          </p>
          <p className="text-sm">
            <span className="font-medium">Type:</span> {appointment.type}
          </p>
          {appointment.hours && (
            <p className="text-sm">
              <span className="font-medium">Hours:</span> {appointment.hours}
            </p>
          )}
        </div>

        {/* Template Notes */}
        {loadingTemplate ? (
          <div className="text-xs text-gray-400 italic">Loading template...</div>
        ) : template ? (
          <div className="space-y-1">
            <div className="text-sm">
              <span className="font-medium">Team size:</span>{' '}
              {appointment.teamSize ?? template.teamSize ?? 1}
            </div>
            <div className="flex items-center justify-between gap-2">
              <label className="font-medium">Notes:</label>
              {!editingTemplateNotes || editingTemplateNotesId !== template.id ? (
                <button
                  type="button"
                  className="text-xs text-blue-500 hover:text-blue-700 whitespace-nowrap"
                  onClick={() => {
                    setEditingTemplateNotes(true)
                    setEditingTemplateNotesId(template.id)
                    setEditingTemplateNotesValue(template.notes || '')
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
                      const updated = await fetchJson(`${API_BASE_URL}/appointment-templates/${template.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ notes: editingTemplateNotesValue }),
                      })
                      setTemplate(updated)
                      
                      // Also update the appointment notes to match the template
                      try {
                        const updatedAppointment = await fetchJson(`${API_BASE_URL}/appointments/${appointment.id}`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ notes: editingTemplateNotesValue || null }),
                        })
                        // Notify parent component of the appointment update
                        onUpdate(updatedAppointment)
                      } catch (apptError) {
                        // Don't fail the whole operation if appointment update fails
                      }
                      
                      setEditingTemplateNotes(false)
                      setEditingTemplateNotesId(null)
                      setEditingTemplateNotesValue('')
                    } catch (error) {
                      await alert('Failed to update template notes')
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

        {/* Employees */}
        <div>
          <h4 className="font-medium mb-2">Employees</h4>
          <div className="space-y-1">
            {appointment.employees?.map((employee) => (
              <div key={employee.id} className="flex justify-between items-center">
                <span className="text-sm">{employee.name}</span>
                <button
                  onClick={() => employee.id && openExtra(employee.id)}
                  className="text-xs text-blue-500 hover:text-blue-700"
                >
                  + Extra
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Section */}
        <div>
          <h4 className="font-medium mb-2">Payment</h4>
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
                <input
                  type="number"
                  placeholder="Tip"
                  value={tip}
                  onChange={(e) => setTip(e.target.value)}
                  className="w-full border p-2 rounded text-sm"
                />
              </>
            )}
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

        {/* Team Options - separate from action panel */}
        {!isRecurringUnconfirmed && (
          <button
            onClick={() => setShowTeamOptions(true)}
            className="w-full px-3 py-2 bg-indigo-500 text-white rounded text-sm hover:bg-indigo-600 mb-2"
          >
            Team Options
          </button>
        )}

        {/* Actions Panel Toggle - Only show for non-recurring-unconfirmed appointments */}
        {!isRecurringUnconfirmed && (
          <div>
            <button
              onClick={() => setShowActionPanel(!showActionPanel)}
              className="w-full px-3 py-2 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 flex items-center justify-center gap-2"
            >
              {showActionPanel ? '▼' : '▶'} Action Panel
            </button>
          
          {showActionPanel && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {/* Blue buttons - Navigation/View */}
              {appointment.clientId && (
                <button
                  onClick={() => {
                    navigate(`/dashboard/clients/${appointment.clientId}`)
                    onClose()
                  }}
                  className="px-3 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                >
                  View Client
                </button>
              )}
              <button
                onClick={() => onCreate(appointment, 'RESCHEDULE_NEW')}
                className="px-3 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
              >
                Reschedule
              </button>
              
              {/* Green button - Edit */}
              <button
                onClick={() => onEdit(appointment)}
                className="px-3 py-2 bg-green-500 text-white rounded text-sm hover:bg-green-600"
              >
                Edit
              </button>
              
              {/* Purple button - Complete */}
              <button
                onClick={() => updateAppointment({ status: 'APPOINTED' })}
                className="px-3 py-2 bg-purple-500 text-white rounded text-sm hover:bg-purple-600"
              >
                Complete
              </button>
              
              {/* Red button - Cancel */}
              <button
                onClick={() => updateAppointment({ status: 'CANCEL' })}
                className="px-3 py-2 bg-red-500 text-white rounded text-sm hover:bg-red-600"
              >
                Cancel
              </button>
            </div>
          )}
          </div>
        )}

        {paid && (
          <button
            onClick={handleSave}
            className="w-full px-3 py-2 bg-green-500 text-white rounded"
          >
            Save Payment
          </button>
        )}
      </div>

      {showTeamOptions && (
        <TeamOptionsModal
          appointment={appointment}
          onClose={() => setShowTeamOptions(false)}
          onSave={(updated) => {
            onUpdate(updated)
            setShowTeamOptions(false)
          }}
        />
      )}

      {/* Past Date Confirmation Modal */}
      {showPastDateConfirm && pendingMoveData && createPortal(
        <>
          <div
            className="fixed inset-0 bg-black/50"
            style={{ zIndex: 10003 }}
            onClick={() => {
              setShowPastDateConfirm(false)
              setPendingMoveData(null)
            }}
          />
          <div
            className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white p-6 rounded-lg shadow-lg max-w-md"
            style={{ zIndex: 10004 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4">Move to Past Date?</h3>
            <p className="text-sm text-gray-600 mb-4">
              The selected date is in the past. Are you sure you want to move the appointment to this date?
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowPastDateConfirm(false)
                  setPendingMoveData(null)
                }}
                className="px-4 py-2 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (pendingMoveData) {
                    executeMoveRecurring(pendingMoveData.date, pendingMoveData.time)
                  }
                }}
                className="px-4 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
              >
                Move
              </button>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  )
}

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_BASE_URL } from '../../../../../api'
import { useModal } from '../../../../../ModalProvider'
import { formatPhone } from '../../../../../formatPhone'
import type { Appointment } from '../../types'

interface AppointmentDetailsProps {
  appointment: Appointment
  onUpdate: (appointment: Appointment) => void
  onClose: () => void
  onCreate: (appt: Appointment, status: Appointment['status']) => void
  onEdit: (appt: Appointment) => void
}

export default function AppointmentDetails({
  appointment,
  onUpdate,
  onClose,
  onCreate,
  onEdit,
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

  const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

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
            <span className="font-medium">Date:</span> {new Date(appointment.date).toLocaleDateString()}
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

        {/* Employees */}
        <div>
          <h4 className="font-medium mb-2">Employees</h4>
          <div className="space-y-1">
            {appointment.employees?.map((employee) => (
              <div key={employee.id} className="flex justify-between items-center">
                <span className="text-sm">{employee.name}</span>
                <button
                  onClick={() => openExtra(employee.id)}
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
                  onChange={(e) => setPaymentMethod(e.target.value)}
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

        {/* Actions Panel Toggle */}
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
                onClick={() => updateAppointment({ status: 'COMPLETED' })}
                className="px-3 py-2 bg-purple-500 text-white rounded text-sm hover:bg-purple-600"
              >
                Complete
              </button>
              
              {/* Red button - Cancel */}
              <button
                onClick={() => updateAppointment({ status: 'CANCELLED' })}
                className="px-3 py-2 bg-red-500 text-white rounded text-sm hover:bg-red-600"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {paid && (
          <button
            onClick={handleSave}
            className="w-full px-3 py-2 bg-green-500 text-white rounded"
          >
            Save Payment
          </button>
        )}
      </div>
    </div>
  )
}

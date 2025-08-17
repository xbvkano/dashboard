import { useState } from 'react'
import { API_BASE_URL, fetchJson } from '../../../../../api'
import { useModal } from '../../../../../ModalProvider'
import { useCreateAppointmentState } from './useCreateAppointmentState'
import ClientSection from './ClientSection'
import TemplateSection from './TemplateSection'
import type { Appointment } from '../../types'

interface Props {
  onClose: () => void
  onCreated: (appt: Appointment) => void
  initialClientId?: number
  initialTemplateId?: number
  newStatus?: Appointment['status']
  initialAppointment?: Appointment
}

export default function CreateAppointmentModal({
  onClose,
  onCreated,
  initialClientId,
  initialTemplateId,
  newStatus,
  initialAppointment,
}: Props) {
  const { alert } = useModal()
  const [creating, setCreating] = useState(false)

  const {
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
  } = useCreateAppointmentState(initialClientId, initialTemplateId, initialAppointment)

  const handleClientCreated = (client: any) => {
    // Refresh templates when a new client is created
    if (selectedClient) {
      // Update the selected client with the new one
      setSelectedClient(client)
    }
  }

  const handleTemplateCreated = (template: any) => {
    // Template was created/updated, refresh the list
    if (selectedClient) {
      // Refresh templates for the current client
      fetchJson(`${API_BASE_URL}/appointment-templates?clientId=${selectedClient.id}`)
        .then((data) => setTemplates(data))
        .catch(() => setTemplates([]))
    }
  }

  const createAppointment = async () => {
    if (!selectedClient) {
      alert('Please select a client')
      return
    }

    if (!date || !time) {
      alert('Please select a date and time')
      return
    }

    if (employeeIds.length === 0) {
      alert('Please select at least one employee')
      return
    }

    setCreating(true)

    try {
      const appointmentData = {
        clientId: selectedClient.id,
        templateId: selectedTemplate,
        date: new Date(date).toISOString(),
        time,
        hours: hours ? Number(hours) : null,
        employeeIds,
        paid,
        paymentMethod,
        paymentMethodNote: paymentMethodNote || undefined,
        tip: Number(tip) || 0,
        carpetRooms: carpetRooms ? Number(carpetRooms) : null,
        carpetPrice: carpetPrice ? Number(carpetPrice) : null,
        carpetEmployees: carpetEmployees.length > 0 ? carpetEmployees : undefined,
        notes: notes || undefined,
        noTeam,
        status: newStatus || status,
        recurring: recurring ? {
          frequency,
          months: Number(months),
        } : undefined,
      }

      const appointment = await fetchJson(`${API_BASE_URL}/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(appointmentData),
      })

      localStorage.removeItem('createAppointmentState')
      onCreated(appointment)
    } catch (error: any) {
      alert(error.error || 'Failed to create appointment')
    } finally {
      setCreating(false)
    }
  }

  const isFormValid = selectedClient && date && time && employeeIds.length > 0

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">
              {initialAppointment ? 'Edit Appointment' : 'Create Appointment'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ×
            </button>
          </div>

          <div className="space-y-6">
            <ClientSection
              selectedClient={selectedClient}
              setSelectedClient={setSelectedClient}
              clientSearch={clientSearch}
              setClientSearch={setClientSearch}
              clients={clients}
              setClients={setClients}
              showNewClient={showNewClient}
              setShowNewClient={setShowNewClient}
              newClient={newClient}
              setNewClient={setNewClient}
              onClientCreated={handleClientCreated}
            />

            {selectedClient && (
              <TemplateSection
                selectedClient={selectedClient}
                selectedTemplate={selectedTemplate}
                setSelectedTemplate={setSelectedTemplate}
                templates={templates}
                setTemplates={setTemplates}
                showNewTemplate={showNewTemplate}
                setShowNewTemplate={setShowNewTemplate}
                templateForm={templateForm}
                setTemplateForm={setTemplateForm}
                editing={editing}
                setEditing={setEditing}
                editingTemplateId={editingTemplateId}
                setEditingTemplateId={setEditingTemplateId}
                onTemplateCreated={handleTemplateCreated}
              />
            )}

            {/* Appointment Details Section */}
            <div className="mb-4">
              <h3 className="text-lg font-semibold mb-2">Appointment Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Date</label>
                  <input
                    type="date"
                    className="w-full border p-2 rounded"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Time</label>
                  <input
                    type="time"
                    className="w-full border p-2 rounded"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Hours</label>
                  <input
                    type="number"
                    className="w-full border p-2 rounded"
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                    placeholder="Estimated hours"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Status</label>
                  <select
                    className="w-full border p-2 rounded"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="APPOINTED">Appointed</option>
                    <option value="CONFIRMED">Confirmed</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Employees Section */}
            <div className="mb-4">
              <h3 className="text-lg font-semibold mb-2">Employees</h3>
              <div className="space-y-2">
                {employees.map((employee) => (
                  <label key={employee.id} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={employeeIds.includes(employee.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setEmployeeIds([...employeeIds, employee.id])
                        } else {
                          setEmployeeIds(employeeIds.filter(id => id !== employee.id))
                        }
                      }}
                      className="mr-2"
                    />
                    {employee.name}
                  </label>
                ))}
              </div>
            </div>

            {/* Payment Section */}
            <div className="mb-4">
              <h3 className="text-lg font-semibold mb-2">Payment</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Payment Method</label>
                  <select
                    className="w-full border p-2 rounded"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  >
                    <option value="CASH">Cash</option>
                    <option value="CHECK">Check</option>
                    <option value="CARD">Card</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Tip</label>
                  <input
                    type="number"
                    className="w-full border p-2 rounded"
                    value={tip}
                    onChange={(e) => setTip(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="mt-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={paid}
                    onChange={(e) => setPaid(e.target.checked)}
                    className="mr-2"
                  />
                  Paid
                </label>
              </div>
            </div>

            {/* Notes Section */}
            <div className="mb-4">
              <h3 className="text-lg font-semibold mb-2">Notes</h3>
              <textarea
                className="w-full border p-2 rounded"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes..."
              />
            </div>

            {/* Options */}
            <div className="mb-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={noTeam}
                  onChange={(e) => setNoTeam(e.target.checked)}
                  className="mr-2"
                />
                No team (single employee)
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 border rounded hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={createAppointment}
              disabled={!isFormValid || creating}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
            >
              {creating ? 'Creating...' : (initialAppointment ? 'Update' : 'Create')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

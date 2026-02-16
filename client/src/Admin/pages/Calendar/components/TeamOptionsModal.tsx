import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { API_BASE_URL, fetchJson } from '../../../../api'
import type { Appointment } from '../../types'

interface EmployeeWithAvailability {
  id: number
  name: string
  number: string
  experienced?: boolean
  available: boolean
}

interface TeamOptionsModalProps {
  appointment: Appointment
  onClose: () => void
  onSave: (appointment: Appointment) => void
}

export default function TeamOptionsModal({
  appointment,
  onClose,
  onSave,
}: TeamOptionsModalProps) {
  const [employees, setEmployees] = useState<EmployeeWithAvailability[]>([])
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const teamSize = (appointment as any).teamSize ?? 1
  const dateStr =
    typeof appointment.date === 'string'
      ? appointment.date.slice(0, 10)
      : appointment.date instanceof Date
        ? appointment.date.toISOString().slice(0, 10)
        : ''

  useEffect(() => {
    if (dateStr) {
      fetchJson(`${API_BASE_URL}/employees/available?date=${dateStr}`)
        .then((data: EmployeeWithAvailability[]) => setEmployees(data))
        .catch(() => setEmployees([]))
    }
  }, [dateStr])

  useEffect(() => {
    const ids = appointment.employees?.map((e) => e.id).filter(Boolean) ?? []
    setSelectedIds(ids)
  }, [appointment.employees])

  const filtered = employees.filter(
    (e) =>
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.number.includes(search)
  )

  const handleSave = async () => {
    const diff = selectedIds.length - teamSize
    if (diff !== 0 && !showConfirm) {
      setShowConfirm(true)
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`${API_BASE_URL}/appointments/${appointment.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '1',
        },
        body: JSON.stringify({
          employeeIds: selectedIds,
          noTeam: false,
        }),
      })
      if (res.ok) {
        const updated = await res.json()
        onSave(updated)
        onClose()
      }
    } finally {
      setSaving(false)
      setShowConfirm(false)
    }
  }

  const toggle = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  return createPortal(
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[110] p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-200">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-slate-800">Team Options</h2>
            <button
              onClick={onClose}
              className="p-1 text-slate-500 hover:text-slate-700 rounded"
            >
              ✕
            </button>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Team size: <span className="font-medium">{teamSize}</span>
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <p className="text-sm text-slate-600">
            Select employees for this appointment. You can select more or fewer than the recommended team size.
          </p>

          <input
            type="text"
            placeholder="Search employees"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-64 overflow-y-auto">
            {filtered.map((emp) => (
              <label
                key={emp.id}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 ${
                  selectedIds.includes(emp.id) ? 'bg-blue-50' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(emp.id)}
                  onChange={() => toggle(emp.id)}
                  className="rounded border-slate-300 text-blue-600"
                />
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-slate-800">{emp.name}</span>
                  {emp.available ? (
                    <span className="ml-2 text-xs text-emerald-600">Available</span>
                  ) : (
                    <span className="ml-2 text-xs text-amber-600">Not available</span>
                  )}
                </div>
                {emp.experienced && (
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                    Exp
                  </span>
                )}
              </label>
            ))}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-slate-200 bg-slate-50 flex gap-3">
          {showConfirm && (
            <p className="text-sm text-amber-700 mb-2">
              Selected {selectedIds.length} employee(s). Team size is {teamSize}. Continue anyway?
            </p>
          )}
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2.5 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Team'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { API_BASE_URL, fetchJson } from '../../../../../api'
import type { Appointment } from '../../types'

/** Z-index for the confirm overlay. Above DayTimelineModalContainer content (10000) so confirm shows on top. */
const CONFIRM_OVERLAY_Z = 10001

interface EmployeeWithAvailability {
  id: number
  name: string
  number: string
  available: boolean
}

export interface TeamOptionsModalProps {
  appointment: Appointment
  onClose: () => void
  onSave: (appointment: Appointment) => void
  /** Team size from the appointment's template (source of truth). When provided, overrides appointment.teamSize. */
  templateTeamSize?: number
  /** When true, render only the inner card (no overlay/portal). Used when embedded in DayTimelineModalContainer. */
  embed?: boolean
}

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

export default function TeamOptionsModal({
  appointment,
  onClose,
  onSave,
  templateTeamSize,
  embed = false,
}: TeamOptionsModalProps) {
  const [employees, setEmployees] = useState<EmployeeWithAvailability[]>([])
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [showSizeConfirm, setShowSizeConfirm] = useState(false)
  const [showNonAvailableConfirm, setShowNonAvailableConfirm] = useState(false)
  const [showNonAvailableSection, setShowNonAvailableSection] = useState(false)
  const [payByEmployee, setPayByEmployee] = useState<Record<number, number>>({})
  const [payNote, setPayNote] = useState((appointment as any).payrollNote ?? '')

  const teamSize = templateTeamSize ?? (appointment as any).teamSize ?? 1
  const dateStr =
    typeof appointment.date === 'string'
      ? appointment.date.slice(0, 10)
      : appointment.date instanceof Date
        ? appointment.date.toISOString().slice(0, 10)
        : ''
  const timeStr = appointment.time || ''

  useEffect(() => {
    if (dateStr) {
      const url = timeStr
        ? `${API_BASE_URL}/employees/available?date=${dateStr}&time=${encodeURIComponent(timeStr)}`
        : `${API_BASE_URL}/employees/available?date=${dateStr}`
      fetchJson(url)
        .then((data: EmployeeWithAvailability[]) => setEmployees(data))
        .catch(() => setEmployees([]))
    }
  }, [dateStr, timeStr])

  useEffect(() => {
    const ids = appointment.employees?.map((e) => e.id).filter(Boolean) ?? []
    setSelectedIds(ids)
  }, [appointment.employees])

  const defaultPayPerPerson = calcPayRate(
    appointment.type,
    appointment.size ?? null,
    Math.max(selectedIds.length, 1)
  )
  useEffect(() => {
    const next: Record<number, number> = {}
    selectedIds.forEach((id) => {
      const existing = (appointment.payrollItems as any)?.find((p: any) => p.employeeId === id)
      next[id] = existing?.amount != null ? existing.amount : defaultPayPerPerson
    })
    setPayByEmployee((prev) => ({ ...prev, ...next }))
  }, [selectedIds, defaultPayPerPerson, appointment.payrollItems])

  const available = employees.filter((e) => e.available)
  const nonAvailable = employees.filter((e) => !e.available)
  const filteredAvailable = available.filter(
    (e) =>
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.number.includes(search)
  )
  const filteredNonAvailable = nonAvailable.filter(
    (e) =>
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.number.includes(search)
  )
  const selectedNonAvailableCount = selectedIds.filter((id) =>
    nonAvailable.some((e) => e.id === id)
  ).length

  const initialSnapshot = useMemo(() => {
    const ids = appointment.employees?.map((e) => e.id).filter(Boolean) ?? []
    const defaultPay = calcPayRate(
      appointment.type,
      appointment.size ?? null,
      Math.max(ids.length, 1)
    )
    const pay: Record<number, number> = {}
    ids.forEach((id) => {
      const existing = (appointment.payrollItems as any)?.find((p: any) => p.employeeId === id)
      pay[id] = existing?.amount != null ? existing.amount : defaultPay
    })
    const note = (appointment as any).payrollNote ?? ''
    return {
      selectedIds: [...ids].sort((a, b) => a - b),
      payByEmployee: pay,
      payNote: note,
    }
  }, [appointment.id])

  const hasChanges = (() => {
    const currentIdsSorted = [...selectedIds].sort((a, b) => a - b)
    if (
      initialSnapshot.selectedIds.length !== currentIdsSorted.length ||
      initialSnapshot.selectedIds.some((id, i) => id !== currentIdsSorted[i])
    ) {
      return true
    }
    if (payNote.trim() !== initialSnapshot.payNote.trim()) return true
    for (const id of selectedIds) {
      const current = payByEmployee[id] ?? defaultPayPerPerson
      const initial = initialSnapshot.payByEmployee[id] ?? defaultPayPerPerson
      if (current !== initial) return true
    }
    return false
  })()

  const handleSave = async (skipSizeConfirm = false, skipNonAvailableConfirm = false) => {
    const sizeDiff = selectedIds.length !== teamSize
    if (sizeDiff && !skipSizeConfirm && !showSizeConfirm) {
      setShowSizeConfirm(true)
      return
    }
    if (sizeDiff && skipSizeConfirm) setShowSizeConfirm(false)
    if (selectedNonAvailableCount > 0 && !skipNonAvailableConfirm && !showNonAvailableConfirm) {
      setShowNonAvailableConfirm(true)
      return
    }
    setSaving(true)
    try {
      const payrollAmounts: Record<number, number> = {}
      selectedIds.forEach((id) => {
        const amt = payByEmployee[id]
        payrollAmounts[id] = typeof amt === 'number' ? amt : defaultPayPerPerson
      })
      const body: any = {
        employeeIds: selectedIds,
        noTeam: false,
        payrollAmounts,
        payrollNote: payNote.trim() || null,
      }
      const res = await fetch(`${API_BASE_URL}/appointments/${appointment.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '1',
        },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        const updated = await res.json()
        setShowSizeConfirm(false)
        setShowNonAvailableConfirm(false)
        onClose()
        onSave(updated)
      } else {
        const errBody = await res.json().catch(() => ({}))
        const message =
          res.status === 404
            ? 'This appointment was not found. It may have been deleted—please close and refresh the calendar.'
            : (errBody as { error?: string }).error || `Save failed (${res.status})`
        window.alert(message)
        if (res.status === 404) {
          onClose()
        }
      }
    } catch (err) {
      console.error('TeamOptions save failed:', err)
      window.alert('Failed to save team. Please try again.')
      onClose()
    } finally {
      setSaving(false)
      setShowSizeConfirm(false)
      setShowNonAvailableConfirm(false)
    }
  }

  const confirmSizeAndSave = () => void handleSave(true, false)
  const confirmNonAvailableAndSave = () => void handleSave(true, true)

  const showConfirmModal = showSizeConfirm || showNonAvailableConfirm
  const confirmTitle = showSizeConfirm
    ? 'Confirm team size'
    : 'Confirm non-available employees'
  const confirmMessage = showSizeConfirm
    ? `Selected ${selectedIds.length} employee(s); recommended team size is ${teamSize}. Continue anyway?`
    : `${selectedNonAvailableCount} selected employee(s) are not available for this time. Continue anyway?`
  const onConfirm = showSizeConfirm ? confirmSizeAndSave : confirmNonAvailableAndSave
  const dismissConfirm = () => {
    setShowSizeConfirm(false)
    setShowNonAvailableConfirm(false)
  }

  const toggle = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const setPay = (employeeId: number, value: number) => {
    setPayByEmployee((prev) => ({ ...prev, [employeeId]: value }))
  }

  const innerContent = (
    <>
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
            Team size: <span className="font-medium">{teamSize}</span> — Selected:{' '}
            <span className="font-medium">{selectedIds.length}</span>
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <p className="text-sm text-slate-600">
            Choose employees for this appointment. You can pick from available, non-available, or both.
          </p>

          <input
            type="text"
            placeholder="Search employees"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div>
            <h3 className="text-sm font-medium text-slate-700 mb-1">Available employees</h3>
            <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-48 overflow-y-auto">
              {filteredAvailable.map((emp) => (
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
                    <span className="ml-2 text-xs text-emerald-600">Available</span>
                  </div>
                </label>
              ))}
              {filteredAvailable.length === 0 && (
                <div className="px-4 py-3 text-sm text-slate-500">No available employees</div>
              )}
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setShowNonAvailableSection((v) => !v)}
              className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900"
            >
              {showNonAvailableSection ? '▼' : '▶'} Non-available employees ({nonAvailable.length})
            </button>
            {showNonAvailableSection && (
              <div className="mt-1 border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-48 overflow-y-auto">
                {filteredNonAvailable.map((emp) => (
                  <label
                    key={emp.id}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 ${
                      selectedIds.includes(emp.id) ? 'bg-amber-50' : ''
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
                      <span className="ml-2 text-xs text-amber-600">Not available</span>
                    </div>
                  </label>
                ))}
                {filteredNonAvailable.length === 0 && (
                  <div className="px-4 py-3 text-sm text-slate-500">None</div>
                )}
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-slate-200">
            <h3 className="text-sm font-medium text-slate-700 mb-2">Pay</h3>
            <p className="text-xs text-slate-500 mb-2">
              Default: ${defaultPayPerPerson.toFixed(2)} per person (auto). You can edit below.
            </p>
            {selectedIds.length > 0 && (
              <div className="space-y-2">
                {selectedIds.map((id) => {
                  const emp = employees.find((e) => e.id === id)
                  const value = payByEmployee[id] ?? defaultPayPerPerson
                  return (
                    <div key={id} className="flex items-center gap-2">
                      <label className="flex-1 text-sm text-slate-700 truncate">
                        {emp?.name ?? `Employee ${id}`}
                      </label>
                      <span className="text-slate-500">$</span>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        className="w-20 border border-slate-300 rounded px-2 py-1 text-sm"
                        value={value}
                        onChange={(e) => setPay(id, parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  )
                })}
              </div>
            )}
            <label className="block text-sm text-slate-600 mt-2">Pay note (optional)</label>
            <input
              type="text"
              placeholder="e.g. Bonus for lead"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1"
              value={payNote}
              onChange={(e) => setPayNote(e.target.value)}
            />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-slate-200 bg-slate-50">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              onClick={() => handleSave(false, false)}
              disabled={saving || !hasChanges || showConfirmModal}
              className="flex-1 px-4 py-2.5 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {saving ? 'Saving...' : 'Save Team'}
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation modal: rendered inside this component so z-index is correct relative to container (10000). */}
      {showConfirmModal && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center p-4"
          style={{ zIndex: CONFIRM_OVERLAY_Z }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="team-confirm-title"
          onClick={(e) => {
            e.stopPropagation()
            e.preventDefault()
          }}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="team-confirm-title" className="text-lg font-semibold text-slate-800 mb-2">
              {confirmTitle}
            </h3>
            <p className="text-sm text-slate-600 mb-5">{confirmMessage}</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={dismissConfirm}
                className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => onConfirm()}
                disabled={saving}
                className="flex-1 px-4 py-2.5 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Yes, continue'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )

  if (embed) {
    return <>{innerContent}</>
  }

  return createPortal(
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[110] p-4"
      onClick={onClose}
    >
      {innerContent}
    </div>,
    document.body
  )
}

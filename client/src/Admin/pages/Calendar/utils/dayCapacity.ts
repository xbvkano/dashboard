import type { Appointment } from '../types'

/** Morning is before 14:00; afternoon is 14:00 or later (matches server getSlotFromTime). */
export const AFTERNOON_START_HOUR = 14

export type ShiftSlot = 'AM' | 'PM'

export type DeclaredAvailableEmployee = {
  id: number
  name: string
  number?: string
  available?: boolean
}

export type DayCapacityShiftSummary = {
  slot: ShiftSlot
  appointmentCount: number
  availableCount: number
  scheduledCount: number
  teamRequired: number
  shortfall: number
  availableEmployees: { id: number; name: string; number?: string }[]
  scheduledEmployees: {
    id: number
    name: string
    number?: string
    clients: string[]
  }[]
  demand: {
    appointmentId?: number
    clientName: string
    teamSize: number
    time: string
  }[]
  malformedTimeCount: number
  missingTeamSizeCount: number
}

const EXCLUDED_STATUSES = new Set(['CANCEL', 'DELETED', 'RESCHEDULE_OLD'])

export function isActiveDayAppointment(appt: Pick<Appointment, 'status'>): boolean {
  const status = appt.status ?? 'APPOINTED'
  return !EXCLUDED_STATUSES.has(status)
}

/**
 * Parse HH:mm (or H:mm) into a shift. Returns null when time is missing/malformed
 * so callers can avoid silently dumping bad rows into AM.
 */
export function getShiftFromTime(time: string | null | undefined): ShiftSlot | null {
  if (!time || typeof time !== 'string') return null
  const match = time.trim().match(/^(\d{1,2}):(\d{2})/)
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
  return hour < AFTERNOON_START_HOUR ? 'AM' : 'PM'
}

function clientName(appt: Appointment): string {
  return appt.client?.name?.trim() || `Client #${appt.clientId}`
}

function appointmentTeamSize(appt: Appointment): number | null {
  if (typeof appt.teamSize === 'number' && Number.isFinite(appt.teamSize) && appt.teamSize >= 0) {
    return appt.teamSize
  }
  return null
}

export function buildShiftSummary(
  slot: ShiftSlot,
  appointments: Appointment[],
  declaredAvailable: DeclaredAvailableEmployee[],
): DayCapacityShiftSummary {
  const active = appointments.filter(isActiveDayAppointment)
  const inSlot: Appointment[] = []
  let malformedTimeCount = 0

  for (const appt of active) {
    const shift = getShiftFromTime(appt.time)
    if (shift == null) {
      malformedTimeCount += 1
      continue
    }
    if (shift === slot) inSlot.push(appt)
  }

  const demand: DayCapacityShiftSummary['demand'] = []
  let teamRequired = 0
  let missingTeamSizeCount = 0
  for (const appt of inSlot) {
    const size = appointmentTeamSize(appt)
    if (size == null) {
      missingTeamSizeCount += 1
      continue
    }
    teamRequired += size
    demand.push({
      appointmentId: appt.id,
      clientName: clientName(appt),
      teamSize: size,
      time: appt.time,
    })
  }

  const scheduledMap = new Map<
    number,
    { id: number; name: string; number?: string; clients: Set<string> }
  >()
  for (const appt of inSlot) {
    for (const emp of appt.employees ?? []) {
      if (emp.id == null) continue
      const existing = scheduledMap.get(emp.id)
      const name = emp.name || `Employee #${emp.id}`
      if (existing) {
        existing.clients.add(clientName(appt))
      } else {
        scheduledMap.set(emp.id, {
          id: emp.id,
          name,
          number: emp.number,
          clients: new Set([clientName(appt)]),
        })
      }
    }
  }

  const scheduledEmployees = [...scheduledMap.values()]
    .map((e) => ({
      id: e.id,
      name: e.name,
      number: e.number,
      clients: [...e.clients].sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const scheduledIds = new Set(scheduledEmployees.map((e) => e.id))
  const availableEmployees = declaredAvailable
    .filter((e) => e.available !== false && e.id != null && !scheduledIds.has(e.id))
    .map((e) => ({ id: e.id, name: e.name || `Employee #${e.id}`, number: e.number }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const shortfall = Math.max(0, teamRequired - scheduledEmployees.length)

  return {
    slot,
    appointmentCount: inSlot.length,
    availableCount: availableEmployees.length,
    scheduledCount: scheduledEmployees.length,
    teamRequired,
    shortfall,
    availableEmployees,
    scheduledEmployees,
    demand,
    malformedTimeCount,
    missingTeamSizeCount,
  }
}

export function buildDayCapacity(
  appointments: Appointment[],
  declaredAm: DeclaredAvailableEmployee[],
  declaredPm: DeclaredAvailableEmployee[],
): { am: DayCapacityShiftSummary; pm: DayCapacityShiftSummary } {
  return {
    am: buildShiftSummary('AM', appointments, declaredAm),
    pm: buildShiftSummary('PM', appointments, declaredPm),
  }
}

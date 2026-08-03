export type AppointmentEditSnapshot = {
  address: string
  instructions?: string | null
  date: string
  time: string
  type?: string | null
  size?: string | null
  price?: number | null
  notes?: string | null
}

/** Fields employees see for doing the job (Upcoming Jobs + logistics SMS). */
export const EMPLOYEE_NOTIFIABLE_EDIT_FIELDS = [
  'address',
  'instructions',
  'date',
  'time',
] as const

function normText(value: string | null | undefined): string {
  return (value ?? '').trim()
}

function sameText(a: string | null | undefined, b: string | null | undefined): boolean {
  return normText(a) === normText(b)
}

/**
 * True when address, instructions, date, or time changed.
 * Type / size / price / notes are admin-only for this notify gate.
 */
export function hasEmployeeNotifiableAppointmentChanges(params: {
  previous: AppointmentEditSnapshot
  current: AppointmentEditSnapshot
}): boolean {
  const { previous, current } = params
  return (
    !sameText(previous.address, current.address) ||
    !sameText(previous.instructions, current.instructions) ||
    !sameText(previous.date, current.date) ||
    !sameText(previous.time, current.time)
  )
}

/**
 * Build SMS body for team edit notifications.
 * Always identifies the job by the previous address; change lines use new values only
 * for employee-visible logistics fields (address, instructions, date, time).
 */
export function buildAppointmentEditNotice(params: {
  previous: AppointmentEditSnapshot
  current: AppointmentEditSnapshot
}): string {
  const { previous, current } = params
  const lines: string[] = [
    'Appointment Edit Notice',
    `Address: ${normText(previous.address) || normText(current.address) || '(unknown)'}`,
  ]

  if (!sameText(previous.address, current.address)) {
    lines.push(`Address updated: ${normText(current.address) || '(none)'}`)
  }
  if (!sameText(previous.instructions, current.instructions)) {
    lines.push(`Instructions updated: ${normText(current.instructions) || '(none)'}`)
  }
  if (!sameText(previous.date, current.date)) {
    lines.push(`Date updated: ${normText(current.date) || '(none)'}`)
  }
  if (!sameText(previous.time, current.time)) {
    lines.push(`Time updated: ${normText(current.time) || '(none)'}`)
  }

  lines.push('\n Please do not respond to this message')
  return lines.join('\n')
}

export function snapshotFromAppointment(appt: {
  address?: string | null
  cityStateZip?: string | null
  localDate?: string | null
  date?: string | Date | null
  dateUtc?: string | Date | null
  time?: string | null
  type?: string | null
  size?: string | null
  price?: number | null
  notes?: string | null
}): AppointmentEditSnapshot {
  let date = ''
  if (typeof appt.localDate === 'string' && appt.localDate) {
    date = appt.localDate
  } else if (typeof appt.date === 'string') {
    date = appt.date.slice(0, 10)
  } else if (appt.date instanceof Date) {
    date = appt.date.toISOString().slice(0, 10)
  } else if (typeof appt.dateUtc === 'string') {
    date = appt.dateUtc.slice(0, 10)
  } else if (appt.dateUtc instanceof Date) {
    date = appt.dateUtc.toISOString().slice(0, 10)
  }

  return {
    address: appt.address ?? '',
    instructions: appt.cityStateZip ?? null,
    date,
    time: appt.time ?? '',
    type: appt.type ?? null,
    size: appt.size ?? null,
    price: appt.price ?? null,
    notes: appt.notes ?? null,
  }
}

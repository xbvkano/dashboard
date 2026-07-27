import { DateTime } from 'luxon'

export const ON_DUTY_HORIZON_WEEKS = 8
export const DEFAULT_ON_DUTY_TZ = 'America/Los_Angeles'

export type RecurrenceLike = {
  id?: number
  employeeId: number
  dayOfWeek: number
  startTimeLocal: string
  endTimeLocal: string
  timeZone: string
  intervalWeeks: number
  phase: number
  anchorDate: Date
  priority: number
  active: boolean
}

export type MaterializedWindow = {
  employeeId: number
  startAt: Date
  endAt: Date
  priority: number
  recurrenceId?: number
}

/** Monday 00:00 of the ISO week containing `date` in the given zone (as a Date at UTC midnight of that calendar Monday). */
export function mondayOfWeekContaining(date: Date, timeZone: string): DateTime {
  const dt = DateTime.fromJSDate(date, { zone: timeZone }).startOf('day')
  // Luxon weekday: 1=Mon .. 7=Sun
  return dt.startOf('week') // ISO week starts Monday
}

/** Weeks between two Mondays (floor). */
export function weeksBetweenMondays(anchorMonday: DateTime, weekMonday: DateTime): number {
  const a = anchorMonday.startOf('day')
  const b = weekMonday.startOf('day')
  return Math.floor(b.diff(a, 'weeks').weeks)
}

export function recurrenceAppliesOnWeek(
  rule: Pick<RecurrenceLike, 'intervalWeeks' | 'phase' | 'anchorDate' | 'timeZone'>,
  weekMonday: DateTime
): boolean {
  const tz = rule.timeZone || DEFAULT_ON_DUTY_TZ
  const anchor = DateTime.fromJSDate(rule.anchorDate, { zone: tz }).startOf('day')
  const anchorMonday = anchor.startOf('week')
  const interval = rule.intervalWeeks === 2 ? 2 : 1
  if (interval === 1) return true
  const weeks = weeksBetweenMondays(anchorMonday, weekMonday)
  const phase = rule.phase === 1 ? 1 : 0
  const mod = ((weeks % interval) + interval) % interval
  return mod === phase
}

/**
 * Build UTC start/end for a recurrence on a specific calendar date in the rule's timezone.
 * Overnight: endTimeLocal <= startTimeLocal → end is next day.
 */
export function windowForLocalDay(
  rule: Pick<RecurrenceLike, 'startTimeLocal' | 'endTimeLocal' | 'timeZone' | 'employeeId' | 'priority' | 'id'>,
  localDate: DateTime
): MaterializedWindow | null {
  const tz = rule.timeZone || DEFAULT_ON_DUTY_TZ
  const [sh, sm] = rule.startTimeLocal.split(':').map((x) => parseInt(x, 10))
  const [eh, em] = rule.endTimeLocal.split(':').map((x) => parseInt(x, 10))
  if (![sh, sm, eh, em].every((n) => Number.isFinite(n))) return null

  const startLocal = localDate.set({
    hour: sh,
    minute: sm,
    second: 0,
    millisecond: 0,
  })
  let endLocal = localDate.set({
    hour: eh,
    minute: em,
    second: 0,
    millisecond: 0,
  })
  const startMins = sh * 60 + sm
  const endMins = eh * 60 + em
  if (endMins <= startMins) {
    endLocal = endLocal.plus({ days: 1 })
  }
  if (!startLocal.isValid || !endLocal.isValid) return null

  return {
    employeeId: rule.employeeId,
    startAt: startLocal.toUTC().toJSDate(),
    endAt: endLocal.toUTC().toJSDate(),
    priority: rule.priority,
    recurrenceId: rule.id,
  }
}

/** Materialize active rules for the next `horizonWeeks` from `from` (inclusive). */
export function materializeRecurrences(
  rules: RecurrenceLike[],
  from: Date = new Date(),
  horizonWeeks: number = ON_DUTY_HORIZON_WEEKS
): MaterializedWindow[] {
  const out: MaterializedWindow[] = []
  const active = rules.filter((r) => r.active)

  for (const rule of active) {
    const tz = rule.timeZone || DEFAULT_ON_DUTY_TZ
    const startMonday = mondayOfWeekContaining(from, tz)
    for (let w = 0; w < horizonWeeks; w++) {
      const weekMonday = startMonday.plus({ weeks: w })
      if (!recurrenceAppliesOnWeek(rule, weekMonday)) continue
      // dayOfWeek: 0=Sun .. 6=Sat. Luxon weekday: 1=Mon .. 7=Sun
      const luxonWeekday = rule.dayOfWeek === 0 ? 7 : rule.dayOfWeek
      const localDay = weekMonday.set({ weekday: luxonWeekday as 1 | 2 | 3 | 4 | 5 | 6 | 7 })
      // Skip past windows that already ended before `from`
      const win = windowForLocalDay(rule, localDay)
      if (!win) continue
      if (win.endAt <= from) continue
      out.push(win)
    }
  }
  return out
}

export type WeekBlockAssignee = {
  employeeId: number
  name?: string
  role?: string | null
  intervalWeeks: number
  phase: number
  priority: number
  recurrenceId?: number
}

export type WeekBlock = {
  dayOfWeek: number
  date: string // YYYY-MM-DD in display TZ
  startTimeLocal: string
  endTimeLocal: string
  timeZone: string
  assignees: WeekBlockAssignee[]
}

/** Resolve which rules fire in a Sun–Sat week. `weekStartSunday` is that Sunday (local date). */
export function resolveWeekBlocks(
  rules: (RecurrenceLike & { employee?: { name: string; user?: { role: string } | null } })[],
  weekStartSunday: Date,
  displayTz: string = DEFAULT_ON_DUTY_TZ
): WeekBlock[] {
  const start = DateTime.fromJSDate(weekStartSunday, { zone: displayTz }).startOf('day')
  // Snap to Sunday of that week if needed (Luxon: Sun=7)
  const sunday =
    start.weekday === 7 ? start : start.minus({ days: start.weekday })
  const monday = sunday.plus({ days: 1 })

  const blockMap = new Map<string, WeekBlock>()

  for (const rule of rules.filter((r) => r.active)) {
    if (!recurrenceAppliesOnWeek(rule, monday)) continue
    const luxonWeekday = rule.dayOfWeek === 0 ? 7 : rule.dayOfWeek
    const localDay = monday.set({ weekday: luxonWeekday as 1 | 2 | 3 | 4 | 5 | 6 | 7 })
    const dateStr = localDay.toFormat('yyyy-MM-dd')
    const key = `${rule.dayOfWeek}|${rule.startTimeLocal}|${rule.endTimeLocal}|${rule.timeZone}`
    let block = blockMap.get(key)
    if (!block) {
      block = {
        dayOfWeek: rule.dayOfWeek,
        date: dateStr,
        startTimeLocal: rule.startTimeLocal,
        endTimeLocal: rule.endTimeLocal,
        timeZone: rule.timeZone,
        assignees: [],
      }
      blockMap.set(key, block)
    }
    block.assignees.push({
      employeeId: rule.employeeId,
      name: rule.employee?.name,
      role: rule.employee?.user?.role ?? null,
      intervalWeeks: rule.intervalWeeks,
      phase: rule.phase,
      priority: rule.priority,
      recurrenceId: rule.id,
    })
  }

  for (const b of blockMap.values()) {
    b.assignees.sort((a, c) => a.priority - c.priority || a.employeeId - c.employeeId)
  }

  return [...blockMap.values()].sort(
    (a, b) => a.dayOfWeek - b.dayOfWeek || a.startTimeLocal.localeCompare(b.startTimeLocal)
  )
}

/** Parse YYYY-MM-DD as a calendar date (UTC noon to avoid DST edge when converting). */
export function parseDateOnly(isoDate: string, timeZone: string = DEFAULT_ON_DUTY_TZ): Date {
  const dt = DateTime.fromISO(isoDate, { zone: timeZone })
  if (!dt.isValid) throw new Error('Invalid date')
  return dt.startOf('day').toJSDate()
}

export function isValidHhMm(s: string): boolean {
  return /^\d{2}:\d{2}$/.test(s) && (() => {
    const [h, m] = s.split(':').map(Number)
    return h >= 0 && h <= 23 && m >= 0 && m <= 59
  })()
}

/** Minutes from midnight for HH:mm. Invalid → NaN. */
export function hhMmToMinutes(s: string): number {
  if (!isValidHhMm(s)) return NaN
  const [h, m] = s.split(':').map(Number)
  return h * 60 + m
}

/**
 * Local wall-clock ranges on the same calendar day.
 * Overnight (end <= start) is treated as spanning to end+24h for overlap checks on that day.
 */
export function localTimeRangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
): boolean {
  let a0 = hhMmToMinutes(aStart)
  let a1 = hhMmToMinutes(aEnd)
  let b0 = hhMmToMinutes(bStart)
  let b1 = hhMmToMinutes(bEnd)
  if (![a0, a1, b0, b1].every((n) => Number.isFinite(n))) return false
  if (a1 <= a0) a1 += 24 * 60
  if (b1 <= b0) b1 += 24 * 60
  return a0 < b1 && b0 < a1
}

/**
 * Whether two cadence patterns can ever both be on duty in the same calendar week.
 * Weekly always co-occurs with anything; biweekly only co-occurs with the same phase.
 */
export function cadencesCanCoOccur(
  a: { intervalWeeks: number; phase: number },
  b: { intervalWeeks: number; phase: number }
): boolean {
  const aInterval = a.intervalWeeks === 2 ? 2 : 1
  const bInterval = b.intervalWeeks === 2 ? 2 : 1
  const aPhase = a.phase === 1 ? 1 : 0
  const bPhase = b.phase === 1 ? 1 : 0
  if (aInterval === 1 || bInterval === 1) return true
  return aPhase === bPhase
}

export type OnDutyRuleConflictInput = {
  employeeId: number
  dayOfWeek: number
  startTimeLocal: string
  endTimeLocal: string
  intervalWeeks?: number
  phase?: number
}

export type OnDutyRuleConflict = {
  dayOfWeek: number
  a: { employeeId: number; startTimeLocal: string; endTimeLocal: string }
  b: { employeeId: number; startTimeLocal: string; endTimeLocal: string }
  message: string
}

/**
 * Find pairs of rules that would put two people on the admin line at the same time
 * on the same weekday (overlapping local times that can co-occur by cadence).
 */
export function findOnDutyRuleConflicts(rules: OnDutyRuleConflictInput[]): OnDutyRuleConflict[] {
  const conflicts: OnDutyRuleConflict[] = []
  const normalized = rules.map((r) => ({
    employeeId: r.employeeId,
    dayOfWeek: r.dayOfWeek,
    startTimeLocal: r.startTimeLocal,
    endTimeLocal: r.endTimeLocal,
    intervalWeeks: r.intervalWeeks === 2 ? 2 : 1,
    phase: r.intervalWeeks === 2 && r.phase === 1 ? 1 : 0,
  }))

  for (let i = 0; i < normalized.length; i++) {
    for (let j = i + 1; j < normalized.length; j++) {
      const a = normalized[i]
      const b = normalized[j]
      if (a.dayOfWeek !== b.dayOfWeek) continue
      if (!localTimeRangesOverlap(a.startTimeLocal, a.endTimeLocal, b.startTimeLocal, b.endTimeLocal)) {
        continue
      }
      if (!cadencesCanCoOccur(a, b)) continue
      conflicts.push({
        dayOfWeek: a.dayOfWeek,
        a: {
          employeeId: a.employeeId,
          startTimeLocal: a.startTimeLocal,
          endTimeLocal: a.endTimeLocal,
        },
        b: {
          employeeId: b.employeeId,
          startTimeLocal: b.startTimeLocal,
          endTimeLocal: b.endTimeLocal,
        },
        message: `Two people overlap on day ${a.dayOfWeek} (${a.startTimeLocal}–${a.endTimeLocal} and ${b.startTimeLocal}–${b.endTimeLocal})`,
      })
    }
  }
  return conflicts
}

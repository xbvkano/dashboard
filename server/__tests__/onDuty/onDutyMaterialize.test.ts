import { DateTime } from 'luxon'
import {
  materializeRecurrences,
  recurrenceAppliesOnWeek,
  resolveWeekBlocks,
  windowForLocalDay,
  type RecurrenceLike,
} from '../../src/services/onDutyMaterialize'

const TZ = 'America/Los_Angeles'
const ANCHOR = DateTime.fromISO('2026-07-20', { zone: TZ }).startOf('day').toJSDate() // Monday in LA

function baseRule(overrides: Partial<RecurrenceLike> = {}): RecurrenceLike {
  return {
    id: 1,
    employeeId: 10,
    dayOfWeek: 0, // Sunday
    startTimeLocal: '09:00',
    endTimeLocal: '17:00',
    timeZone: TZ,
    intervalWeeks: 1,
    phase: 0,
    anchorDate: ANCHOR,
    priority: 0,
    active: true,
    ...overrides,
  }
}

describe('recurrenceAppliesOnWeek intercalation', () => {
  const week0Mon = DateTime.fromISO('2026-07-20', { zone: TZ }) // anchor Monday
  const week1Mon = week0Mon.plus({ weeks: 1 })
  const week2Mon = week0Mon.plus({ weeks: 2 })

  it('weekly rule applies every week', () => {
    const rule = baseRule({ intervalWeeks: 1, phase: 0 })
    expect(recurrenceAppliesOnWeek(rule, week0Mon)).toBe(true)
    expect(recurrenceAppliesOnWeek(rule, week1Mon)).toBe(true)
  })

  it('biweekly phase 0 applies week 0 and 2, not 1', () => {
    const rule = baseRule({ intervalWeeks: 2, phase: 0 })
    expect(recurrenceAppliesOnWeek(rule, week0Mon)).toBe(true)
    expect(recurrenceAppliesOnWeek(rule, week1Mon)).toBe(false)
    expect(recurrenceAppliesOnWeek(rule, week2Mon)).toBe(true)
  })

  it('biweekly phase 1 applies week 1, not 0', () => {
    const rule = baseRule({ intervalWeeks: 2, phase: 1 })
    expect(recurrenceAppliesOnWeek(rule, week0Mon)).toBe(false)
    expect(recurrenceAppliesOnWeek(rule, week1Mon)).toBe(true)
  })
})

describe('windowForLocalDay overnight', () => {
  it('crosses midnight when end <= start', () => {
    const rule = baseRule({ startTimeLocal: '22:00', endTimeLocal: '06:00' })
    const day = DateTime.fromISO('2026-07-20', { zone: TZ })
    const win = windowForLocalDay(rule, day)!
    expect(win.startAt.toISOString()).toBe(
      DateTime.fromISO('2026-07-20T22:00:00', { zone: TZ }).toUTC().toISO()
    )
    expect(win.endAt.toISOString()).toBe(
      DateTime.fromISO('2026-07-21T06:00:00', { zone: TZ }).toUTC().toISO()
    )
  })
})

describe('materializeRecurrences + resolveWeekBlocks intercalation', () => {
  it('alternates two admins on Sundays across consecutive weeks', () => {
    const admin1 = baseRule({
      id: 1,
      employeeId: 1,
      intervalWeeks: 2,
      phase: 0,
      employee: { name: 'Admin1', user: { role: 'ADMIN' } },
    } as RecurrenceLike & { employee: { name: string; user: { role: string } } })
    const admin2 = baseRule({
      id: 2,
      employeeId: 2,
      intervalWeeks: 2,
      phase: 1,
      employee: { name: 'Admin2', user: { role: 'ADMIN' } },
    } as RecurrenceLike & { employee: { name: string; user: { role: string } } })

    // Week starting Sunday 2026-07-19 (contains Monday 2026-07-20 = phase 0)
    const weekASunday = DateTime.fromISO('2026-07-19', { zone: TZ }).startOf('day').toJSDate()
    const weekA = resolveWeekBlocks(
      [admin1, admin2] as Parameters<typeof resolveWeekBlocks>[0],
      weekASunday,
      TZ
    )
    expect(weekA).toHaveLength(1)
    expect(weekA[0].assignees.map((a) => a.employeeId)).toEqual([1])

    // Next Sunday 2026-07-26 → phase 1
    const weekBSunday = DateTime.fromISO('2026-07-26', { zone: TZ }).startOf('day').toJSDate()
    const weekB = resolveWeekBlocks(
      [admin1, admin2] as Parameters<typeof resolveWeekBlocks>[0],
      weekBSunday,
      TZ
    )
    expect(weekB).toHaveLength(1)
    expect(weekB[0].assignees.map((a) => a.employeeId)).toEqual([2])
  })

  it('materializes windows for biweekly rules', () => {
    const rules = [
      baseRule({ id: 1, employeeId: 1, intervalWeeks: 2, phase: 0 }),
      baseRule({ id: 2, employeeId: 2, intervalWeeks: 2, phase: 1 }),
    ]
    const from = DateTime.fromISO('2026-07-20T08:00:00', { zone: TZ }).toJSDate()
    const windows = materializeRecurrences(rules, from, 4)
    const emp1 = windows.filter((w) => w.employeeId === 1)
    const emp2 = windows.filter((w) => w.employeeId === 2)
    expect(emp1.length).toBeGreaterThanOrEqual(1)
    expect(emp2.length).toBeGreaterThanOrEqual(1)
    // No overlapping same Sunday for both
    for (const w1 of emp1) {
      for (const w2 of emp2) {
        const overlap = w1.startAt < w2.endAt && w2.startAt < w1.endAt
        expect(overlap).toBe(false)
      }
    }
  })
})

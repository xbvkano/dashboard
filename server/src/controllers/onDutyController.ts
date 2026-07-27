import { Request, Response } from 'express'
import { PrismaClient, Role } from '@prisma/client'
import { parseUserIdHeader } from '../utils/httpUser'
import {
  DEFAULT_ON_DUTY_TZ,
  findOnDutyRuleConflicts,
  isValidHhMm,
  materializeRecurrences,
  parseDateOnly,
  resolveWeekBlocks,
  type RecurrenceLike,
} from '../services/onDutyMaterialize'
import { ensureEmployeeForDutyUser } from '../services/ensureEmployeeForDutyUser'

const prisma = new PrismaClient()

const DUTY_ROLES: Role[] = ['OWNER', 'ADMIN', 'SUPERVISOR']

async function requireUser(req: Request): Promise<{ id: number; role: Role } | null> {
  const id = parseUserIdHeader(req.headers['x-user-id'])
  if (id == null) return null
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, disabled: true },
  })
  if (!user || user.disabled) return null
  return { id: user.id, role: user.role }
}

async function rematerializeAll(): Promise<number> {
  const rules = await prisma.onDutyRecurrence.findMany()
  const mapped: RecurrenceLike[] = rules.map((r) => ({
    id: r.id,
    employeeId: r.employeeId,
    dayOfWeek: r.dayOfWeek,
    startTimeLocal: r.startTimeLocal,
    endTimeLocal: r.endTimeLocal,
    timeZone: r.timeZone,
    intervalWeeks: r.intervalWeeks,
    phase: r.phase,
    anchorDate: r.anchorDate,
    priority: r.priority,
    active: r.active,
  }))

  const now = new Date()
  const windows = materializeRecurrences(mapped, now)

  // Replace future generated rows; keep past for history
  await prisma.onDutySchedule.deleteMany({
    where: {
      OR: [{ startAt: { gte: now } }, { endAt: { gt: now } }],
    },
  })

  if (windows.length > 0) {
    await prisma.onDutySchedule.createMany({
      data: windows.map((w) => ({
        employeeId: w.employeeId,
        startAt: w.startAt,
        endAt: w.endAt,
        priority: w.priority,
        active: true,
        recurrenceId: w.recurrenceId ?? null,
      })),
    })
  }
  return windows.length
}

/** GET /api/on-duty/assignees — OWNER/ADMIN/SUPERVISOR users (ensures Employee rows exist). */
export async function listDutyAssignees(req: Request, res: Response) {
  try {
    const user = await requireUser(req)
    if (!user || (user.role !== 'OWNER' && user.role !== 'ADMIN')) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const adminUsers = await prisma.user.findMany({
      where: {
        disabled: false,
        role: { in: DUTY_ROLES },
      },
      select: { id: true, name: true, role: true, userName: true },
      orderBy: { name: 'asc' },
    })

    const employees = []
    for (const u of adminUsers) {
      try {
        const emp = await ensureEmployeeForDutyUser(prisma, u.id)
        employees.push({
          id: emp.id,
          name: emp.name,
          phoneNumber: emp.number,
          role: u.role,
        })
      } catch (e) {
        console.warn('listDutyAssignees skip user', u.id, e)
      }
    }

    return res.json({ employees })
  } catch (err) {
    console.error('listDutyAssignees', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

/** GET /api/on-duty/recurrences */
export async function listRecurrences(req: Request, res: Response) {
  try {
    const user = await requireUser(req)
    if (!user || (user.role !== 'OWNER' && user.role !== 'ADMIN')) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    const rules = await prisma.onDutyRecurrence.findMany({
      include: {
        employee: { select: { id: true, name: true, user: { select: { role: true } } } },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { startTimeLocal: 'asc' }, { priority: 'asc' }],
    })
    return res.json({
      recurrences: rules.map((r) => ({
        id: r.id,
        employeeId: r.employeeId,
        employeeName: r.employee.name,
        role: r.employee.user?.role ?? null,
        dayOfWeek: r.dayOfWeek,
        startTimeLocal: r.startTimeLocal,
        endTimeLocal: r.endTimeLocal,
        timeZone: r.timeZone,
        intervalWeeks: r.intervalWeeks,
        phase: r.phase,
        anchorDate: r.anchorDate.toISOString().slice(0, 10),
        priority: r.priority,
        active: r.active,
      })),
    })
  } catch (err) {
    console.error('listRecurrences', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

type RuleInput = {
  employeeId: number
  dayOfWeek: number
  startTimeLocal: string
  endTimeLocal: string
  timeZone?: string
  intervalWeeks?: number
  phase?: number
  priority?: number
  active?: boolean
}

/** PUT /api/on-duty/recurrences — OWNER only; replace all rules + rematerialize */
export async function replaceRecurrences(req: Request, res: Response) {
  try {
    const user = await requireUser(req)
    if (!user || user.role !== 'OWNER') {
      return res.status(403).json({ error: 'Only OWNER can edit on-duty schedule' })
    }

    const anchorDateRaw = req.body?.anchorDate
    const rulesRaw = req.body?.rules
    if (typeof anchorDateRaw !== 'string' || !Array.isArray(rulesRaw)) {
      return res.status(400).json({ error: 'anchorDate (YYYY-MM-DD) and rules[] required' })
    }

    let anchorDate: Date
    try {
      anchorDate = parseDateOnly(anchorDateRaw)
    } catch {
      return res.status(400).json({ error: 'Invalid anchorDate' })
    }

    const rules = rulesRaw as RuleInput[]
    for (const r of rules) {
      if (!Number.isInteger(r.employeeId) || r.employeeId < 1) {
        return res.status(400).json({ error: 'Invalid employeeId' })
      }
      if (!Number.isInteger(r.dayOfWeek) || r.dayOfWeek < 0 || r.dayOfWeek > 6) {
        return res.status(400).json({ error: 'dayOfWeek must be 0–6' })
      }
      if (!isValidHhMm(r.startTimeLocal) || !isValidHhMm(r.endTimeLocal)) {
        return res.status(400).json({ error: 'startTimeLocal/endTimeLocal must be HH:mm' })
      }
      const interval = r.intervalWeeks === 2 ? 2 : 1
      const phase = r.phase === 1 ? 1 : 0
      if (interval === 1 && phase !== 0) {
        /* allow but ignore */
      }
    }

    const employeeIds = [...new Set(rules.map((r) => r.employeeId))]
    const okEmployees = await prisma.employee.findMany({
      where: {
        id: { in: employeeIds },
        disabled: false,
        user: { role: { in: DUTY_ROLES }, disabled: false },
      },
      select: { id: true },
    })
    if (okEmployees.length !== employeeIds.length) {
      return res.status(400).json({
        error: 'All assignees must be active Owner/Admin/Supervisor accounts',
      })
    }

    const overlaps = findOnDutyRuleConflicts(rules)
    if (overlaps.length > 0) {
      return res.status(400).json({
        error:
          'Only one person can be on duty at a time on the same day. Overlapping shifts were found.',
        conflicts: overlaps,
      })
    }

    await prisma.$transaction(async (tx) => {
      await tx.onDutySchedule.deleteMany({})
      await tx.onDutyRecurrence.deleteMany({})
      for (let i = 0; i < rules.length; i++) {
        const r = rules[i]
        await tx.onDutyRecurrence.create({
          data: {
            employeeId: r.employeeId,
            dayOfWeek: r.dayOfWeek,
            startTimeLocal: r.startTimeLocal,
            endTimeLocal: r.endTimeLocal,
            timeZone: r.timeZone?.trim() || DEFAULT_ON_DUTY_TZ,
            intervalWeeks: r.intervalWeeks === 2 ? 2 : 1,
            phase: r.intervalWeeks === 2 && r.phase === 1 ? 1 : 0,
            anchorDate,
            priority: Number.isFinite(r.priority) ? Number(r.priority) : i,
            active: r.active !== false,
          },
        })
      }
    })

    const created = await rematerializeAll()
    return res.json({ ok: true, materialized: created })
  } catch (err) {
    console.error('replaceRecurrences', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

/** GET /api/on-duty/week?weekStart=YYYY-MM-DD (Sunday of week) */
export async function getWeekView(req: Request, res: Response) {
  try {
    const user = await requireUser(req)
    if (!user || (user.role !== 'OWNER' && user.role !== 'ADMIN')) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    const weekStart = typeof req.query.weekStart === 'string' ? req.query.weekStart : ''
    if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
      return res.status(400).json({ error: 'weekStart=YYYY-MM-DD (Sunday) required' })
    }
    const sunday = parseDateOnly(weekStart)
    const rules = await prisma.onDutyRecurrence.findMany({
      include: {
        employee: { select: { name: true, user: { select: { role: true } } } },
      },
    })
    const mapped = rules.map((r) => ({
      id: r.id,
      employeeId: r.employeeId,
      dayOfWeek: r.dayOfWeek,
      startTimeLocal: r.startTimeLocal,
      endTimeLocal: r.endTimeLocal,
      timeZone: r.timeZone,
      intervalWeeks: r.intervalWeeks,
      phase: r.phase,
      anchorDate: r.anchorDate,
      priority: r.priority,
      active: r.active,
      employee: r.employee,
    }))
    const blocks = resolveWeekBlocks(mapped, sunday)
    return res.json({ weekStart, blocks })
  } catch (err) {
    console.error('getWeekView', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

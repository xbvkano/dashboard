import { Request, Response } from 'express'
import { DateTime } from 'luxon'
import { PrismaClient } from '@prisma/client'
import twilio from 'twilio'
import { calculatePayRate, calculateCarpetRate } from '../utils/appointmentUtils'
import { getNextOrThisUpdateDay, getNextUpdateDueDate } from '../utils/schedulePolicyUtils'
import { supervisorPhoneE164 } from '../utils/phoneUtils'
import { isTwilioOutboundConfigured, twilioMessageCreateParams } from '../utils/twilioSms'
import {
  appointmentLocalDateKey,
  DEFAULT_APPOINTMENT_TIMEZONE,
  whereAppointmentOnInclusiveLocalDateRange,
} from '../utils/appointmentTimezone'
import {
  SERVICE_STATUS_BUBBLE_COLOR,
  SERVICE_STATUS_SMS_BODIES,
  isServiceStatusKind,
  type ServiceStatusKind,
} from '../constants/serviceStatus'
import {
  getAppointmentServiceWindow,
  listActiveAppointments,
  pickActiveAppointment,
} from '../utils/serviceStatusWindow'
import {
  resolveArrivedActions,
  resolveOnTheWayActions,
  resolveThirtyMinutesActions,
} from '../services/serviceStatusActions'
import { buildServiceStatusPushoverPayload } from '../utils/pushoverNotificationCopy'
import { isPushoverConfigured, sendPushoverMessage } from '../services/pushover'
import { sendOutboundSms } from '../services/messaging'

const prisma = new PrismaClient()
const smsClient = twilio(
  process.env.TWILIO_ACCOUNT_SID || '',
  process.env.TWILIO_AUTH_TOKEN || '',
)

/** Result: employee id (+ name), disabled, or not authenticated */
type EmployeeAuth = { employeeId: number; name: string } | { disabled: true } | null

// Helper to get employee from request; returns null if not authenticated, { disabled: true } if employee is disabled
async function getEmployeeAuth(req: Request): Promise<EmployeeAuth> {
  const userId = req.headers['x-user-id'] as string
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId, 10) },
      include: { employee: true },
    })
    if (user?.employee) {
      if (user.employee.disabled) return { disabled: true }
      return { employeeId: user.employee.id, name: user.employee.name }
    }
  }

  const userName = req.headers['x-user-name'] as string
  if (userName) {
    const user = await prisma.user.findUnique({
      where: { userName },
      include: { employee: true },
    })
    if (user?.employee) {
      if (user.employee.disabled) return { disabled: true }
      return { employeeId: user.employee.id, name: user.employee.name }
    }
  }

  return null
}

// Move past dates from futureSchedule to pastSchedule
function movePastDates(futureSchedule: string[], pastSchedule: string[]): {
  newFuture: string[]
  newPast: string[]
} {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  yesterday.setHours(23, 59, 59, 999)
  
  const newFuture: string[] = []
  const newPast = [...pastSchedule]
  
  futureSchedule.forEach(entry => {
    const parts = entry.split('-')
    if (parts.length !== 5) {
      // Invalid format, skip
      return
    }
    
    const [year, month, day] = parts
    const entryDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    
    if (entryDate <= yesterday) {
      // Move to past
      newPast.push(entry)
    } else {
      // Keep in future
      newFuture.push(entry)
    }
  })
  
  return { newFuture, newPast }
}

/** Format a Date as YYYY-MM-DD (calendar day) so clients don't shift the day due to timezone (e.g. Sunday becoming Saturday). */
function formatDateOnly(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export async function getSchedule(req: Request, res: Response) {
  try {
    const auth = await getEmployeeAuth(req)
    if (!auth) return res.status(401).json({ error: 'Unauthorized' })
    if ('disabled' in auth) return res.status(403).json({ error: 'Account disabled' })
    const employeeId = auth.employeeId

    let schedule = await prisma.schedule.findUnique({
      where: { employeeId }
    })

    if (!schedule) {
      const policy = await prisma.schedulePolicy.findUnique({ where: { id: 1 } })
      const updateDay = policy?.updateDayOfWeek ?? 0
      const nextDue = getNextOrThisUpdateDay(new Date(), updateDay)
      schedule = await prisma.schedule.create({
        data: {
          employeeId,
          futureSchedule: [],
          pastSchedule: [],
          employeeUpdate: new Date(),
          nextScheduleUpdateDueAt: nextDue
        }
      })
    } else if (schedule.nextScheduleUpdateDueAt == null) {
      const policy = await prisma.schedulePolicy.findUnique({ where: { id: 1 } })
      const updateDay = policy?.updateDayOfWeek ?? 0
      const nextDue = getNextOrThisUpdateDay(new Date(), updateDay)
      schedule = await prisma.schedule.update({
        where: { employeeId },
        data: { nextScheduleUpdateDueAt: nextDue }
      })
    }

    // Move past dates before returning
    const { newFuture, newPast } = movePastDates(schedule.futureSchedule, schedule.pastSchedule)
    
    // Update if there were changes
    if (newFuture.length !== schedule.futureSchedule.length || newPast.length !== schedule.pastSchedule.length) {
      schedule = await prisma.schedule.update({
        where: { employeeId },
        data: {
          futureSchedule: newFuture,
          pastSchedule: newPast
        }
      })
    }

    res.json({
      futureSchedule: schedule.futureSchedule,
      pastSchedule: schedule.pastSchedule,
      employeeUpdate: schedule.employeeUpdate,
      nextScheduleUpdateDueAt: schedule.nextScheduleUpdateDueAt
        ? formatDateOnly(new Date(schedule.nextScheduleUpdateDueAt))
        : null,
    })
  } catch (e) {
    console.error('Error fetching schedule:', e)
    res.status(500).json({ error: 'Failed to fetch schedule' })
  }
}

// Validate schedule entry format: YYYY-MM-DD-T-S
function validateScheduleEntry(entry: string): boolean {
  const parts = entry.split('-')
  if (parts.length !== 5) return false
  
  const [year, month, day, type, status] = parts
  
  // Validate date parts are numbers
  if (isNaN(parseInt(year)) || isNaN(parseInt(month)) || isNaN(parseInt(day))) {
    return false
  }
  
  // Validate type: M (Morning) or A (Afternoon)
  if (type !== 'M' && type !== 'A') {
    return false
  }
  
  // Validate status: F (Free) or B (Booked)
  if (status !== 'F' && status !== 'B') {
    return false
  }
  
  // Validate date is valid
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
  if (date.getFullYear() !== parseInt(year) || 
      date.getMonth() !== parseInt(month) - 1 || 
      date.getDate() !== parseInt(day)) {
    return false
  }
  
  return true
}

export async function saveSchedule(req: Request, res: Response) {
  try {
    const auth = await getEmployeeAuth(req)
    if (!auth) return res.status(401).json({ error: 'Unauthorized' })
    if ('disabled' in auth) return res.status(403).json({ error: 'Account disabled' })
    const employeeId = auth.employeeId

    const { futureSchedule } = req.body as { futureSchedule: string[] }
    
    if (!Array.isArray(futureSchedule)) {
      return res.status(400).json({ error: 'Invalid schedule format' })
    }

    // Allow empty schedule - just update timestamp
    // Validate entries only if they exist
    if (futureSchedule.length > 0) {
      const invalidEntries = futureSchedule.filter(entry => !validateScheduleEntry(entry))
      if (invalidEntries.length > 0) {
        return res.status(400).json({ 
          error: 'Invalid schedule entries found',
          invalidEntries: invalidEntries.slice(0, 5) // Show first 5 invalid entries
        })
      }
    }

    // Get existing schedule
    let schedule = await prisma.schedule.findUnique({
      where: { employeeId }
    })

    const existingPast = schedule?.pastSchedule || []
    
    // Move past dates from new schedule (even if empty, this will just return empty arrays)
    const { newFuture, newPast } = movePastDates(futureSchedule, existingPast)

    const policy = await prisma.schedulePolicy.findUnique({ where: { id: 1 } })
    const updateDay = policy?.updateDayOfWeek ?? 0
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const currentDue = schedule?.nextScheduleUpdateDueAt
      ? (() => {
          const d = new Date(schedule.nextScheduleUpdateDueAt)
          d.setHours(0, 0, 0, 0)
          return d
        })()
      : null
    // Advance due date when update is on or after current due: update Feb 23 keeps due March 1; update March 1 or March 2 (missed) moves due to March 8
    const nextDue =
      currentDue == null
        ? getNextOrThisUpdateDay(today, updateDay)
        : today.getTime() < currentDue.getTime()
          ? currentDue
          : getNextUpdateDueDate(today, updateDay)

    if (schedule) {
      schedule = await prisma.schedule.update({
        where: { employeeId },
        data: {
          futureSchedule: newFuture,
          pastSchedule: newPast,
          employeeUpdate: new Date(),
          nextScheduleUpdateDueAt: nextDue
        }
      })
    } else {
      schedule = await prisma.schedule.create({
        data: {
          employeeId,
          futureSchedule: newFuture,
          pastSchedule: newPast,
          employeeUpdate: new Date(),
          nextScheduleUpdateDueAt: nextDue
        }
      })
    }

    res.json({ success: true, schedule })
  } catch (e) {
    console.error('Error saving schedule:', e)
    res.status(500).json({ error: 'Failed to save schedule' })
  }
}

export async function confirmSchedule(req: Request, res: Response) {
  try {
    const auth = await getEmployeeAuth(req)
    if (!auth) return res.status(401).json({ error: 'Unauthorized' })
    if ('disabled' in auth) return res.status(403).json({ error: 'Account disabled' })
    const employeeId = auth.employeeId

    const { futureSchedule } = req.body as { futureSchedule: string[] }
    
    if (!Array.isArray(futureSchedule)) {
      return res.status(400).json({ error: 'Invalid schedule format' })
    }

    // Validate all entries
    const invalidEntries = futureSchedule.filter(entry => !validateScheduleEntry(entry))
    if (invalidEntries.length > 0) {
      return res.status(400).json({ 
        error: 'Invalid schedule entries found',
        invalidEntries: invalidEntries.slice(0, 5) // Show first 5 invalid entries
      })
    }

    // Get existing schedule
    let schedule = await prisma.schedule.findUnique({
      where: { employeeId }
    })

    const existingPast = schedule?.pastSchedule || []
    
    // Move past dates from new schedule
    const { newFuture, newPast } = movePastDates(futureSchedule, existingPast)

    const policy = await prisma.schedulePolicy.findUnique({ where: { id: 1 } })
    const updateDay = policy?.updateDayOfWeek ?? 0
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const currentDue = schedule?.nextScheduleUpdateDueAt
      ? (() => {
          const d = new Date(schedule.nextScheduleUpdateDueAt)
          d.setHours(0, 0, 0, 0)
          return d
        })()
      : null
    const nextDue =
      currentDue == null
        ? getNextOrThisUpdateDay(today, updateDay)
        : today.getTime() < currentDue.getTime()
          ? currentDue
          : getNextUpdateDueDate(today, updateDay)

    if (schedule) {
      schedule = await prisma.schedule.update({
        where: { employeeId },
        data: {
          futureSchedule: newFuture,
          pastSchedule: newPast,
          employeeUpdate: new Date(),
          nextScheduleUpdateDueAt: nextDue
        }
      })
    } else {
      schedule = await prisma.schedule.create({
        data: {
          employeeId,
          futureSchedule: newFuture,
          pastSchedule: newPast,
          employeeUpdate: new Date(),
          nextScheduleUpdateDueAt: nextDue
        }
      })
    }

    res.json({ success: true, confirmed: true, schedule })
  } catch (e) {
    console.error('Error confirming schedule:', e)
    res.status(500).json({ error: 'Failed to confirm schedule' })
  }
}

// AM = before 2pm (time < '14:00'), PM = 2pm or after
function getBlockFromTime(time: string): 'AM' | 'PM' {
  const [h] = (time || '00:00').split(':').map(Number)
  return h < 14 ? 'AM' : 'PM'
}

export async function getUpcomingAppointments(req: Request, res: Response) {
  try {
    const auth = await getEmployeeAuth(req)
    if (!auth) return res.status(401).json({ error: 'Unauthorized' })
    if ('disabled' in auth) return res.status(403).json({ error: 'Account disabled' })
    const employeeId = auth.employeeId

    const z = DEFAULT_APPOINTMENT_TIMEZONE
    const nowZ = DateTime.now().setZone(z)
    const startStr = nowZ.toFormat('yyyy-LL-dd')
    const endStr = nowZ.plus({ days: 14 }).toFormat('yyyy-LL-dd')
    let windowWhere
    try {
      windowWhere = whereAppointmentOnInclusiveLocalDateRange(startStr, endStr, z)
    } catch {
      return res.status(500).json({ error: 'Failed to fetch upcoming appointments' })
    }

    const appointments = await prisma.appointment.findMany({
      where: {
        employees: { some: { id: employeeId } },
        status: { notIn: ['RESCHEDULE_OLD', 'DELETED', 'CANCEL'] },
        AND: [windowWhere],
      },
      include: {
        template: true,
        // Only load this employee's payroll item so we get their specific pay amount
        payrollItems: {
          where: { employeeId },
          include: { extras: true },
        },
        employees: { select: { id: true, name: true } },
      },
      orderBy: [{ dateUtc: 'asc' }, { date: 'asc' }, { time: 'asc' }],
    })

    const result = appointments.map((a) => {
      const dateStr = appointmentLocalDateKey({ dateUtc: a.dateUtc, date: a.date })
      const team = [...(a.employees ?? [])].sort((x, y) => x.name.localeCompare(y.name))
      const count = team.length || 1
      const defaultPay = calculatePayRate(a.type, a.size ?? null, count)
      const carpetIds = (a.carpetEmployees as number[]) || []
      const carpetShare =
        a.carpetRooms && a.size && carpetIds.length
          ? calculateCarpetRate(a.size, a.carpetRooms) / carpetIds.length
          : 0
      // We filtered payrollItems by employeeId, so at most one item (this employee's)
      const pi = a.payrollItems?.[0]
      const basePay =
        pi != null && pi.amount != null ? Number(pi.amount) : defaultPay
      const extrasTotal = (pi?.extras || []).reduce(
        (sum: number, ex: { amount: number }) => sum + Number(ex.amount),
        0
      )
      const pay = basePay + (carpetIds.includes(employeeId) ? carpetShare : 0) + extrasTotal

      return {
        id: a.id,
        date: dateStr,
        time: a.time,
        address: a.address,
        instructions: a.template?.instructions ?? null,
        block: getBlockFromTime(a.time),
        pay: Math.round(pay * 100) / 100,
        confirmed: pi?.confirmed ?? false,
        type: a.type,
        employees: team,
      }
    })

    res.json(result)
  } catch (e) {
    console.error('Error fetching upcoming appointments:', e)
    res.status(500).json({ error: 'Failed to fetch upcoming appointments' })
  }
}

export async function confirmJob(req: Request, res: Response) {
  try {
    const auth = await getEmployeeAuth(req)
    if (!auth) return res.status(401).json({ error: 'Unauthorized' })
    if ('disabled' in auth) return res.status(403).json({ error: 'Account disabled' })
    const employeeId = auth.employeeId

    const { appointmentId } = req.body as { appointmentId?: number }
    if (typeof appointmentId !== 'number' || !Number.isInteger(appointmentId)) {
      return res.status(400).json({ error: 'appointmentId required' })
    }

    const payrollItem = await prisma.payrollItem.findFirst({
      where: {
        appointmentId,
        employeeId,
      },
      include: {
        appointment: { include: { client: true } },
        employee: {
          include: {
            supervisor: { include: { employee: true } },
          },
        },
      },
    })
    if (!payrollItem) {
      return res.status(404).json({ error: 'Job not found or not assigned to you' })
    }

    await prisma.payrollItem.update({
      where: { id: payrollItem.id },
      data: { confirmed: true },
    })

    // Notify supervisor by SMS (best-effort; do not fail the request).
    // Requires TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER, and supervisor phone.
    const supervisor = payrollItem.employee?.supervisor
    if (supervisor && isTwilioOutboundConfigured()) {
      const phoneNorm = supervisorPhoneE164(supervisor)
      if (phoneNorm) {
        const appt = payrollItem.appointment
        const clientName = appt?.client?.name ?? 'Unknown client'
        const employeeName = payrollItem.employee?.name ?? 'Employee'
        const dateStr = appt?.date
          ? new Date(appt.date).toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
              timeZone: 'UTC',
            })
          : ''
        const timeStr = appt?.time ?? ''
        const body = [
          'Evidence Cleaning: Job confirmed.',
          `Employee: ${employeeName}`,
          `Client: ${clientName}`,
          `Day: ${dateStr}`,
          `Time: ${timeStr}`,
        ].join('\n')
        smsClient.messages
          .create(twilioMessageCreateParams(phoneNorm, body))
          .catch((err) => console.error('Error sending supervisor job-confirmed SMS:', err))
      }
    }

    res.json({ success: true, confirmed: true })
  } catch (e) {
    console.error('Error confirming job:', e)
    res.status(500).json({ error: 'Failed to confirm job' })
  }
}

export async function getActiveJob(req: Request, res: Response) {
  try {
    const auth = await getEmployeeAuth(req)
    if (!auth) return res.status(401).json({ error: 'Unauthorized' })
    if ('disabled' in auth) return res.status(403).json({ error: 'Account disabled' })
    const employeeId = auth.employeeId

    const z = DEFAULT_APPOINTMENT_TIMEZONE
    const now = new Date()
    const nowZ = DateTime.fromJSDate(now).setZone(z)
    // ±1 day so early window near midnight still finds the appointment
    const startStr = nowZ.minus({ days: 1 }).toFormat('yyyy-LL-dd')
    const endStr = nowZ.plus({ days: 1 }).toFormat('yyyy-LL-dd')
    const windowWhere = whereAppointmentOnInclusiveLocalDateRange(startStr, endStr, z)

    const appointments = await prisma.appointment.findMany({
      where: {
        employees: { some: { id: employeeId } },
        status: { notIn: ['RESCHEDULE_OLD', 'DELETED', 'CANCEL'] },
        AND: [windowWhere],
      },
      select: {
        id: true,
        dateUtc: true,
        date: true,
        time: true,
        hours: true,
        size: true,
        type: true,
        status: true,
        address: true,
      },
    })

    const actives = listActiveAppointments(appointments, now, z)
    if (actives.length === 0) {
      return res.json({ activeJob: null, activeJobs: [] })
    }

    const allEvents = await prisma.appointmentServiceStatusEvent.findMany({
      where: { appointmentId: { in: actives.map((a) => a.id) } },
      select: { appointmentId: true, kind: true, employeeId: true, smsMessageId: true },
    })

    const activeJobs = actives.map((active) => {
      const { start, end } = getAppointmentServiceWindow(active, z)
      const events = allEvents.filter((e) => e.appointmentId === active.id)
      const clicked = {
        ON_THE_WAY: events.some((e) => e.kind === 'ON_THE_WAY' && e.employeeId === employeeId),
        ARRIVED: events.some((e) => e.kind === 'ARRIVED' && e.employeeId === employeeId),
        THIRTY_MINUTES_LEFT: events.some(
          (e) => e.kind === 'THIRTY_MINUTES_LEFT' && e.employeeId === employeeId,
        ),
      }
      const smsSent = {
        ON_THE_WAY: events.some((e) => e.kind === 'ON_THE_WAY' && e.smsMessageId != null),
        THIRTY_MINUTES_LEFT: events.some(
          (e) => e.kind === 'THIRTY_MINUTES_LEFT' && e.smsMessageId != null,
        ),
      }
      const thirtyMinDone = events.some((e) => e.kind === 'THIRTY_MINUTES_LEFT')
      return {
        id: active.id,
        address: active.address,
        time: active.time,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        clicked,
        smsSent,
        thirtyMinDone,
      }
    })

    res.json({
      activeJob: activeJobs[0] ?? null,
      activeJobs,
    })
  } catch (e) {
    console.error('Error fetching active job:', e)
    res.status(500).json({ error: 'Failed to fetch active job' })
  }
}

async function resolveServiceStatusConversationId(appt: {
  clientId: number
  conversationSessionId: number | null
  conversationSession: { conversationId: number } | null
}): Promise<number | null> {
  if (appt.conversationSession?.conversationId) {
    return appt.conversationSession.conversationId
  }
  const byClient = await prisma.conversation.findFirst({
    where: {
      clientId: appt.clientId,
      status: { not: 'ARCHIVED' },
    },
    orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
    select: { id: true },
  })
  return byClient?.id ?? null
}

export async function postAppointmentServiceStatus(req: Request, res: Response) {
  try {
    const auth = await getEmployeeAuth(req)
    if (!auth) return res.status(401).json({ error: 'Unauthorized' })
    if ('disabled' in auth) return res.status(403).json({ error: 'Account disabled' })
    const { employeeId, name: employeeName } = auth

    const appointmentId = parseInt(String(req.params.id), 10)
    if (Number.isNaN(appointmentId)) {
      return res.status(400).json({ error: 'Invalid appointment id' })
    }

    const kindRaw = (req.body as { kind?: string })?.kind
    if (!kindRaw || !isServiceStatusKind(kindRaw)) {
      return res.status(400).json({ error: 'Invalid kind' })
    }
    const kind: ServiceStatusKind = kindRaw

    const appt = await prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        employees: { some: { id: employeeId } },
        status: { notIn: ['RESCHEDULE_OLD', 'DELETED', 'CANCEL'] },
      },
      include: {
        conversationSession: { select: { conversationId: true } },
        client: { select: { id: true, name: true, number: true } },
      },
    })
    if (!appt) {
      return res.status(404).json({ error: 'Appointment not found or not assigned to you' })
    }

    const z = DEFAULT_APPOINTMENT_TIMEZONE
    const now = new Date()
    const inWindow = pickActiveAppointment([appt], now, z)
    if (!inWindow) {
      return res.status(409).json({ error: 'Appointment is not currently in service window' })
    }

    let plan
    if (kind === 'ON_THE_WAY') {
      const self = await prisma.appointmentServiceStatusEvent.findFirst({
        where: { appointmentId, kind, employeeId },
      })
      const teamSms = await prisma.appointmentServiceStatusEvent.findFirst({
        where: { appointmentId, kind, smsMessageId: { not: null } },
      })
      plan = resolveOnTheWayActions({
        alreadyClickedByThisEmployee: self != null,
        teamAlreadySentSms: teamSms != null,
      })
    } else if (kind === 'ARRIVED') {
      const self = await prisma.appointmentServiceStatusEvent.findFirst({
        where: { appointmentId, kind, employeeId },
      })
      plan = resolveArrivedActions({ alreadyClickedByThisEmployee: self != null })
    } else {
      const any = await prisma.appointmentServiceStatusEvent.findFirst({
        where: { appointmentId, kind },
      })
      plan = resolveThirtyMinutesActions({ anyTeamMemberAlreadyClicked: any != null })
    }

    if (plan.outcome === 'already_handled' || plan.outcome === 'ignored') {
      return res.json({
        outcome: plan.outcome,
        smsSent: false,
        pushoverSent: false,
      })
    }

    let smsSent = false
    let smsMessageId: number | null = null
    let smsError: string | undefined

    if (plan.sendSms) {
      const conversationId = await resolveServiceStatusConversationId(appt)
      const body = SERVICE_STATUS_SMS_BODIES[kind]
      if (!conversationId || !body) {
        smsError = 'Could not send SMS (no conversation or body)'
      } else {
        try {
          const sent = await sendOutboundSms(prisma, {
            conversationId,
            body,
            userId: null,
          })
          smsMessageId = sent.messageId
          await prisma.message.update({
            where: { id: sent.messageId },
            data: {
              appointmentId,
              attributionLabel: employeeName,
              bubbleColorOverride: SERVICE_STATUS_BUBBLE_COLOR,
            },
          })
          smsSent = true
        } catch (e) {
          console.error('service status SMS failed', e)
          smsError = 'Failed to send SMS'
        }
      }
    }

    if (plan.recordClick) {
      await prisma.appointmentServiceStatusEvent.create({
        data: {
          appointmentId,
          kind,
          employeeId,
          smsMessageId: smsMessageId ?? undefined,
        },
      })
    }

    let pushoverSent = false
    if (plan.sendPushover && isPushoverConfigured()) {
      try {
        await sendPushoverMessage(
          buildServiceStatusPushoverPayload({
            kind,
            employeeName,
            clientName: appt.client?.name ?? 'Client',
            address: appt.address,
            time: appt.time,
          }),
        )
        pushoverSent = true
      } catch (e) {
        console.error('service status pushover failed', e)
      }
    }

    res.json({
      outcome: 'ok',
      smsSent,
      pushoverSent,
      ...(smsError ? { smsError } : {}),
    })
  } catch (e) {
    console.error('Error posting service status:', e)
    res.status(500).json({ error: 'Failed to post service status' })
  }
}



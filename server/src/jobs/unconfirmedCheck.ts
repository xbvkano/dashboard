import cron from 'node-cron'
import { PrismaClient, Prisma } from '@prisma/client'
import twilio from 'twilio'
import { normalizePhone } from '../utils/phoneUtils'

const prisma = new PrismaClient()

/** Payroll item with employee and appointment (and client) for reminder logic */
type PayrollItemWithAppointmentAndEmployee = Prisma.PayrollItemGetPayload<{
  include: { employee: true; appointment: { include: { client: true } } }
}>

const smsClient = twilio(
  process.env.TWILIO_ACCOUNT_SID || '',
  process.env.TWILIO_AUTH_TOKEN || '',
)

/** Get phone number for a supervisor User (employee number or userName as digits) */
function getSupervisorPhone(supervisor: { employee?: { number: string } | null; userName: string | null }): string | null {
  if (supervisor.employee?.number) {
    return normalizePhone(supervisor.employee.number)
  }
  if (supervisor.userName) {
    const digits = supervisor.userName.replace(/\D/g, '')
    if (digits.length === 10) return '1' + digits
    if (digits.length === 11 && digits.startsWith('1')) return digits
    return null
  }
  return null
}

export interface UnconfirmedNotification {
  appointmentId: number
  appointmentDate: string
  appointmentTime: string
  clientName: string
  employeeId: number
  employeeName: string
  employeeNumber: string
  supervisorId: number
  supervisorName: string | null
  phone: string
  twilioSid?: string
  error?: string
}

export interface EmployeeReminderNotification {
  appointmentId: number
  employeeId: number
  employeeName: string
  phone: string
  appointmentDate: string
  appointmentTime: string
  clientName: string
  twilioSid?: string
  error?: string
}

/** 7pm job: Check tomorrow's appointments for unconfirmed jobs and text supervisors only (do not text employees; employee reminders are sent by the noon job). Optional asOfDate for testing. */
export async function runUnconfirmedCheck(asOfDate?: Date): Promise<{
  sent: UnconfirmedNotification[]
  skipped: UnconfirmedNotification[]
  failed: UnconfirmedNotification[]
  employeeSent: EmployeeReminderNotification[]
  employeeSkipped: EmployeeReminderNotification[]
  employeeFailed: EmployeeReminderNotification[]
}> {
  const base = asOfDate ?? new Date()
  // Tomorrow = next calendar day in server local TZ; then query UTC midnight range to match stored dates (YYYY-MM-DD → UTC midnight)
  const tomorrowLocal = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1)
  const y = tomorrowLocal.getFullYear()
  const m = tomorrowLocal.getMonth()
  const d = tomorrowLocal.getDate()
  const tomorrowStart = new Date(Date.UTC(y, m, d, 0, 0, 0, 0))
  const tomorrowEnd = new Date(Date.UTC(y, m, d + 1, 0, 0, 0, 0))

  // Load appointments with payroll items and employees (employee view uses employees; we notify when unconfirmed)
  const appointments = await prisma.appointment.findMany({
    where: {
      date: { gte: tomorrowStart, lt: tomorrowEnd },
      status: { notIn: ['DELETED', 'CANCEL', 'RESCHEDULE_OLD'] },
    },
    include: {
      client: true,
      payrollItems: {
        include: {
          employee: {
            include: {
              supervisor: {
                include: { employee: true },
              },
            },
          },
        },
      },
      employees: {
        include: {
          supervisor: {
            include: { employee: true },
          },
        },
      },
    },
  })

  // Ensure every assigned employee has a payroll item (fixes "employees set but no payroll items" e.g. from lineage updates)
  for (const appt of appointments) {
    const payrollEmployeeIds = new Set((appt.payrollItems ?? []).map((pi) => pi.employeeId))
    for (const emp of appt.employees ?? []) {
      if (!payrollEmployeeIds.has(emp.id)) {
        await prisma.payrollItem.create({
          data: { appointmentId: appt.id, employeeId: emp.id },
        })
        payrollEmployeeIds.add(emp.id)
      }
    }
  }

  // Build list of (appt, employee, supervisor) for every unconfirmed employee: from payroll items with confirmed false, or employees who had no payroll item (we just created it)
  type UnconfirmedEntry = {
    appt: (typeof appointments)[0]
    emp: { id: number; name: string; number: string; supervisor: (typeof appointments)[0]['employees'][0]['supervisor'] | null }
    supervisor: (typeof appointments)[0]['employees'][0]['supervisor'] | null
  }
  const unconfirmedEntries: UnconfirmedEntry[] = []
  for (const appt of appointments) {
    const payrollByEmployeeId = new Map((appt.payrollItems ?? []).map((pi) => [pi.employeeId, pi]))
    // From payroll: unconfirmed items (skip disabled employees – they get no notifications)
    for (const pi of appt.payrollItems ?? []) {
      if (pi.confirmed === false && pi.employee && !(pi.employee as { disabled?: boolean }).disabled) {
        unconfirmedEntries.push({
          appt,
          emp: pi.employee,
          supervisor: pi.employee.supervisor ?? null,
        })
      }
    }
    // From employees: those with no payroll item (we created one above) — use appt.employees for supervisor; skip disabled
    for (const emp of appt.employees ?? []) {
      if (!payrollByEmployeeId.has(emp.id) && !(emp as { disabled?: boolean }).disabled) {
        unconfirmedEntries.push({
          appt,
          emp: { id: emp.id, name: emp.name, number: emp.number, supervisor: emp.supervisor ?? null },
          supervisor: emp.supervisor ?? null,
        })
      }
    }
  }

  const sent: UnconfirmedNotification[] = []
  const skipped: UnconfirmedNotification[] = []
  const failed: UnconfirmedNotification[] = []
  const employeeSent: EmployeeReminderNotification[] = []
  const employeeSkipped: EmployeeReminderNotification[] = []
  const employeeFailed: EmployeeReminderNotification[] = []
  const fromNumber = process.env.TWILIO_FROM_NUMBER

  for (const { appt, emp, supervisor } of unconfirmedEntries) {
    // Use UTC so the calendar day is correct (appointments are stored as UTC midnight for YYYY-MM-DD)
    const dateStr = new Date(appt.date).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    })
    const clientName = appt.client?.name ?? 'Unknown client'

    if (!supervisor) {
      skipped.push({
        appointmentId: appt.id,
        appointmentDate: dateStr,
        appointmentTime: appt.time,
        clientName,
        employeeId: emp.id,
        employeeName: emp.name,
        employeeNumber: emp.number,
        supervisorId: 0,
        supervisorName: null,
        phone: '',
        error: 'No supervisor assigned',
      })
      continue
    }

    const phoneNorm = getSupervisorPhone(supervisor)
    if (!phoneNorm) {
      skipped.push({
        appointmentId: appt.id,
        appointmentDate: dateStr,
        appointmentTime: appt.time,
        clientName,
        employeeId: emp.id,
        employeeName: emp.name,
        employeeNumber: emp.number,
        supervisorId: supervisor.id,
        supervisorName: supervisor.name ?? supervisor.userName,
        phone: '',
        error: 'Supervisor has no phone number',
      })
      continue
    }

    const phone = '+' + phoneNorm
    const body = [
      `Evidence Cleaning: Unconfirmed job for tomorrow.`,
      `Employee: ${emp.name} (${emp.number})`,
      `Appointment: ${dateStr} at ${appt.time}`,
      `Client: ${clientName}`,
      `Please follow up with the employee to confirm.`,
    ].join('\n')

    if (!fromNumber) {
      failed.push({
        appointmentId: appt.id,
        appointmentDate: dateStr,
        appointmentTime: appt.time,
        clientName,
        employeeId: emp.id,
        employeeName: emp.name,
        employeeNumber: emp.number,
        supervisorId: supervisor.id,
        supervisorName: supervisor.name ?? supervisor.userName,
        phone,
        error: 'TWILIO_FROM_NUMBER not configured',
      })
      continue
    }

    try {
      const result = await smsClient.messages.create({
        to: phone,
        from: fromNumber,
        body,
      })
      sent.push({
        appointmentId: appt.id,
        appointmentDate: dateStr,
        appointmentTime: appt.time,
        clientName,
        employeeId: emp.id,
        employeeName: emp.name,
        employeeNumber: emp.number,
        supervisorId: supervisor.id,
        supervisorName: supervisor.name ?? supervisor.userName,
        phone,
        twilioSid: result.sid,
      })
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      failed.push({
        appointmentId: appt.id,
        appointmentDate: dateStr,
        appointmentTime: appt.time,
        clientName,
        employeeId: emp.id,
        employeeName: emp.name,
        employeeNumber: emp.number,
        supervisorId: supervisor.id,
        supervisorName: supervisor.name ?? supervisor.userName,
        phone,
        error: errorMessage,
      })
    }
  }

  // 7pm job: supervisor notifications only. Employee reminders for 14-day window are sent by the noon job (runNoonEmployeeReminders).
  return { sent, skipped, failed, employeeSent: [], employeeSkipped: [], employeeFailed: [] }
}

/** 14-day window (today through today+14) in UTC for employee reminders */
function getEmployeeReminderDateRange(asOf: Date): { start: Date; end: Date } {
  const y = asOf.getFullYear()
  const m = asOf.getMonth()
  const d = asOf.getDate()
  const start = new Date(Date.UTC(y, m, d, 0, 0, 0, 0))
  const endLocal = new Date(y, m, d + 15)
  const end = new Date(
    Date.UTC(endLocal.getFullYear(), endLocal.getMonth(), endLocal.getDate(), 0, 0, 0, 0)
  )
  return { start, end }
}

const DASHBOARD_URL = 'https://dashboard.worldwideevidence.com/'

function buildEmployeeReminderBody(dateStr: string, time: string, clientName: string, address: string): string {
  return [
    `Evidence Cleaning: You have an unconfirmed job coming up.`,
    `${dateStr} at ${time} – ${clientName}`,
    `Address: ${address}`,
    `Please confirm in the app so we know you're coming. Unconfirm jobs may be given to someone else after 24 hours.`,
    `Dashboard: ${DASHBOARD_URL}`,
  ].join('\n')
}

/**
 * Send employee reminder SMS for unconfirmed jobs when team is set (e.g. PUT /appointments/:id).
 * Only sends for appointments within the next 14 days and only if reminderSentAt is null.
 */
export async function sendEmployeeRemindersForAppointmentIds(appointmentIds: number[]): Promise<void> {
  if (appointmentIds.length === 0) return
  const fromNumber = process.env.TWILIO_FROM_NUMBER
  if (!fromNumber) return
  const asOf = new Date()
  const { start, end } = getEmployeeReminderDateRange(asOf)
  const items = (await prisma.payrollItem.findMany({
    where: {
      appointmentId: { in: appointmentIds },
      confirmed: false,
      reminderSentAt: null,
      employee: { disabled: false },
    } as Prisma.PayrollItemWhereInput,
    include: {
      employee: true,
      appointment: {
        include: { client: true },
      },
    },
  })) as PayrollItemWithAppointmentAndEmployee[]
  const dateStrOpts = { weekday: 'long' as const, month: 'short' as const, day: 'numeric' as const, timeZone: 'UTC' as const }
  for (const pi of items) {
    const appt = pi.appointment
    const apptDate = new Date(appt.date)
    if (apptDate < start || apptDate >= end) continue
    const emp = pi.employee
    const clientName = appt.client?.name ?? 'Unknown client'
    const dateStr = apptDate.toLocaleDateString('en-US', dateStrOpts)
    const phoneNorm = emp?.number ? normalizePhone(emp.number) : null
    if (!phoneNorm) continue
    const phone = '+' + phoneNorm
    const body = buildEmployeeReminderBody(dateStr, appt.time, clientName, appt.address)
    try {
      await smsClient.messages.create({
        to: phone,
        from: fromNumber,
        body,
      })
      await prisma.payrollItem.update({
        where: { id: pi.id },
        data: { reminderSentAt: new Date() } as Prisma.PayrollItemUpdateInput,
      })
      if (process.env.NODE_ENV !== 'test') {
        console.log('[UnconfirmedCheck] Employee reminder SMS sent (on assign):', {
          to: phone,
          employeeName: emp.name,
          appointmentDate: dateStr,
          appointmentTime: appt.time,
          clientName,
          body,
        })
      }
    } catch (_err) {
      // Log but don't fail the request; 7pm job will retry
      if (process.env.NODE_ENV !== 'test') {
        console.error('[UnconfirmedCheck] Failed to send employee reminder:', emp.name, phone, _err)
      }
    }
  }
}

/**
 * Noon employee reminder: send SMS only for the single day that just entered the 14-day window
 * (today + 14 days). Other days in the window already got their message when the job was booked.
 * E.g. on Feb 22 at noon we only send for appointments on Mar 8, not for Feb 22–Mar 7.
 * Optional employeeId: only send to that employee (for testing).
 */
export async function runNoonEmployeeReminders(
  asOf?: Date,
  options?: { employeeId?: number }
): Promise<{ sent: EmployeeReminderNotification[]; skipped: EmployeeReminderNotification[]; failed: EmployeeReminderNotification[] }> {
  const base = asOf ?? new Date()
  const y = base.getFullYear()
  const m = base.getMonth()
  const d = base.getDate()
  const newDayLocal = new Date(y, m, d + 14)
  const newDayStart = new Date(
    Date.UTC(newDayLocal.getFullYear(), newDayLocal.getMonth(), newDayLocal.getDate(), 0, 0, 0, 0)
  )
  const newDayEnd = new Date(
    Date.UTC(newDayLocal.getFullYear(), newDayLocal.getMonth(), newDayLocal.getDate() + 1, 0, 0, 0, 0)
  )
  const sent: EmployeeReminderNotification[] = []
  const skipped: EmployeeReminderNotification[] = []
  const failed: EmployeeReminderNotification[] = []
  const fromNumber = process.env.TWILIO_FROM_NUMBER
  const dateStrOpts = { weekday: 'long' as const, month: 'short' as const, day: 'numeric' as const, timeZone: 'UTC' as const }

  const items = (await prisma.payrollItem.findMany({
    where: {
      confirmed: false,
      reminderSentAt: null,
      employee: { disabled: false },
      ...(options?.employeeId != null ? { employeeId: options.employeeId } : {}),
      appointment: {
        date: { gte: newDayStart, lt: newDayEnd },
        status: { notIn: ['DELETED', 'CANCEL', 'RESCHEDULE_OLD'] },
      },
    } as Prisma.PayrollItemWhereInput,
    include: {
      employee: true,
      appointment: {
        include: { client: true },
      },
    },
  })) as PayrollItemWithAppointmentAndEmployee[]

  for (const pi of items) {
    const appt = pi.appointment
    const emp = pi.employee
    const clientName = appt.client?.name ?? 'Unknown client'
    const dateStr = new Date(appt.date).toLocaleDateString('en-US', dateStrOpts)
    const phoneNorm = emp?.number ? normalizePhone(emp.number) : null
    if (!phoneNorm) {
      skipped.push({
        appointmentId: appt.id,
        employeeId: emp.id,
        employeeName: emp.name,
        phone: '',
        appointmentDate: dateStr,
        appointmentTime: appt.time,
        clientName,
        error: 'Employee has no phone number',
      })
      continue
    }
    const phone = '+' + phoneNorm
    const body = buildEmployeeReminderBody(dateStr, appt.time, clientName, appt.address)
    if (!fromNumber) {
      failed.push({
        appointmentId: appt.id,
        employeeId: emp.id,
        employeeName: emp.name,
        phone,
        appointmentDate: dateStr,
        appointmentTime: appt.time,
        clientName,
        error: 'TWILIO_FROM_NUMBER not configured',
      })
      continue
    }
    try {
      const result = await smsClient.messages.create({
        to: phone,
        from: fromNumber,
        body,
      })
      await prisma.payrollItem.update({
        where: { id: pi.id },
        data: { reminderSentAt: new Date() } as Prisma.PayrollItemUpdateInput,
      })
      sent.push({
        appointmentId: appt.id,
        employeeId: emp.id,
        employeeName: emp.name,
        phone,
        appointmentDate: dateStr,
        appointmentTime: appt.time,
        clientName,
        twilioSid: result.sid,
      })
      if (process.env.NODE_ENV !== 'test') {
        console.log('[UnconfirmedCheck] Noon employee reminder SMS sent:', {
          to: phone,
          employeeName: emp.name,
          appointmentDate: dateStr,
          appointmentTime: appt.time,
          clientName,
          body,
        })
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      failed.push({
        appointmentId: appt.id,
        employeeId: emp.id,
        employeeName: emp.name,
        phone,
        appointmentDate: dateStr,
        appointmentTime: appt.time,
        clientName,
        error: errorMessage,
      })
    }
  }

  return { sent, skipped, failed }
}

/** Cron: run daily at 12:00 (noon) – 14-day window starts "today", so appointments that just entered the window get the reminder */
export function setupNoonEmployeeReminderJob(): void {
  cron.schedule('0 12 * * *', async () => {
    try {
      const result = await runNoonEmployeeReminders()
      if (process.env.NODE_ENV !== 'test') {
        console.log(
          `Noon employee reminder: sent=${result.sent.length} skipped=${result.skipped.length} failed=${result.failed.length}`
        )
      }
    } catch (error) {
      console.error('Noon employee reminder job failed:', error)
    }
  })
  if (process.env.NODE_ENV !== 'test') {
    console.log('Noon employee reminder cron job scheduled to run daily at 12:00')
  }
}

/** Cron: run daily at 7:00 PM */
export function setupUnconfirmedCheckJob(): void {
  cron.schedule('0 19 * * *', async () => {
    try {
      const result = await runUnconfirmedCheck()
      console.log(
        `Unconfirmed check (7pm): sent=${result.sent.length} skipped=${result.skipped.length} failed=${result.failed.length}`
      )
    } catch (error) {
      console.error('Unconfirmed check job failed:', error)
    }
  })
  console.log('Unconfirmed check cron job scheduled to run daily at 7:00 PM')
}

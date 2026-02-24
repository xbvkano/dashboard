import cron from 'node-cron'
import { PrismaClient } from '@prisma/client'
import twilio from 'twilio'
import { normalizePhone } from '../utils/phoneUtils'
import { getNextOrThisUpdateDay } from '../utils/schedulePolicyUtils'

const prisma = new PrismaClient()
const smsClient = twilio(
  process.env.TWILIO_ACCOUNT_SID || '',
  process.env.TWILIO_AUTH_TOKEN || '',
)

const DAY_MS = 1000 * 60 * 60 * 24

function getSupervisorPhone(supervisor: { employee?: { number: string } | null; userName: string | null }): string | null {
  if (supervisor.employee?.number) return normalizePhone(supervisor.employee.number)
  if (supervisor.userName) {
    const digits = supervisor.userName.replace(/\D/g, '')
    if (digits.length === 10) return '1' + digits
    if (digits.length === 11 && digits.startsWith('1')) return digits
  }
  return null
}

/**
 * Send schedule reminders using each employee's stored nextScheduleUpdateDueAt.
 * We remind the employee every day from day 1 through stopRemindingAfterDays after that date;
 * from supervisorNotifyAfterDays we also notify the supervisor.
 * If nextScheduleUpdateDueAt is null, we set it to the next policy day (on or after today) and then continue.
 */
export async function sendScheduleReminders(): Promise<void> {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayTime = today.getTime()

    let policy = await prisma.schedulePolicy.findUnique({ where: { id: 1 } })
    if (!policy) {
      policy = await prisma.schedulePolicy.create({
        data: {
          id: 1,
          updateDayOfWeek: 0,
          supervisorNotifyAfterDays: 4,
          stopRemindingAfterDays: 7,
        },
      })
    }

    const schedules = await prisma.schedule.findMany({
      where: { employee: { disabled: false } },
      include: {
        employee: {
          include: {
            supervisor: { include: { employee: true } },
          },
        },
      },
    })

    const fromNumber = process.env.TWILIO_FROM_NUMBER || ''
    if (!fromNumber) {
      if (process.env.NODE_ENV !== 'test') {
        console.warn('TWILIO_FROM_NUMBER not set; schedule reminders skipped')
      }
      return
    }

    for (const schedule of schedules) {
      let dueDate = schedule.nextScheduleUpdateDueAt ? new Date(schedule.nextScheduleUpdateDueAt) : null
      if (dueDate) dueDate.setHours(0, 0, 0, 0)

      if (dueDate == null) {
        dueDate = getNextOrThisUpdateDay(today, policy.updateDayOfWeek)
        await prisma.schedule.update({
          where: { id: schedule.id },
          data: { nextScheduleUpdateDueAt: dueDate },
        })
      }

      const dueTime = dueDate.getTime()
      if (todayTime <= dueTime) continue

      const daysPastDue = Math.floor((todayTime - dueTime) / DAY_MS)
      if (daysPastDue < 1 || daysPastDue > policy.stopRemindingAfterDays) continue

      const employee = schedule.employee
      if (!employee) continue

      const lastUpdate = schedule.employeeUpdate ? new Date(schedule.employeeUpdate) : null

      // Remind employee every day from day 1 through stop day
      if (employee.number) {
        const phone = employee.number.startsWith('+') ? employee.number : `+${normalizePhone(employee.number)}`
        const message = `Hi ${employee.name}, this is a reminder from Evidence Cleaning. Please update your schedule in the app by your required day. Thank you!`
        try {
          await smsClient.messages.create({ to: phone, from: fromNumber, body: message })
          if (process.env.NODE_ENV !== 'test') {
            console.log(`[ScheduleReminder] Employee reminder sent to ${employee.name} (${employee.id})`)
          }
        } catch (err) {
          console.error(`[ScheduleReminder] Failed to send to employee ${employee.id}:`, err)
        }
      }

      // From supervisorNotifyAfterDays onward, also notify supervisor
      if (daysPastDue >= policy.supervisorNotifyAfterDays) {
        const supervisor = employee.supervisor
        if (supervisor) {
          const phoneNorm = getSupervisorPhone(supervisor)
          if (phoneNorm) {
            const phone = '+' + phoneNorm
            const message = `Evidence Cleaning: ${employee.name} has not updated their schedule (${daysPastDue} days past due). Last update: ${lastUpdate ? lastUpdate.toLocaleDateString() : 'never'}. Please follow up.`
            try {
              await smsClient.messages.create({ to: phone, from: fromNumber, body: message })
              if (process.env.NODE_ENV !== 'test') {
                console.log(`[ScheduleReminder] Supervisor notified for employee ${employee.name} (${employee.id})`)
              }
            } catch (err) {
              console.error(`[ScheduleReminder] Failed to notify supervisor for employee ${employee.id}:`, err)
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Error sending schedule reminders:', error)
    throw error
  }
}

// Setup cron job to run daily at 9 AM
// COMMENTED OUT: Schedule reminder cron job disabled
export function setupScheduleReminderJob(): void {
  // Run daily at 09:00 (9 AM)
  // cron.schedule('0 9 * * *', async () => {
  //   console.log('Running daily schedule reminder job...')
  //   try {
  //     await sendScheduleReminders()
  //     console.log('Schedule reminder job completed successfully')
  //   } catch (error) {
  //     console.error('Schedule reminder job failed:', error)
  //   }
  // })
  
  // console.log('Schedule reminder cron job scheduled to run daily at 9 AM')
  console.log('Schedule reminder cron job is DISABLED')
}


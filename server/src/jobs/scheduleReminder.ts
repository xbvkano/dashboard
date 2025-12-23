import cron from 'node-cron'
import { PrismaClient } from '@prisma/client'
import twilio from 'twilio'

const prisma = new PrismaClient()
const smsClient = twilio(
  process.env.TWILIO_ACCOUNT_SID || '',
  process.env.TWILIO_AUTH_TOKEN || '',
)

// Send reminder to employees who haven't updated their schedule in more than 7 days
export async function sendScheduleReminders(): Promise<void> {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    // Get all schedules with employees
    const schedules = await prisma.schedule.findMany({
      include: { employee: true }
    })

    for (const schedule of schedules) {
      const lastUpdate = schedule.employeeUpdate ? new Date(schedule.employeeUpdate) : new Date()
      lastUpdate.setHours(0, 0, 0, 0)
      
      const daysSinceUpdate = Math.floor((today.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24))
      
      // Send reminder if it's been more than 7 days (starting on day 8)
      if (daysSinceUpdate >= 8) {
        const employee = schedule.employee
        if (employee && employee.number) {
          const phoneNumber = employee.number.startsWith('+') ? employee.number : `+${employee.number}`
          
          const message = `Hi ${employee.name}, this is a reminder from Evidence Cleaning. Please update your schedule in the app. It's been ${daysSinceUpdate} days since your last update. Thank you!`
          
          try {
            await smsClient.messages.create({
              to: phoneNumber,
              from: process.env.TWILIO_FROM_NUMBER || '',
              body: message,
            })
            console.log(`Sent schedule reminder to employee ${employee.id} (${employee.name}) at ${phoneNumber}`)
          } catch (smsError) {
            console.error(`Failed to send reminder to employee ${employee.id}:`, smsError)
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
export function setupScheduleReminderJob(): void {
  // Run daily at 09:00 (9 AM)
  cron.schedule('0 9 * * *', async () => {
    console.log('Running daily schedule reminder job...')
    try {
      await sendScheduleReminders()
      console.log('Schedule reminder job completed successfully')
    } catch (error) {
      console.error('Schedule reminder job failed:', error)
    }
  })
  
  console.log('Schedule reminder cron job scheduled to run daily at 9 AM')
}


import cron from 'node-cron'
import { PrismaClient } from '@prisma/client'
import twilio from 'twilio'
import { normalizePhone } from '../utils/phoneUtils'

const prisma = new PrismaClient()
const smsClient = twilio(
  process.env.TWILIO_ACCOUNT_SID || '',
  process.env.TWILIO_AUTH_TOKEN || '',
)

/**
 * Recurring / tomorrow appointment reminder: the only job that sends messages to clients.
 * Sends SMS to clients about their appointment tomorrow. No other job should message clients.
 */
export async function sendAppointmentReminders(): Promise<void> {
  try {
    // Calculate tomorrow's date (start of day)
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)
    
    // Calculate the start of the day after tomorrow (for date range query)
    const dayAfterTomorrow = new Date(tomorrow)
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1)
    
    // Get all appointments for tomorrow (both confirmed and unconfirmed recurring)
    const appointments = await prisma.appointment.findMany({
      where: {
        date: {
          gte: tomorrow,
          lt: dayAfterTomorrow,
        },
        status: {
          in: ['APPOINTED', 'RECURRING_UNCONFIRMED'],
        },
      },
      include: {
        client: true,
      },
    })

    const sentMessages: Array<{
      clientId: number
      clientName: string
      phoneNumber: string
      appointmentId: number
      appointmentDate: string
      appointmentTime: string
      twilioSid?: string
    }> = []

    const failedMessages: Array<{
      clientId: number
      clientName: string
      phoneNumber: string
      appointmentId: number
      error: string
    }> = []

    for (const appointment of appointments) {
      if (!appointment.client || !appointment.client.number) {
        continue
      }

      const client = appointment.client
      
      // Normalize phone number for Twilio (E.164 format: +1XXXXXXXXXX)
      const normalized = normalizePhone(client.number)
      if (!normalized) {
        failedMessages.push({
          clientId: client.id,
          clientName: client.name,
          phoneNumber: client.number,
          appointmentId: appointment.id!,
          error: `Invalid phone number format: ${client.number}`,
        })
        continue
      }
      
      // Format for Twilio: add + prefix (normalizePhone returns 11 digits starting with 1)
      // Type assertion to ensure phoneNumber is a string (normalizePhone check above guarantees it's not null)
      const phoneNumber: string = `+${normalized}`
      
      // Format the date for the message
      const appointmentDate = new Date(appointment.date)
      const dateStr = appointmentDate.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })
      
      // Build the reminder message
      const message = `Hi ${client.name}, this is a reminder from Evidence Cleaning. You have an appointment scheduled for tomorrow (${dateStr}) at ${appointment.time}. Please do not reply to this message. Thank you!`

      // Ensure TWILIO_FROM_NUMBER is set
      const fromNumber = process.env.TWILIO_FROM_NUMBER
      if (!fromNumber) {
        console.error('TWILIO_FROM_NUMBER environment variable is not set')
        failedMessages.push({
          clientId: client.id,
          clientName: client.name,
          phoneNumber: phoneNumber,
          appointmentId: appointment.id!,
          error: 'TWILIO_FROM_NUMBER not configured',
        })
        continue
      }

      try {
        const result = await smsClient.messages.create({
          to: phoneNumber,
          from: fromNumber,
          body: message,
        })
        
        sentMessages.push({
          clientId: client.id,
          clientName: client.name,
          phoneNumber: phoneNumber,
          appointmentId: appointment.id!,
          appointmentDate: appointmentDate.toISOString().slice(0, 10),
          appointmentTime: appointment.time,
          twilioSid: result.sid,
        })
      } catch (smsError: any) {
        const errorMessage = smsError?.message || smsError?.toString() || 'Unknown error'
        failedMessages.push({
          clientId: client.id,
          clientName: client.name,
          phoneNumber: phoneNumber,
          appointmentId: appointment.id!,
          error: errorMessage,
        })
        console.error(`✗ Failed to send reminder to client ${client.id} (${client.name}) at ${phoneNumber} for appointment ${appointment.id}:`, errorMessage)
      }
    }
  } catch (error) {
    console.error('Error sending appointment reminders:', error)
    throw error
  }
}

// Setup cron job to run daily at 8:30 AM
export function setupAppointmentReminderJob(): void {
  // Run daily at 08:30 (8:30 AM)
  cron.schedule('30 8 * * *', async () => {
    try {
      await sendAppointmentReminders()
    } catch (error) {
      console.error('Appointment reminder job failed:', error)
    }
  })
}

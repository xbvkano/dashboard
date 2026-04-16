import cron from 'node-cron'
import { PrismaClient } from '@prisma/client'
import twilio from 'twilio'
import { normalizePhone } from '../utils/phoneUtils'
import { isTwilioOutboundConfigured, twilioMessageCreateParams, TWILIO_OUTBOUND_NOT_CONFIGURED } from '../utils/twilioSms'
import {
  appointmentAnchorUtc,
  appointmentLocalDateKey,
  DEFAULT_APPOINTMENT_TIMEZONE,
  getTomorrowLocalDayRangeUtcFrom,
  legacyNaiveUtcMidnightRange,
} from '../utils/appointmentTimezone'

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
    const { start: tomorrowStart, endExclusive: dayAfterTomorrow } = getTomorrowLocalDayRangeUtcFrom(new Date())
    const tomorrowStr = appointmentLocalDateKey({ dateUtc: tomorrowStart, date: tomorrowStart })
    const legacyR = legacyNaiveUtcMidnightRange(tomorrowStr)

    // Get all appointments for tomorrow (both confirmed and unconfirmed recurring)
    const appointments = await prisma.appointment.findMany({
      where: {
        OR: [
          { dateUtc: { gte: tomorrowStart, lt: dayAfterTomorrow } },
          {
            AND: [
              { dateUtc: null },
              { date: { gte: legacyR.start, lt: legacyR.endExclusive } },
            ],
          },
        ],
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
      
      // E.164 from normalizePhone (Twilio `to` expects +...)
      const phoneNumber: string = normalized
      
      const anchor = appointmentAnchorUtc({
        dateUtc: appointment.dateUtc,
        date: appointment.date,
      })
      const dateStr = anchor.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: DEFAULT_APPOINTMENT_TIMEZONE,
      })
      
      // Build the reminder message
      const message = `Hi ${client.name}, this is a reminder from Evidence Cleaning. You have an appointment scheduled for tomorrow (${dateStr}) at ${appointment.time}. Please do not reply to this message. Thank you!`

      if (!isTwilioOutboundConfigured()) {
        console.error(TWILIO_OUTBOUND_NOT_CONFIGURED)
        failedMessages.push({
          clientId: client.id,
          clientName: client.name,
          phoneNumber: phoneNumber,
          appointmentId: appointment.id!,
          error: TWILIO_OUTBOUND_NOT_CONFIGURED,
        })
        continue
      }

      try {
        const result = await smsClient.messages.create(twilioMessageCreateParams(phoneNumber, message))

        sentMessages.push({
          clientId: client.id,
          clientName: client.name,
          phoneNumber: phoneNumber,
          appointmentId: appointment.id!,
          appointmentDate: appointmentLocalDateKey({
            dateUtc: appointment.dateUtc,
            date: appointment.date,
          }),
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

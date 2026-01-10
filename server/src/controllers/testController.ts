import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { movePastSchedulesForDate } from '../jobs/scheduleCleanup'
import { sendScheduleReminders } from '../jobs/scheduleReminder'
import { syncRecurringAppointments } from '../controllers/recurringController'
import { sendAppointmentReminders } from '../jobs/appointmentReminder'
import twilio from 'twilio'

const prisma = new PrismaClient()
const smsClient = twilio(
  process.env.TWILIO_ACCOUNT_SID || '',
  process.env.TWILIO_AUTH_TOKEN || '',
)

// Test endpoint to move past schedules for a specific employee and test date
export async function testMovePastSchedules(req: Request, res: Response) {
  try {
    const { employeeId, testDate } = req.body as {
      employeeId: number
      testDate: string // ISO date string
    }

    if (!employeeId) {
      return res.status(400).json({ error: 'employeeId is required' })
    }

    if (!testDate) {
      return res.status(400).json({ error: 'testDate is required (ISO format: YYYY-MM-DD)' })
    }

    // Verify employee exists
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { schedule: true }
    })

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' })
    }

    // Parse test date (YYYY-MM-DD format)
    const dateParts = testDate.split('-')
    if (dateParts.length !== 3) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' })
    }
    const testDateObj = new Date(
      parseInt(dateParts[0]),
      parseInt(dateParts[1]) - 1,
      parseInt(dateParts[2])
    )
    testDateObj.setHours(0, 0, 0, 0)
    if (isNaN(testDateObj.getTime())) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' })
    }

    // Get schedule before
    const scheduleBefore = employee.schedule
      ? {
          futureSchedule: [...employee.schedule.futureSchedule],
          pastSchedule: [...employee.schedule.pastSchedule]
        }
      : null

    // Run the move function with test date
    await movePastSchedulesForDate(testDateObj)

    // Get schedule after
    const scheduleAfter = await prisma.schedule.findUnique({
      where: { employeeId }
    })

    const result = {
      employeeId,
      testDate: testDateObj.toISOString().split('T')[0],
      before: scheduleBefore
        ? {
            futureCount: scheduleBefore.futureSchedule.length,
            pastCount: scheduleBefore.pastSchedule.length,
            futureSchedule: scheduleBefore.futureSchedule,
            pastSchedule: scheduleBefore.pastSchedule
          }
        : null,
      after: scheduleAfter
        ? {
            futureCount: scheduleAfter.futureSchedule.length,
            pastCount: scheduleAfter.pastSchedule.length,
            futureSchedule: scheduleAfter.futureSchedule,
            pastSchedule: scheduleAfter.pastSchedule
          }
        : null,
      moved: scheduleBefore && scheduleAfter
        ? {
            fromFuture: scheduleBefore.futureSchedule.length - scheduleAfter.futureSchedule.length,
            toPast: scheduleAfter.pastSchedule.length - scheduleBefore.pastSchedule.length
          }
        : null
    }

    res.json({
      success: true,
      message: 'Test completed successfully',
      result
    })
  } catch (e) {
    console.error('Error testing move past schedules:', e)
    res.status(500).json({ error: 'Failed to test move past schedules' })
  }
}

// Test endpoint for schedule reminders - uses same logic as cron job
export async function testScheduleReminder(req: Request, res: Response) {
  try {
    const employeeId = parseInt(req.params.employeeId, 10)
    const simulateDays = req.query.simulateDays ? parseInt(req.query.simulateDays as string, 10) : null

    if (isNaN(employeeId)) {
      return res.status(400).json({ error: 'Invalid employeeId' })
    }

    // Verify employee exists
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { schedule: true }
    })

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' })
    }

    if (!employee.schedule) {
      return res.status(404).json({ error: 'Schedule not found for this employee' })
    }

    // If simulateDays is provided, temporarily update the schedule's employeeUpdate for testing
    let testDate: Date | null = null
    if (simulateDays !== null && !isNaN(simulateDays)) {
      testDate = new Date()
      testDate.setDate(testDate.getDate() - simulateDays)
      testDate.setHours(0, 0, 0, 0)
      
      // Temporarily update the schedule for this test
      await prisma.schedule.update({
        where: { employeeId },
        data: { employeeUpdate: testDate }
      })
    }

    // Use the same logic as the cron job
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const schedule = await prisma.schedule.findUnique({
      where: { employeeId }
    })
    
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' })
    }
    
    const lastUpdate = schedule.employeeUpdate ? new Date(schedule.employeeUpdate) : new Date()
    lastUpdate.setHours(0, 0, 0, 0)
    
    const daysSinceUpdate = Math.floor((today.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24))
    
    // Check if reminder should be sent (same logic as cron job: >= 8 days)
    if (daysSinceUpdate < 8) {
      return res.json({
        success: false,
        message: 'Reminder not sent - schedule updated less than 8 days ago',
        result: {
          employeeId,
          employeeName: employee.name,
          daysSinceUpdate,
          threshold: 8,
          lastUpdate: schedule.employeeUpdate
        }
      })
    }

    if (!employee.number) {
      return res.status(400).json({ error: 'Employee does not have a phone number' })
    }

    const phoneNumber = employee.number.startsWith('+') ? employee.number : `+${employee.number}`
    const message = `Hi ${employee.name}, this is a reminder from Evidence Cleaning. Please update your schedule in the app. It's been ${daysSinceUpdate} days since your last update. Thank you!`

    // Send SMS using same logic as cron job
    const result = await smsClient.messages.create({
      to: phoneNumber,
      from: process.env.TWILIO_FROM_NUMBER || '',
      body: message,
    })

    res.json({
      success: true,
      message: 'Reminder sent successfully',
      result: {
        employeeId,
        employeeName: employee.name,
        phoneNumber,
        daysSinceUpdate,
        message,
        twilioSid: result.sid,
        lastUpdate: schedule.employeeUpdate,
        simulated: simulateDays !== null
      }
    })
  } catch (e) {
    console.error('Error testing schedule reminder:', e)
    res.status(500).json({ error: 'Failed to test schedule reminder' })
  }
}

// Test endpoint to trigger schedule cleanup job
export async function testScheduleCleanup(req: Request, res: Response) {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    await movePastSchedulesForDate(today)
    
    res.json({
      success: true,
      message: 'Schedule cleanup job completed successfully',
      date: today.toISOString().slice(0, 10)
    })
  } catch (error) {
    console.error('Error testing schedule cleanup:', error)
    res.status(500).json({ error: 'Failed to test schedule cleanup' })
  }
}

// Test endpoint to trigger schedule reminder job
export async function testScheduleReminderJob(req: Request, res: Response) {
  try {
    await sendScheduleReminders()
    
    res.json({
      success: true,
      message: 'Schedule reminder job completed successfully'
    })
  } catch (error) {
    console.error('Error testing schedule reminder job:', error)
    res.status(500).json({ error: 'Failed to test schedule reminder job' })
  }
}

// Test endpoint to trigger recurring sync job
export async function testRecurringSync(req: Request, res: Response) {
  try {
    await syncRecurringAppointments()
    
    res.json({
      success: true,
      message: 'Recurring sync job completed successfully'
    })
  } catch (error) {
    console.error('Error testing recurring sync:', error)
    res.status(500).json({ error: 'Failed to test recurring sync' })
  }
}

// Test endpoint to trigger appointment reminder job
export async function testAppointmentReminder(req: Request, res: Response) {
  try {
    await sendAppointmentReminders()
    
    res.json({
      success: true,
      message: 'Appointment reminder job completed successfully'
    })
  } catch (error) {
    console.error('Error testing appointment reminder:', error)
    res.status(500).json({ error: 'Failed to test appointment reminder' })
  }
}


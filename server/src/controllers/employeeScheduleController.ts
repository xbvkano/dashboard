import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { calculatePayRate, calculateCarpetRate } from '../utils/appointmentUtils'

const prisma = new PrismaClient()

// Helper to get employee ID from request
async function getEmployeeId(req: Request): Promise<number | null> {
  // Try to get from header (set by frontend after login)
  const userId = req.headers['x-user-id'] as string
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId, 10) },
      include: { employee: true }
    })
    if (user?.employee) {
      return user.employee.id
    }
  }
  
  // Fallback: try to get from userName in header
  const userName = req.headers['x-user-name'] as string
  if (userName) {
    const user = await prisma.user.findUnique({
      where: { userName },
      include: { employee: true }
    })
    if (user?.employee) {
      return user.employee.id
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

export async function getSchedule(req: Request, res: Response) {
  try {
    const employeeId = await getEmployeeId(req)
    if (!employeeId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    let schedule = await prisma.schedule.findUnique({
      where: { employeeId }
    })

    if (!schedule) {
      // Create empty schedule if it doesn't exist
      schedule = await prisma.schedule.create({
        data: {
          employeeId,
          futureSchedule: [],
          pastSchedule: [],
          employeeUpdate: new Date()
        }
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
      employeeUpdate: schedule.employeeUpdate
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
    const employeeId = await getEmployeeId(req)
    if (!employeeId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

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

    if (schedule) {
      schedule = await prisma.schedule.update({
        where: { employeeId },
        data: {
          futureSchedule: newFuture,
          pastSchedule: newPast,
          employeeUpdate: new Date()
        }
      })
    } else {
      schedule = await prisma.schedule.create({
        data: {
          employeeId,
          futureSchedule: newFuture,
          pastSchedule: newPast,
          employeeUpdate: new Date()
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
    const employeeId = await getEmployeeId(req)
    if (!employeeId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

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

    if (schedule) {
      schedule = await prisma.schedule.update({
        where: { employeeId },
        data: {
          futureSchedule: newFuture,
          pastSchedule: newPast,
          employeeUpdate: new Date()
        }
      })
    } else {
      schedule = await prisma.schedule.create({
        data: {
          employeeId,
          futureSchedule: newFuture,
          pastSchedule: newPast,
          employeeUpdate: new Date()
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
    const employeeId = await getEmployeeId(req)
    if (!employeeId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const endOfDay14 = new Date(startOfToday)
    endOfDay14.setDate(endOfDay14.getDate() + 15)
    endOfDay14.setHours(0, 0, 0, 0)

    const appointments = await prisma.appointment.findMany({
      where: {
        employees: { some: { id: employeeId } },
        date: { gte: startOfToday, lt: endOfDay14 },
        status: { notIn: ['RESCHEDULE_OLD', 'DELETED', 'CANCEL'] },
      },
      include: {
        template: true,
        // Only load this employee's payroll item so we get their specific pay amount
        payrollItems: {
          where: { employeeId },
          include: { extras: true },
        },
        employees: true,
      },
      orderBy: [{ date: 'asc' }, { time: 'asc' }],
    })

    const result = appointments.map((a) => {
      const dateStr = a.date.toISOString().slice(0, 10)
      const count = a.employees?.length || 1
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
    const employeeId = await getEmployeeId(req)
    if (!employeeId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { appointmentId } = req.body as { appointmentId?: number }
    if (typeof appointmentId !== 'number' || !Number.isInteger(appointmentId)) {
      return res.status(400).json({ error: 'appointmentId required' })
    }

    const payrollItem = await prisma.payrollItem.findFirst({
      where: {
        appointmentId,
        employeeId,
      },
    })
    if (!payrollItem) {
      return res.status(404).json({ error: 'Job not found or not assigned to you' })
    }

    await prisma.payrollItem.update({
      where: { id: payrollItem.id },
      data: { confirmed: true },
    })

    res.json({ success: true, confirmed: true })
  } catch (e) {
    console.error('Error confirming job:', e)
    res.status(500).json({ error: 'Failed to confirm job' })
  }
}



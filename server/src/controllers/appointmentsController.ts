import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { parseSqft, calculatePayRate, calculateCarpetRate } from '../utils/appointmentUtils'
import { jsonToRule, calculateNextAppointmentDate } from '../utils/recurrenceUtils'
import twilio from 'twilio'

const prisma = new PrismaClient()
const smsClient = twilio(
  process.env.TWILIO_ACCOUNT_SID || '',
  process.env.TWILIO_AUTH_TOKEN || '',
)

/**
 * Parse date string (YYYY-MM-DD) as UTC midnight
 * This ensures consistent storage and queries across all timezones
 */
function parseDateStringUTC(dateStr: string): Date {
  const dateParts = dateStr.split('-')
  if (dateParts.length !== 3) {
    throw new Error('Invalid date format. Use YYYY-MM-DD')
  }
  // Create UTC date at midnight
  const date = new Date(Date.UTC(
    parseInt(dateParts[0]),
    parseInt(dateParts[1]) - 1, // Month is 0-indexed
    parseInt(dateParts[2])
  ))
  if (isNaN(date.getTime())) {
    throw new Error('Invalid date')
  }
  return date
}

export async function syncPayrollItems(apptId: number, employeeIds: number[]) {
  const existing = await prisma.payrollItem.findMany({ where: { appointmentId: apptId } })
  const existingIds = existing.map((p: { employeeId: number }) => p.employeeId)
  const toAdd = employeeIds.filter((id) => !existingIds.includes(id))
  const toRemove = existing.filter((p: { employeeId: number }) => !employeeIds.includes(p.employeeId))
  if (toAdd.length) {
    await prisma.payrollItem.createMany({ data: toAdd.map((id: number) => ({ appointmentId: apptId, employeeId: id })) })
  }
  if (toRemove.length) {
    await prisma.payrollItem.deleteMany({ where: { id: { in: toRemove.map((p: { id: number }) => p.id) } } })
  }
}

export async function getAppointments(req: Request, res: Response) {
  const dateStr = String(req.query.date || '')
  if (!dateStr) return res.status(400).json({ error: 'date required' })
  
  // Parse date string (YYYY-MM-DD) as UTC midnight
  let date: Date
  try {
    date = parseDateStringUTC(dateStr)
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Invalid date format. Use YYYY-MM-DD' })
  }
  // Next day in UTC
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1))
  try {
    const appts = await prisma.appointment.findMany({
      where: {
        date: { gte: date, lt: next },
        status: { notIn: ['DELETED', 'RESCHEDULE_OLD'] },
      },
      orderBy: { time: 'asc' },
      include: {
        client: true,
        employees: true,
        admin: true,
        payrollItems: { include: { extras: true } },
        family: true,
      },
    })
    res.json(appts)
  } catch (e) {
    console.error('Error fetching appointments:', e)
    res.status(500).json({ error: 'Failed to fetch appointments' })
  }
}

export async function getAppointmentsByLineage(req: Request, res: Response) {
  const { lineage } = req.params
  try {
    const appts = await prisma.appointment.findMany({
      where: { lineage },
      orderBy: { date: 'asc' },
      include: {
        client: true,
        employees: true,
        admin: true,
        payrollItems: { include: { extras: true } },
        family: true,
      },
    })
    res.json(appts)
  } catch {
    res.status(500).json({ error: 'Failed to fetch lineage appointments' })
  }
}

export async function getNoTeamAppointments(_req: Request, res: Response) {
  try {
    const appts = await prisma.appointment.findMany({
      where: {
        noTeam: true,
        status: { notIn: ['DELETED', 'RESCHEDULE_OLD', 'CANCEL'] },
      },
      orderBy: [{ date: 'asc' }, { time: 'asc' }],
      include: {
        client: true,
        employees: true,
        admin: true,
        payrollItems: { include: { extras: true } },
        family: true,
      },
    })
    res.json(appts)
  } catch (err) {
    console.error('Failed to fetch no-team appointments:', err)
    res.status(500).json({ error: 'Failed to fetch appointments' })
  }
}

// Legacy recurring endpoints - DEPRECATED
// Use /recurring/* endpoints instead
export async function getUpcomingRecurringAppointments(_req: Request, res: Response) {
  res.status(410).json({ 
    error: 'This endpoint is deprecated. Use GET /recurring/active instead.',
    migration: 'The recurring appointments system has been refactored. Please use the new RecurrenceFamily-based API.'
  })
}

export async function updateRecurringDone(req: Request, res: Response) {
  res.status(410).json({ 
    error: 'This endpoint is deprecated. Recurring appointments now use the RecurrenceFamily system.',
    migration: 'Use the Recurring Appointments page to manage recurring appointments.'
  })
}

export async function createRecurringAppointment(req: Request, res: Response) {
  res.status(410).json({ 
    error: 'This endpoint is deprecated. Use POST /recurring instead.',
    migration: 'Please use the new RecurrenceFamily API to create recurring appointments.'
  })
}

export async function createAppointment(req: Request, res: Response) {
  try {
    const {
      clientId,
      templateId,
      date,
      time,
      hours,
      employeeIds = [],
      adminId,
      paid = false,
      paymentMethod = 'CASH',
      paymentMethodNote,
      tip = 0,
      carpetRooms,
      carpetPrice,
      carpetEmployees = [],
      status = 'APPOINTED',
      observation,
      noTeam = false,
    } = req.body as {
      clientId?: number
      templateId?: number
      date?: string
      time?: string
      hours?: number
      employeeIds?: number[]
      adminId?: number
      paid?: boolean
      paymentMethod?: string
      paymentMethodNote?: string
      tip?: number
      carpetRooms?: number
      carpetPrice?: number
      carpetEmployees?: number[]
      status?: string
      observation?: string
      noTeam?: boolean
    }

    // required-field guard
    if (!clientId || !templateId || !date || !time || !adminId) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    const template = await prisma.appointmentTemplate.findUnique({
      where: { id: templateId },
    })
    if (!template) {
      return res.status(400).json({ error: 'Invalid templateId' })
    }

    const carpetRoomsFinal =
      carpetRooms !== undefined ? carpetRooms : template.carpetRooms ?? null
    let finalCarpetPrice = carpetPrice
    if (finalCarpetPrice === undefined) {
      if (template.carpetPrice != null && carpetRoomsFinal) {
        finalCarpetPrice = template.carpetPrice
      } else if (carpetRoomsFinal && template.size) {
        const sqft = parseSqft(template.size)
        if (sqft !== null) {
          finalCarpetPrice = carpetRoomsFinal * (sqft >= 4000 ? 40 : 35)
        }
      }
    }

    console.log('[createAppointment] Creating appointment with templateId:', {
      templateId,
      templateName: template.templateName,
      clientId,
      date,
      time,
    })
    
    const appt = await prisma.appointment.create({
      data: {
        clientId,              // scalar shortcut instead of nested connect
        adminId,               // same here
        templateId,            // Save templateId to database
        date: new Date(date),
        time,
        type: template.type,
        address: template.address,
        cityStateZip: template.instructions ?? undefined,
        size: template.size,
        hours: hours ?? null,
        price: template.price,
        paid,
        tip,
        noTeam,
        carpetRooms: carpetRoomsFinal,
        carpetPrice: finalCarpetPrice ?? null,
        carpetEmployees,
        paymentMethod: paymentMethod as any, // or cast to your enum
        notes:
          [template.notes, paymentMethodNote].filter(Boolean).join(' | ') ||
          undefined,
        observation: observation ?? undefined,
        status: status as any,
        lineage: 'single',
        // only include the relation if there are IDs
        ...(employeeIds.length > 0 && {
          employees: {
            connect: employeeIds.map((id) => ({ id })),
          },
        }),
      },
      include: {
        client: true,
        employees: true,
        admin: true,
        payrollItems: { include: { extras: true } },
        family: true,
      },
    })

    if (!noTeam && employeeIds.length) {
      await syncPayrollItems(appt.id, employeeIds)
    }

    console.log('[createAppointment] Appointment created:', {
      appointmentId: appt.id,
      savedTemplateId: appt.templateId,
      expectedTemplateId: templateId,
      templateMatch: appt.templateId === templateId,
    })

    return res.json(appt)
  } catch (err) {
    console.error('Error creating appointment:', err)
    return res.status(500).json({ error: 'Failed to create appointment' })
  }
}

export async function updateAppointment(req: Request, res: Response) {
  const id = parseInt(req.params.id, 10)
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' })
  try {
    const {
      clientId,
      templateId,
      date,
      time,
      hours,
      employeeIds,
      adminId,
      paid,
      paymentMethod,
      paymentMethodNote,
      tip,
      status,
      observe,
      carpetRooms,
      carpetPrice,
      carpetEmployees,
      observation,
      notes,
      noTeam = false,
    } = req.body as {
      clientId?: number
      templateId?: number
      date?: string
      time?: string
      hours?: number
      employeeIds?: number[]
      adminId?: number
      paid?: boolean
      paymentMethod?: string
      paymentMethodNote?: string
      tip?: number
      status?: string
      observe?: boolean
      carpetRooms?: number
      carpetPrice?: number
      carpetEmployees?: number[]
      observation?: string | null
      notes?: string | null
      noTeam?: boolean
    }
    console.log('[updateAppointment] Updating appointment:', {
      appointmentId: id,
      receivedTemplateId: templateId,
      currentAppointmentId: id,
    })
    
    const data: any = {}
    if (clientId !== undefined) data.clientId = clientId
    if (templateId !== undefined) {
      const template = await prisma.appointmentTemplate.findUnique({
        where: { id: templateId },
      })
      if (!template) return res.status(400).json({ error: 'Invalid templateId' })
      
      console.log('[updateAppointment] Template found:', {
        templateId: template.id,
        templateName: template.templateName,
      })
      
      // Save templateId to database
      data.templateId = templateId
      data.type = template.type
      data.address = template.address
      data.cityStateZip = template.instructions ?? undefined
      data.size = template.size ?? undefined
      data.price = template.price
      data.notes = template.notes ?? data.notes
      if (carpetRooms === undefined && template.carpetRooms != null) {
        data.carpetRooms = template.carpetRooms
      }
      if (carpetPrice === undefined) {
        if (template.carpetPrice != null) {
          data.carpetPrice = template.carpetPrice
        } else if (
          (data.carpetRooms ?? template.carpetRooms) != null &&
          template.size
        ) {
          const cr = data.carpetRooms ?? template.carpetRooms
          const sqft = parseSqft(template.size)
          if (sqft !== null) {
            data.carpetPrice = cr * (sqft >= 4000 ? 40 : 35)
          }
        }
      }
    }
    if (date !== undefined) {
      try {
        data.date = parseDateStringUTC(date)
      } catch (err: any) {
        return res.status(400).json({ error: err.message || 'Invalid date format. Use YYYY-MM-DD' })
      }
    }
    if (time !== undefined) data.time = time
    if (hours !== undefined) data.hours = hours
    if (adminId !== undefined) data.adminId = adminId
    if (paid !== undefined) data.paid = paid
    if (paymentMethod !== undefined) data.paymentMethod = paymentMethod as any
    // Handle notes: if notes is explicitly provided, use it; otherwise use paymentMethodNote if provided
    if (notes !== undefined) data.notes = notes
    else if (paymentMethodNote !== undefined) data.notes = paymentMethodNote
    if (tip !== undefined) data.tip = tip
    if (noTeam !== undefined) data.noTeam = noTeam
    if (observation !== undefined) data.observation = observation
    if (status !== undefined) data.status = status as any
    if (observe !== undefined) data.observe = observe
    if (carpetRooms !== undefined) data.carpetRooms = carpetRooms
    if (carpetPrice !== undefined) data.carpetPrice = carpetPrice
    if (carpetEmployees !== undefined) data.carpetEmployees = carpetEmployees
    if (employeeIds) {
      data.employees = { set: employeeIds.map((id) => ({ id })) }
    }

    if (observe === false ||
        (status && ['CANCEL', 'RESCHEDULE_OLD', 'DELETED'].includes(status))) {
      data.observation = null
    }
    const future = req.query.future === 'true'
    const current = await prisma.appointment.findUnique({ where: { id }, include: { employees: true, client: true, admin: true, family: true } })
    if (!current) return res.status(404).json({ error: 'Not found' })
    
    // When rescheduling a confirmed recurring appointment, find the new rescheduled appointment
    // and update the family's nextAppointmentDate to reflect where it actually is now.
    // Keep the familyId so the appointment remains part of the family and viewable in calendar.
    if (status === 'RESCHEDULE_OLD' && current.familyId && current.status === 'APPOINTED' && current.family) {
      // Find the new rescheduled appointment (RESCHEDULE_NEW) that was just created
      // It should have the same clientId, address, and be created recently (within 5 minutes)
      // and not have a familyId yet (since it was just created)
      const rescheduledNewAppointment = await prisma.appointment.findFirst({
        where: {
          clientId: current.clientId,
          address: current.address,
          status: 'RESCHEDULE_NEW',
          familyId: null, // New appointment won't have familyId yet
          createdAt: {
            gte: new Date(Date.now() - 300000), // Created within last 5 minutes (more reliable)
          },
        },
        orderBy: { createdAt: 'desc' },
      })
      
      // Log the reschedule with family info
      // Use UTC date components to get the correct calendar day
      const oldDateUTC = new Date(current.date)
      const oldDateStr = `${oldDateUTC.getUTCFullYear()}-${String(oldDateUTC.getUTCMonth() + 1).padStart(2, '0')}-${String(oldDateUTC.getUTCDate()).padStart(2, '0')}`
      const oldTimeStr = current.time
      const todayUTC = new Date()
      const todayStr = `${todayUTC.getUTCFullYear()}-${String(todayUTC.getUTCMonth() + 1).padStart(2, '0')}-${String(todayUTC.getUTCDate()).padStart(2, '0')}`
      
      let rescheduleLog: string
      if (rescheduledNewAppointment) {
        // Get the new appointment's date in UTC for logging
        const newDateUTC = new Date(rescheduledNewAppointment.date)
        const newDateStr = `${newDateUTC.getUTCFullYear()}-${String(newDateUTC.getUTCMonth() + 1).padStart(2, '0')}-${String(newDateUTC.getUTCDate()).padStart(2, '0')}`
        const newTimeStr = rescheduledNewAppointment.time
        rescheduleLog = `[Rescheduled from recurrence family #${current.familyId}: ${oldDateStr} ${oldTimeStr} → ${newDateStr} ${newTimeStr} on ${todayStr}]`
      } else {
        rescheduleLog = `[Rescheduled from recurrence family #${current.familyId}: ${oldDateStr} ${oldTimeStr} (rescheduled) on ${todayStr}]`
      }
      
      // Add reschedule log to notes
      const existingNotes = current.notes || ''
      data.notes = existingNotes 
        ? `${existingNotes}\n${rescheduleLog}`
        : rescheduleLog
      
      if (rescheduledNewAppointment) {
        
        // Update the new appointment to have the same familyId
        await prisma.appointment.update({
          where: { id: rescheduledNewAppointment.id },
          data: { familyId: current.familyId },
        })
        
        // Update the family's nextAppointmentDate based on the new rescheduled appointment date
        const rule = jsonToRule(current.family.recurrenceRule)
        const nextDate = calculateNextAppointmentDate(rule, rescheduledNewAppointment.date)
        
        // Check for unconfirmed appointments to determine the actual next date
        const family = await prisma.recurrenceFamily.findUnique({
          where: { id: current.familyId },
          include: {
            appointments: {
              where: {
                status: 'RECURRING_UNCONFIRMED',
              },
              orderBy: { date: 'asc' },
            },
          },
        })
        
        // If there are unconfirmed appointments, use the earliest one
        // Otherwise, use the calculated next date from the rescheduled appointment
        const finalNextDate = family && family.appointments.length > 0
          ? (family.appointments[0].date < nextDate ? family.appointments[0].date : nextDate)
          : nextDate
        
        await prisma.recurrenceFamily.update({
          where: { id: current.familyId },
          data: { nextAppointmentDate: finalNextDate }
        })
      } else {
        // If we can't find the new appointment, recalculate from the last confirmed appointment
        const family = await prisma.recurrenceFamily.findUnique({
          where: { id: current.familyId },
          include: {
            appointments: {
              where: {
                status: { in: ['APPOINTED', 'RECURRING_UNCONFIRMED'] },
              },
              orderBy: { date: 'desc' },
            },
          },
        })
        
        if (family && family.appointments.length > 0) {
          const lastAppointment = family.appointments[0]
          const rule = jsonToRule(current.family.recurrenceRule)
          const nextDate = calculateNextAppointmentDate(rule, lastAppointment.date)
          await prisma.recurrenceFamily.update({
            where: { id: current.familyId },
            data: { nextAppointmentDate: nextDate }
          })
        }
      }
      
      // DO NOT clear familyId - keep the appointment in the family so:
      // 1. The family history is accurate (shows rescheduled appointments)
      // 2. The "view in calendar" functionality works correctly
      // 3. The appointment remains tracked in the recurrence family
    }

    // Legacy recurring conversion removed - use RecurrenceFamily system instead
    // If someone tries to set status to REOCCURRING, reject it
    if (data.status === 'REOCCURRING') {
      return res.status(400).json({ 
        error: 'REOCCURRING status is deprecated. Use the RecurrenceFamily system instead.',
        migration: 'Please use POST /recurring to create recurring appointments.'
      })
    }

    if (future && current.lineage !== 'single') {
      function toMinutes(t: string) {
        const [h, m] = t.split(':').map(Number)
        return h * 60 + m
      }
      function minutesToTime(m: number) {
        const hh = Math.floor(((m % 1440) + 1440) % 1440 / 60)
        const mm = Math.floor(((m % 1440) + 1440) % 1440 % 60)
        return `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`
      }

      const dateDiff = data.date ? new Date(data.date).getTime() - current.date.getTime() : 0
      const timeDiff = data.time ? toMinutes(data.time) - toMinutes(current.time) : 0
      const base: any = { ...data }
      delete base.date
      delete base.time

      const targets = await prisma.appointment.findMany({
        where: { lineage: current.lineage, date: { gte: current.date } },
        orderBy: { date: 'asc' },
        include: { employees: true },
      })

      for (const appt of targets) {
        const newDate = data.date ? new Date(appt.date.getTime() + dateDiff) : appt.date
        const newTime = data.time ? minutesToTime(toMinutes(appt.time) + timeDiff) : appt.time
        await prisma.appointment.update({
          where: { id: appt.id },
          data: { ...base, date: newDate, time: newTime },
        })
      }

      const appts = await prisma.appointment.findMany({
        where: { lineage: current.lineage, date: { gte: current.date } },
        include: {
        client: true,
        employees: true,
        admin: true,
        payrollItems: { include: { extras: true } },
        family: true,
      },
        orderBy: { date: 'asc' },
      })
      res.json(appts)
    } else {
      const appt = await prisma.appointment.update({
        where: { id },
        data,
        include: {
        client: true,
        employees: true,
        admin: true,
        payrollItems: { include: { extras: true } },
        family: true,
      },
      })
      
      console.log('[updateAppointment] Appointment updated:', {
        appointmentId: appt.id,
        savedTemplateId: appt.templateId,
        expectedTemplateId: templateId,
        templateMatch: appt.templateId === templateId,
        dataTemplateId: data.templateId,
      })
      
      if (appt.status === 'CANCEL' || appt.status === 'DELETED') {
        await prisma.payrollItem.deleteMany({ where: { appointmentId: appt.id } })
      } else if (employeeIds && !noTeam) {
        await syncPayrollItems(appt.id, employeeIds)
      }
      res.json(appt)
    }
  } catch (e) {
    console.error('Error updating appointment:', e)
    res.status(500).json({ error: 'Failed to update appointment' })
  }
}

export async function sendAppointmentInfo(req: Request, res: Response) {
  const id = parseInt(req.params.id, 10)
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' })
  try {
    const note = String((req.body as any).note || '')
    const appt = await prisma.appointment.findUnique({
      where: { id },
      include: {
        client: true,
        employees: true,
        admin: true,
        payrollItems: { include: { extras: true } },
        family: true,
      },
    })
    if (!appt) return res.status(404).json({ error: 'Not found' })

    // Check if appointment has a team assigned
    if (appt.noTeam || !appt.employees || appt.employees.length === 0) {
      return res.status(400).json({ 
        error: 'Cannot send info: No team assigned to this appointment. Please add at least one team member before sending info.' 
      })
    }

    const pay = calculatePayRate(appt.type, appt.size ?? null, appt.employees.length || 1)
    const carpetIds = appt.carpetEmployees || []
    const carpetPer =
      appt.carpetRooms && appt.size && carpetIds.length
        ? calculateCarpetRate(appt.size, appt.carpetRooms) / carpetIds.length
        : 0

    for (const e of appt.employees) {
      const extras =
        appt.payrollItems.find((p: any) => p.employeeId === e.id)?.extras || []
      const extrasTotal = extras.reduce(
        (sum: number, ex: any) => sum + ex.amount,
        0,
      )
      const total = pay + (carpetIds.includes(e.id) ? carpetPer : 0) + extrasTotal
      const body = [
        `New appointment from Evidence Cleaning!`,
        `Appointment Date: ${appt.date.toISOString().slice(0, 10)}`,
        `Appointment Time: ${appt.time}`,
        `Appointment Type: ${appt.type}`,
        `Address: ${appt.address}`,
        `Pay: $${total.toFixed(2)}`,
        appt.cityStateZip ? `Instructions: ${appt.cityStateZip}` : undefined,
        note && `Note: ${note}`,
        `\n Please do not respond to this message`,
      ]
        .filter(Boolean)
        .join('\n')

      await smsClient.messages.create({
        to: e.number.startsWith('+') ? e.number : `+${e.number}`,
        from: process.env.TWILIO_FROM_NUMBER || '',
        body,
      })
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: { infoSent: true },
      include: {
        client: true,
        employees: true,
        admin: true,
        payrollItems: { include: { extras: true } },
        family: true,
      },
    })

    res.json(updated)
  } catch (err) {
    console.error('Failed to send appointment info:', err)
    res.status(500).json({ error: 'Failed to send info' })
  }
}

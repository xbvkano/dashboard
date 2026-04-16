import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import {
  calculateNextAppointmentDate,
  parseLegacyFrequency,
  ruleToJson,
  jsonToRule,
  formatRecurrenceRule,
  type RecurrenceRule,
} from '../utils/recurrenceUtils'
import { parseSqft, calculatePayRate, calculateCarpetRate } from '../utils/appointmentUtils'
import {
  appointmentAnchorUtc,
  appointmentLocalDateKey,
  localDateStringToStartOfDayUtc,
  normalizeToBusinessDayAnchorUtc,
  utcInstantToLocalDateString,
} from '../utils/appointmentTimezone'

const prisma = new PrismaClient()

/**
 * Get all active recurrence families
 */
export async function getActiveRecurrenceFamilies(_req: Request, res: Response) {
  try {
    const todayStr = utcInstantToLocalDateString(new Date())

    const families = await prisma.recurrenceFamily.findMany({
      where: { status: 'active' },
      include: {
        appointments: {
          where: {
            status: { in: ['APPOINTED', 'RECURRING_UNCONFIRMED'] },
          },
          orderBy: [{ dateUtc: 'asc' }, { date: 'asc' }],
          include: {
            client: true,
            employees: true,
          },
        },
      },
      orderBy: { nextAppointmentDate: 'asc' },
    })

    // Check for passed unconfirmed appointments and move families to stopped
    for (const family of families) {
      const unconfirmedAppts = family.appointments.filter(
        (a) => a.status === 'RECURRING_UNCONFIRMED'
      )
      
      for (const appt of unconfirmedAppts) {
        const apptStr = appointmentLocalDateKey({
          dateUtc: appt.dateUtc,
          date: appt.date,
        })
        if (apptStr < todayStr) {
          // Missed unconfirmed appointment - stop the family
          await prisma.recurrenceFamily.update({
            where: { id: family.id },
            data: { status: 'stopped' },
          })
          break
        }
      }
    }
    
    // Re-fetch active families (excluding ones we just stopped)
    const activeFamilies = await prisma.recurrenceFamily.findMany({
      where: { status: 'active' },
      include: {
        appointments: {
          where: {
            status: { in: ['APPOINTED', 'RECURRING_UNCONFIRMED'] },
          },
          orderBy: [{ dateUtc: 'asc' }, { date: 'asc' }],
          include: {
            client: true,
            employees: true,
          },
        },
      },
      orderBy: { nextAppointmentDate: 'asc' },
    })

    const results = activeFamilies.map((family) => {
      const unconfirmed = family.appointments.filter(
        (a) => a.status === 'RECURRING_UNCONFIRMED'
      )
      const confirmed = family.appointments.filter((a) => a.status === 'APPOINTED')
      const rule = jsonToRule(family.recurrenceRule)

      return {
        ...family,
        ruleSummary: formatRecurrenceRule(rule),
        unconfirmedCount: unconfirmed.length,
        confirmedCount: confirmed.length,
        upcomingCount: unconfirmed.length + confirmed.length,
      }
    })

    res.json(results)
  } catch (err) {
    console.error('Failed to fetch active recurrence families:', err)
    res.status(500).json({ error: 'Failed to fetch recurrence families' })
  }
}

/**
 * Get all stopped recurrence families
 */
export async function getStoppedRecurrenceFamilies(_req: Request, res: Response) {
  try {
    const families = await prisma.recurrenceFamily.findMany({
      where: { status: 'stopped' },
      include: {
        appointments: {
          orderBy: { date: 'desc' },
          include: {
            client: true,
            employees: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })

    const results = families.map((family) => {
      const rule = jsonToRule(family.recurrenceRule)
      return {
        ...family,
        ruleSummary: formatRecurrenceRule(rule),
        totalAppointments: family.appointments.length,
      }
    })

    res.json(results)
  } catch (err) {
    console.error('Failed to fetch stopped recurrence families:', err)
    res.status(500).json({ error: 'Failed to fetch recurrence families' })
  }
}

/**
 * Get a single recurrence family with full history
 */
export async function getRecurrenceFamily(req: Request, res: Response) {
  const id = parseInt(req.params.id, 10)
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' })

  try {
    const family = await prisma.recurrenceFamily.findUnique({
      where: { id },
      include: {
        appointments: {
          orderBy: { date: 'desc' },
          include: {
            client: true,
            employees: true,
            admin: true,
            payrollItems: { include: { extras: true } },
          },
        },
      },
    })

    if (!family) return res.status(404).json({ error: 'Not found' })

    const rule = jsonToRule(family.recurrenceRule)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Get all appointments that are part of this family
    const familyAppointments = family.appointments

    // Also find appointments that were rescheduled from this family
    // They will have a reschedule log in their notes containing the familyId
    let rescheduledAppointments: any[] = []
    if (familyAppointments.length > 0) {
      rescheduledAppointments = await prisma.appointment.findMany({
        where: {
          clientId: familyAppointments[0].clientId, // Use first appointment's clientId
          status: 'RESCHEDULE_OLD',
          notes: {
            contains: `recurrence family #${id}`, // Look for reschedule log with this familyId
          },
        },
        orderBy: { date: 'desc' },
        include: {
          client: true,
          employees: true,
          admin: true,
          payrollItems: { include: { extras: true } },
        },
      })
    }

    // Combine family appointments and rescheduled appointments
    const allAppointments = [...familyAppointments, ...rescheduledAppointments]
    
    // Remove duplicates (in case an appointment somehow appears in both)
    const uniqueAppointments = Array.from(
      new Map(allAppointments.map(appt => [appt.id, appt])).values()
    )

    // Sort by date descending
    uniqueAppointments.sort((a, b) => b.date.getTime() - a.date.getTime())

    const history = uniqueAppointments.map((appt) => {
      const apptDate = new Date(appt.date)
      apptDate.setHours(0, 0, 0, 0)
      const isMissed =
        appt.status === 'RECURRING_UNCONFIRMED' && apptDate < today
      const isRescheduled = appt.status === 'RESCHEDULE_OLD' && 
        appt.notes?.includes(`recurrence family #${id}`)

      return {
        ...appt,
        isMissed,
        isRescheduled,
      }
    })

    // Try to find the template used for this family
    // Get the first appointment (oldest) which should have the template data
    const firstAppt = family.appointments.length > 0 
      ? family.appointments[family.appointments.length - 1] // Last in desc order = first created
      : null

    let templateInfo = null
    if (firstAppt) {
      // Try to find a matching template by client and appointment fields
      const matchingTemplate = await prisma.appointmentTemplate.findFirst({
        where: {
          clientId: firstAppt.clientId,
          type: firstAppt.type,
          address: firstAppt.address,
          size: firstAppt.size || '',
          price: firstAppt.price || 0,
        },
      })

      if (matchingTemplate) {
        templateInfo = {
          id: matchingTemplate.id,
          name: matchingTemplate.templateName,
          type: matchingTemplate.type,
          size: matchingTemplate.size,
          address: matchingTemplate.address,
          cityStateZip: matchingTemplate.cityStateZip,
          price: matchingTemplate.price,
          instructions: matchingTemplate.instructions,
          notes: matchingTemplate.notes,
          carpetRooms: matchingTemplate.carpetRooms,
          carpetPrice: matchingTemplate.carpetPrice,
        }
      } else {
        // If no exact match, show template-like info from first appointment
        templateInfo = {
          name: 'Template Data (from appointment)',
          type: firstAppt.type,
          size: firstAppt.size,
          address: firstAppt.address,
          cityStateZip: firstAppt.cityStateZip,
          price: firstAppt.price,
          notes: firstAppt.notes,
          carpetRooms: firstAppt.carpetRooms,
          carpetPrice: firstAppt.carpetPrice,
        }
      }
    }

    res.json({
      ...family,
      rule,
      ruleSummary: formatRecurrenceRule(rule),
      history,
      template: templateInfo,
    })
  } catch (err) {
    console.error('Failed to fetch recurrence family:', err)
    res.status(500).json({ error: 'Failed to fetch recurrence family' })
  }
}

/**
 * Create a new recurrence family
 */
export async function createRecurrenceFamily(req: Request, res: Response) {
  try {
    const {
      clientId,
      templateId,
      date,
      time,
      employeeIds = [],
      adminId,
      paid = false,
      paymentMethod = 'CASH',
      paymentMethodNote,
      tip = 0,
      carpetRooms,
      carpetPrice,
      carpetEmployees = [],
      noTeam = false,
      recurrenceRule,
    } = req.body as {
      clientId?: number
      templateId?: number
      date?: string
      time?: string
      employeeIds?: number[]
      adminId?: number
      paid?: boolean
      paymentMethod?: string
      paymentMethodNote?: string
      tip?: number
      carpetRooms?: number
      carpetPrice?: number
      carpetEmployees?: number[]
      noTeam?: boolean
      recurrenceRule?: RecurrenceRule
    }

    if (!clientId || !templateId || !date || !time || !adminId || !recurrenceRule) {
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

    let firstDate: Date
    try {
      firstDate = localDateStringToStartOfDayUtc(date)
    } catch {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' })
    }
    const nextDate = normalizeToBusinessDayAnchorUtc(
      calculateNextAppointmentDate(recurrenceRule, firstDate),
    )

    const todayStr = utcInstantToLocalDateString(new Date())
    const firstStr = utcInstantToLocalDateString(firstDate)
    const isPastDate = firstStr < todayStr

    // Calculate hours from template (same as normal appointments)
    const { calculateAppointmentHours } = await import('../utils/appointmentUtils')
    const calculatedHours = template.size 
      ? calculateAppointmentHours(template.size, template.type)
      : null

    // Create the family - set to stopped if date is in the past
    const family = await prisma.recurrenceFamily.create({
      data: {
        status: isPastDate ? 'stopped' : 'active',
        recurrenceRule: ruleToJson(recurrenceRule),
        nextAppointmentDate: firstDate, // First appointment is the unconfirmed one
        templateId: templateId, // Store the templateId for future reference
      },
    })

    // Create the first unconfirmed appointment (no confirmed one)
    const unconfirmedAppt = await prisma.appointment.create({
      data: {
        clientId,
        adminId,
        date: firstDate,
        dateUtc: firstDate,
        time,
        type: template.type,
        address: template.address,
        cityStateZip: template.instructions ?? undefined,
        size: template.size,
        hours: calculatedHours,
        price: template.price,
        paid: false,
        tip: 0,
        noTeam,
        carpetRooms: carpetRoomsFinal,
        carpetPrice: finalCarpetPrice ?? null,
        carpetEmployees: [],
        paymentMethod: 'CASH',
        notes: template.notes ?? undefined,
        status: 'RECURRING_UNCONFIRMED',
        lineage: 'single',
        familyId: family.id,
        templateId: templateId, // Store the templateId to ensure correct template is used
      },
      include: {
        client: true,
        employees: true,
        admin: true,
      },
    })

    res.json({
      family,
      unconfirmedAppointment: unconfirmedAppt,
    })
  } catch (err) {
    console.error('Error creating recurrence family:', err)
    res.status(500).json({ error: 'Failed to create recurrence family' })
  }
}

/**
 * Update a recurrence family (rule, status)
 */
export async function updateRecurrenceFamily(req: Request, res: Response) {
  const id = parseInt(req.params.id, 10)
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' })

  try {
    const { recurrenceRule, status } = req.body as {
      recurrenceRule?: RecurrenceRule
      status?: 'active' | 'stopped'
    }

    const family = await prisma.recurrenceFamily.findUnique({
      where: { id },
      include: {
        appointments: {
          where: {
            status: { in: ['APPOINTED', 'RECURRING_UNCONFIRMED', 'CANCEL'] },
          },
          orderBy: { date: 'desc' },
        },
      },
    })

    if (!family) return res.status(404).json({ error: 'Not found' })

    const updateData: any = {}
    if (status !== undefined) {
      updateData.status = status
      // If restarting, we need a new unconfirmed appointment date (will be set via separate endpoint)
      if (status === 'active' && family.status === 'stopped') {
        // Don't set nextAppointmentDate here - it will be set when creating the new unconfirmed appointment
        updateData.nextAppointmentDate = null
      }
    }
    if (recurrenceRule) {
      updateData.recurrenceRule = ruleToJson(recurrenceRule)

      // Recalculate nextAppointmentDate based on the last acted-on appointment
      const lastActedOn = family.appointments.find(
        (a) => a.status === 'APPOINTED' || a.status === 'CANCEL'
      )
      if (lastActedOn) {
        const referenceDate = new Date(lastActedOn.date)
        const nextDate = calculateNextAppointmentDate(recurrenceRule, referenceDate)
        updateData.nextAppointmentDate = nextDate
      }
    }

    const updated = await prisma.recurrenceFamily.update({
      where: { id },
      data: updateData,
      include: {
        appointments: {
          orderBy: { date: 'asc' },
          include: {
            client: true,
            employees: true,
          },
        },
      },
    })

    // Ensure only one future unconfirmed instance exists (only if rule changed, not on restart)
    if (recurrenceRule) {
      await ensureSingleUnconfirmedInstance(id, updated.nextAppointmentDate)
    }

    res.json(updated)
  } catch (err) {
    console.error('Failed to update recurrence family:', err)
    res.status(500).json({ error: 'Failed to update recurrence family' })
  }
}

/**
 * Confirm a recurring unconfirmed appointment
 */
export async function confirmRecurringAppointment(req: Request, res: Response) {
  const id = parseInt(req.params.id, 10)
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' })

  try {
    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: { family: true },
    })

    if (!appointment || !appointment.familyId || !appointment.family) {
      return res.status(404).json({ error: 'Appointment not found or not part of a recurrence family' })
    }

    if (appointment.status !== 'RECURRING_UNCONFIRMED') {
      return res.status(400).json({ error: 'Appointment is not unconfirmed' })
    }

    const family = appointment.family
    const rule = jsonToRule(family.recurrenceRule)

    // Update appointment to confirmed
    const confirmed = await prisma.appointment.update({
      where: { id },
      data: { status: 'APPOINTED' },
      include: {
        client: true,
        employees: true,
        admin: true,
        payrollItems: { include: { extras: true } },
      },
    })

    // Recalculate next appointment date from the confirmed appointment date
    // This handles cases where the appointment was moved - it will calculate from the moved date
    const confirmedDate = appointmentAnchorUtc({
      dateUtc: confirmed.dateUtc,
      date: confirmed.date,
    })
    const nextDate = normalizeToBusinessDayAnchorUtc(
      calculateNextAppointmentDate(rule, confirmedDate),
    )
    
    // Check if this was the last unconfirmed appointment of a stopped family
    // If so, reactivate the family since we're confirming it
    const remainingUnconfirmed = await prisma.appointment.count({
      where: {
        familyId: family.id,
        status: 'RECURRING_UNCONFIRMED',
        id: { not: id }, // Exclude the one we're confirming
      },
    })
    
    const shouldReactivate = family.status === 'stopped' && remainingUnconfirmed === 0
    
    await prisma.recurrenceFamily.update({
      where: { id: family.id },
      data: {
        nextAppointmentDate: nextDate,
        ...(shouldReactivate ? { status: 'active' } : {}),
      },
    })

    // Create next unconfirmed instance
    await ensureSingleUnconfirmedInstance(family.id, nextDate)

    // Fetch the updated family with next appointment date
    const updatedFamily = await prisma.recurrenceFamily.findUnique({
      where: { id: family.id },
    })

    res.json({
      ...confirmed,
      family: updatedFamily ? {
        ...updatedFamily,
        nextAppointmentDate: nextDate,
      } : null,
    })
  } catch (err) {
    console.error('Failed to confirm recurring appointment:', err)
    res.status(500).json({ error: 'Failed to confirm appointment' })
  }
}

/**
 * Confirm and reschedule a recurring unconfirmed appointment
 */
export async function confirmAndRescheduleRecurringAppointment(
  req: Request,
  res: Response
) {
  const id = parseInt(req.params.id, 10)
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' })

  try {
    const { newDate } = req.body as { newDate?: string }
    if (!newDate) return res.status(400).json({ error: 'newDate required' })

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: { family: true },
    })

    if (!appointment || !appointment.familyId || !appointment.family) {
      return res.status(404).json({ error: 'Appointment not found or not part of a recurrence family' })
    }

    if (appointment.status !== 'RECURRING_UNCONFIRMED') {
      return res.status(400).json({ error: 'Appointment is not unconfirmed' })
    }

    const family = appointment.family
    const rule = jsonToRule(family.recurrenceRule)
    
    // Parse date string (YYYY-MM-DD) as UTC midnight for consistent storage
    let rescheduledDate: Date
    try {
      rescheduledDate = localDateStringToStartOfDayUtc(newDate)
    } catch {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' })
    }

    // Update appointment date and status
    const confirmed = await prisma.appointment.update({
      where: { id },
      data: {
        date: rescheduledDate,
        dateUtc: rescheduledDate,
        status: 'APPOINTED',
      },
      include: {
        client: true,
        employees: true,
        admin: true,
        payrollItems: { include: { extras: true } },
      },
    })

    // Recalculate next appointment date from the rescheduled and confirmed date
    const nextDate = normalizeToBusinessDayAnchorUtc(
      calculateNextAppointmentDate(rule, rescheduledDate),
    )
    
    // Check if this was the last unconfirmed appointment of a stopped family
    // If so, reactivate the family since we're confirming it
    const remainingUnconfirmed = await prisma.appointment.count({
      where: {
        familyId: family.id,
        status: 'RECURRING_UNCONFIRMED',
        id: { not: id }, // Exclude the one we're confirming
      },
    })
    
    const shouldReactivate = family.status === 'stopped' && remainingUnconfirmed === 0
    
    await prisma.recurrenceFamily.update({
      where: { id: family.id },
      data: {
        nextAppointmentDate: nextDate,
        ...(shouldReactivate ? { status: 'active' } : {}),
      },
    })

    // Create next unconfirmed instance
    await ensureSingleUnconfirmedInstance(family.id, nextDate)

    res.json(confirmed)
  } catch (err) {
    console.error('Failed to confirm and reschedule recurring appointment:', err)
    res.status(500).json({ error: 'Failed to confirm and reschedule appointment' })
  }
}

/**
 * Skip a recurring unconfirmed appointment
 */
export async function skipRecurringAppointment(req: Request, res: Response) {
  const id = parseInt(req.params.id, 10)
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' })

  try {
    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: { family: true },
    })

    if (!appointment || !appointment.familyId || !appointment.family) {
      return res.status(404).json({ error: 'Appointment not found or not part of a recurrence family' })
    }

    if (appointment.status !== 'RECURRING_UNCONFIRMED') {
      return res.status(400).json({ error: 'Appointment is not unconfirmed' })
    }

    const family = appointment.family
    const rule = jsonToRule(family.recurrenceRule)

    // Mark as canceled
    await prisma.appointment.update({
      where: { id },
      data: { status: 'CANCEL' },
    })

    // Recalculate next appointment date (from the skipped date)
    const nextDate = normalizeToBusinessDayAnchorUtc(
      calculateNextAppointmentDate(
        rule,
        appointmentAnchorUtc({ dateUtc: appointment.dateUtc, date: appointment.date }),
      ),
    )
    await prisma.recurrenceFamily.update({
      where: { id: family.id },
      data: { nextAppointmentDate: nextDate },
    })

    // Create next unconfirmed instance
    await ensureSingleUnconfirmedInstance(family.id, nextDate)

    // Fetch the newly created next appointment
    const nextAppointment = await prisma.appointment.findFirst({
      where: {
        familyId: family.id,
        status: 'RECURRING_UNCONFIRMED',
      },
      orderBy: [{ dateUtc: 'asc' }, { date: 'asc' }],
    })

    res.json({ 
      success: true,
      nextAppointmentDate: nextDate,
      nextAppointment: nextAppointment ? {
        id: nextAppointment.id,
        date: nextAppointment.date,
        dateUtc: nextAppointment.dateUtc,
      } : null,
    })
  } catch (err) {
    console.error('Failed to skip recurring appointment:', err)
    res.status(500).json({ error: 'Failed to skip appointment' })
  }
}

/**
 * Move a recurring unconfirmed appointment to a different date (without confirming)
 * This will update the appointment date and log the move in the family notes
 */
export async function moveRecurringAppointment(req: Request, res: Response) {
  const id = parseInt(req.params.id, 10)
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' })

  try {
    const { newDate, newTime } = req.body as { newDate?: string; newTime?: string }
    if (!newDate) return res.status(400).json({ error: 'newDate required' })
    if (!newTime) return res.status(400).json({ error: 'newTime required' })

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: { family: true, client: true },
    })

    if (!appointment || !appointment.familyId || !appointment.family) {
      return res.status(404).json({ error: 'Appointment not found or not part of a recurrence family' })
    }

    if (appointment.status !== 'RECURRING_UNCONFIRMED') {
      return res.status(400).json({ error: 'Appointment is not unconfirmed' })
    }

    const family = appointment.family
    
    let movedDate: Date
    try {
      movedDate = localDateStringToStartOfDayUtc(newDate)
    } catch {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' })
    }

    // Validate time format (HH:MM)
    const timeMatch = newTime.match(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
    if (!timeMatch) {
      return res.status(400).json({ error: 'Invalid time format. Use HH:MM (24-hour format)' })
    }

    const oldDateStr = appointmentLocalDateKey({
      dateUtc: appointment.dateUtc,
      date: appointment.date,
    })
    const newDateStr = utcInstantToLocalDateString(movedDate)
    const oldTimeStr = appointment.time
    const timeLog = oldTimeStr !== newTime ? ` from ${oldTimeStr} to ${newTime}` : ` (time unchanged: ${newTime})`

    // Log the move in the appointment notes
    const moveLog = `[Moved from ${oldDateStr}${oldTimeStr !== newTime ? ` ${oldTimeStr}` : ''} to ${newDateStr} ${newTime} on ${utcInstantToLocalDateString(new Date())}]`
    const existingNotes = appointment.notes || ''
    const updatedNotes = existingNotes 
      ? `${existingNotes}\n${moveLog}`
      : moveLog

    // Update appointment date, time, and notes (keep status as RECURRING_UNCONFIRMED)
    // When this appointment is confirmed later, it will create the next unconfirmed based on the moved date
    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        date: movedDate,
        dateUtc: movedDate,
        time: newTime,
        notes: updatedNotes,
      },
      include: {
        client: true,
        employees: true,
        admin: true,
        payrollItems: { include: { extras: true } },
      },
    })

    // Update nextAppointmentDate in family to reflect the moved date
    // This ensures the family knows about the new date
    const rule = jsonToRule(family.recurrenceRule)
    const nextDate = normalizeToBusinessDayAnchorUtc(
      calculateNextAppointmentDate(rule, movedDate),
    )
    await prisma.recurrenceFamily.update({
      where: { id: family.id },
      data: { nextAppointmentDate: movedDate }, // The moved date is now the next appointment
    })

    res.json(updated)
  } catch (err) {
    console.error('Failed to move recurring appointment:', err)
    res.status(500).json({ error: 'Failed to move appointment' })
  }
}

/**
 * Ensure only one future unconfirmed instance exists for a family
 */
async function ensureSingleUnconfirmedInstance(
  familyId: number,
  nextDate: Date | null
) {
  if (!nextDate) return

  const family = await prisma.recurrenceFamily.findUnique({
    where: { id: familyId },
    include: {
      appointments: true,
    },
  })

  if (!family) return

  // Find existing unconfirmed instances
  const existing = family.appointments.filter(
    (a) => a.status === 'RECURRING_UNCONFIRMED'
  )

  // If there's exactly one and it's on the right date, we're good
  if (existing.length === 1) {
    const existingAnchor = appointmentAnchorUtc({
      dateUtc: existing[0].dateUtc,
      date: existing[0].date,
    })
    const targetAnchor = normalizeToBusinessDayAnchorUtc(nextDate)
    if (existingAnchor.getTime() === targetAnchor.getTime()) {
      return // Already correct
    }
  }

  // Delete all existing unconfirmed instances
  await prisma.appointment.deleteMany({
    where: {
      familyId,
      status: 'RECURRING_UNCONFIRMED',
    },
  })

  // Create new unconfirmed instance if we have a next date
  if (nextDate) {
    const anchor = normalizeToBusinessDayAnchorUtc(nextDate)
    // Find the most recent confirmed appointment to use as a template
    const confirmedAppts = family.appointments
      .filter((a) => a.status === 'APPOINTED')
      .sort(
        (a, b) =>
          appointmentAnchorUtc({ dateUtc: b.dateUtc, date: b.date }).getTime() -
          appointmentAnchorUtc({ dateUtc: a.dateUtc, date: a.date }).getTime(),
      )
    const templateAppt = confirmedAppts[0] || family.appointments[0]
    
    if (templateAppt) {
      // Use templateId from family if available, otherwise from the template appointment
      const templateIdToUse = family.templateId ?? templateAppt.templateId ?? null
      
      await prisma.appointment.create({
        data: {
          clientId: templateAppt.clientId,
          adminId: templateAppt.adminId,
          date: anchor,
          dateUtc: anchor,
          time: templateAppt.time,
          type: templateAppt.type,
          address: templateAppt.address,
          cityStateZip: templateAppt.cityStateZip,
          size: templateAppt.size,
          hours: templateAppt.hours ?? (templateAppt.size && templateAppt.type
            ? (await import('../utils/appointmentUtils')).calculateAppointmentHours(templateAppt.size, templateAppt.type)
            : null),
          price: templateAppt.price,
          paid: false,
          tip: 0,
          noTeam: templateAppt.noTeam,
          carpetRooms: templateAppt.carpetRooms,
          carpetPrice: templateAppt.carpetPrice,
          carpetEmployees: [],
          paymentMethod: 'CASH',
          notes: templateAppt.notes,
          status: 'RECURRING_UNCONFIRMED',
          lineage: 'single',
          familyId: family.id,
          templateId: templateIdToUse, // Store templateId to ensure correct template is used
        },
      })
    }
  }
}

/**
 * Restart a stopped recurrence family by creating a new unconfirmed appointment
 */
export async function restartRecurrenceFamily(req: Request, res: Response) {
  const id = parseInt(req.params.id, 10)
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' })

  try {
    const { date, time } = req.body as { date?: string; time?: string }
    if (!date || !time) {
      return res.status(400).json({ error: 'date and time are required to restart a recurrence family' })
    }

    const family = await prisma.recurrenceFamily.findUnique({
      where: { id },
      include: {
        appointments: {
          orderBy: { date: 'desc' },
          take: 1,
        },
      },
    })

    if (!family) return res.status(404).json({ error: 'Not found' })
    if (family.status !== 'stopped') {
      return res.status(400).json({ error: 'Family is not stopped' })
    }

    // Get template from last appointment
    const lastAppt = family.appointments[0]
    if (!lastAppt) {
      return res.status(400).json({ error: 'No previous appointments found to use as template' })
    }

    let newDate: Date
    try {
      newDate = localDateStringToStartOfDayUtc(date)
    } catch {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' })
    }
    const rule = jsonToRule(family.recurrenceRule)
    const nextDate = normalizeToBusinessDayAnchorUtc(calculateNextAppointmentDate(rule, newDate))

    // Update family to active and set next appointment date
    const updated = await prisma.recurrenceFamily.update({
      where: { id },
      data: {
        status: 'active',
        nextAppointmentDate: newDate,
      },
    })

    // Create new unconfirmed appointment
    const { calculateAppointmentHours } = await import('../utils/appointmentUtils')
    const calculatedHours = lastAppt.size && lastAppt.type
      ? calculateAppointmentHours(lastAppt.size, lastAppt.type)
      : lastAppt.hours

    // Use templateId from family if available, otherwise from the last appointment
    const templateIdToUse = family.templateId ?? lastAppt.templateId ?? null

    const unconfirmedAppt = await prisma.appointment.create({
      data: {
        clientId: lastAppt.clientId,
        adminId: lastAppt.adminId,
        date: newDate,
        dateUtc: newDate,
        time,
        type: lastAppt.type,
        address: lastAppt.address,
        cityStateZip: lastAppt.cityStateZip,
        size: lastAppt.size,
        hours: calculatedHours,
        price: lastAppt.price,
        paid: false,
        tip: 0,
        noTeam: lastAppt.noTeam,
        carpetRooms: lastAppt.carpetRooms,
        carpetPrice: lastAppt.carpetPrice,
        carpetEmployees: [],
        paymentMethod: 'CASH',
        notes: lastAppt.notes,
        status: 'RECURRING_UNCONFIRMED',
        lineage: 'single',
        familyId: family.id,
        templateId: templateIdToUse, // Store templateId to ensure correct template is used
      },
      include: {
        client: true,
        employees: true,
        admin: true,
      },
    })

    res.json({
      family: updated,
      unconfirmedAppointment: unconfirmedAppt,
    })
  } catch (err) {
    console.error('Failed to restart recurrence family:', err)
    res.status(500).json({ error: 'Failed to restart recurrence family' })
  }
}

/**
 * Delete a recurrence family (only allowed for stopped families)
 */
export async function deleteRecurrenceFamily(req: Request, res: Response) {
  const id = parseInt(req.params.id, 10)
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' })

  try {
    const family = await prisma.recurrenceFamily.findUnique({
      where: { id },
    })

    if (!family) {
      return res.status(404).json({ error: 'Recurrence family not found' })
    }

    if (family.status !== 'stopped') {
      return res.status(400).json({ error: 'Can only delete stopped recurrence families' })
    }

    // Delete all RECURRING_UNCONFIRMED appointments for this family
    await prisma.appointment.deleteMany({
      where: {
        familyId: id,
        status: 'RECURRING_UNCONFIRMED',
      },
    })

    // Delete the family (other appointments will have their familyId set to null due to onDelete: SetNull)
    await prisma.recurrenceFamily.delete({
      where: { id },
    })

    res.json({ message: 'Recurrence family deleted successfully' })
  } catch (err) {
    console.error('Failed to delete recurrence family:', err)
    res.status(500).json({ error: 'Failed to delete recurrence family' })
  }
}

/**
 * Daily sync job: Ensure one unconfirmed instance per active family
 * Also check for missed unconfirmed instances and stop families
 * DEPRECATED: This function is no longer used. Unconfirmed appointments are created
 * when confirming the previous one, and families are stopped when fetching active families.
 */
export async function syncRecurringAppointments() {
  try {
    const todayStr = utcInstantToLocalDateString(new Date())
    const { DateTime } = await import('luxon')
    const { DEFAULT_APPOINTMENT_TIMEZONE } = await import('../utils/appointmentTimezone')
    const endOfMonth = DateTime.now()
      .setZone(DEFAULT_APPOINTMENT_TIMEZONE)
      .endOf('month')
      .toUTC()
      .toJSDate()

    const activeFamilies = await prisma.recurrenceFamily.findMany({
      where: { status: 'active' },
      include: {
        appointments: {
          where: {
            status: 'RECURRING_UNCONFIRMED',
            OR: [
              { dateUtc: { lte: endOfMonth } },
              { AND: [{ dateUtc: null }, { date: { lte: endOfMonth } }] },
            ],
          },
        },
      },
    })

    for (const family of activeFamilies) {
      const rule = jsonToRule(family.recurrenceRule)

      // Check for missed unconfirmed instances
      const missed = family.appointments.filter((a) => {
        const apptStr = appointmentLocalDateKey({
          dateUtc: a.dateUtc,
          date: a.date,
        })
        return apptStr < todayStr
      })

      if (missed.length > 0) {
        // Stop the family
        await prisma.recurrenceFamily.update({
          where: { id: family.id },
          data: { status: 'stopped' },
        })
        continue
      }

      // Ensure nextAppointmentDate is within current month
      if (family.nextAppointmentDate) {
        const nextDate = new Date(family.nextAppointmentDate)
        if (nextDate <= endOfMonth) {
          await ensureSingleUnconfirmedInstance(family.id, family.nextAppointmentDate)
        }
      }
    }
  } catch (err) {
    console.error('Error in daily recurring sync:', err)
  }
}

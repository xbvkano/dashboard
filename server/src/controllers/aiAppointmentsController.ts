import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { calculateAppointmentHours, parseSqft } from '../utils/appointmentUtils'
import { normalizePhone } from '../utils/phoneUtils'

/**
 * Convert a specific size value to the appropriate size range for staff options
 */
function getSizeRange(size: string): string {
  // Parse the size value (handles both single values and ranges)
  const sqft = parseSqft(size)
  if (sqft === null) {
    return size // Return original if can't parse
  }
  
  // Map specific sizes to standard ranges
  if (sqft <= 1000) return '0-1000'
  if (sqft <= 1500) return '1000-1500'
  if (sqft <= 2000) return '1500-2000'
  if (sqft <= 2500) return '2000-2500'
  if (sqft <= 3000) return '2500-3000'
  if (sqft <= 3500) return '3000-3500'
  if (sqft <= 4000) return '3500-4000'
  if (sqft <= 4500) return '4000-4500'
  if (sqft <= 5000) return '4500-5000'
  if (sqft <= 5500) return '5000-5500'
  if (sqft <= 6000) return '5500-6000'
  return '6000+'
}

const prisma = new PrismaClient()

export async function createAIAppointment(req: Request, res: Response) {
  try {
    const {
      clientName,
      clientPhone,
      appointmentAddress,
      price,
      date,
      time,
      notes,
      size,
      serviceType,
      anyDate,
    } = req.body as {
      clientName?: string
      clientPhone?: string
      appointmentAddress?: string
      price?: number
      date?: string
      time?: string
      notes?: string
      size?: string
      serviceType?: string
      anyDate?: boolean
    }

    // Validate required fields
    if (!clientName || !clientPhone || !appointmentAddress || !price || !date || !time || !size || !serviceType) {
      return res.status(400).json({ error: 'Missing required fields: clientName, clientPhone, appointmentAddress, price, date, time, size, serviceType' })
    }

    // Validate size format - should be either a range (e.g., "1500-2000") or single value (e.g., "3030")
    const parsedSize = parseSqft(size)
    if (parsedSize === null) {
      return res.status(400).json({ error: 'Invalid size format. Size should be a range (e.g., "1500-2000") or single value (e.g., "3030")' })
    }

    // Hardcode adminId to 9 (AI Admin)
    const adminId = 9

    // Normalize phone number
    const normalizedPhone = normalizePhone(clientPhone)
    if (!normalizedPhone) {
      return res.status(400).json({ error: 'Invalid phone number format' })
    }

    // Step 1: Find or create client (match by phone only - names can repeat, phone is unique)
    let client = await prisma.client.findFirst({
      where: {
        number: normalizedPhone
      }
    })

    if (!client) {
      // Ensure unique name: if name already exists, append last 4 digits of phone
      let clientNameToUse = clientName
      const existingByName = await prisma.client.findFirst({
        where: { name: clientName }
      })
      if (existingByName) {
        const last4 = normalizedPhone.slice(-4)
        clientNameToUse = `${clientName} ${last4}`
      }

      // Create new client with AI note
      client = await prisma.client.create({
        data: {
          name: clientNameToUse,
          number: normalizedPhone,
          from: 'AI',
          notes: 'Client created by AI',
        }
      })
    } else {
      // Update existing client to add AI note if not already present
      const currentNotes = client.notes || ''
      if (!currentNotes.includes('AI')) {
        await prisma.client.update({
          where: { id: client.id },
          data: {
            notes: currentNotes ? `${currentNotes} | Client used by AI` : 'Client used by AI'
          }
        })
      }
    }

    // Step 2: Check if client already has an appointment on the same day
    // Parse date string (YYYY-MM-DD) as UTC midnight for consistent storage
    const dateParts = date.split('-')
    if (dateParts.length !== 3) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' })
    }
    const appointmentDate = new Date(Date.UTC(
      parseInt(dateParts[0]),
      parseInt(dateParts[1]) - 1, // Month is 0-indexed
      parseInt(dateParts[2])
    ))
    if (isNaN(appointmentDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date' })
    }

    // Check if appointment is for a different year than current year
    const currentYear = new Date().getFullYear()
    const appointmentYear = appointmentDate.getUTCFullYear()
    const anyDateValue = anyDate === true // Default to false if not provided or not explicitly true
    
    if (appointmentYear !== currentYear && !anyDateValue) {
      return res.status(400).json({ 
        error: `Cannot create appointment for year ${appointmentYear}. The appointment date must be in the current year (${currentYear}). To create an appointment for a different year, set the "anyDate" parameter to true in the request body.` 
      })
    }
    
    // For the query, we need to check the full day range in UTC
    const nextDay = new Date(Date.UTC(
      appointmentDate.getUTCFullYear(),
      appointmentDate.getUTCMonth(),
      appointmentDate.getUTCDate() + 1
    ))
    const existingAppointment = await prisma.appointment.findFirst({
      where: {
        clientId: client.id,
        date: {
          gte: appointmentDate,
          lt: nextDay
        }
      }
    })

    if (existingAppointment) {
      return res.status(409).json({ 
        error: 'SAME_DAY_APPOINT',
        message: 'Client already has an appointment on this date',
        existingAppointment: {
          id: existingAppointment.id,
          date: existingAppointment.date,
          time: existingAppointment.time,
          address: existingAppointment.address
        }
      })
    }

    // Map the size to the standard range format for team options compatibility
    const mappedSize = getSizeRange(size)
    console.log(`AI Appointment: Mapped size "${size}" to "${mappedSize}" (parsed as ${parsedSize} sqft)`)

    // Step 3: Find matching template or create new one
    let template = await prisma.appointmentTemplate.findFirst({
      where: {
        clientId: client.id,
        address: appointmentAddress,
        price: price,
        size: mappedSize
      }
    })

    if (!template) {
      // Create new template - use provided notes or default AI note
      const templateNotes = (notes !== undefined && notes !== null) ? notes : 'Template created by AI'
      template = await prisma.appointmentTemplate.create({
        data: {
          templateName: `AI Template - ${appointmentAddress}`,
          type: serviceType as any,
          size: mappedSize,
          address: appointmentAddress,
          price: price,
          notes: templateNotes,
          instructions: '',
          clientId: client.id,
        }
      })
    } else if (notes !== undefined && notes !== null) {
      // Update existing template with provided notes
      template = await prisma.appointmentTemplate.update({
        where: { id: template.id },
        data: { notes: notes },
      })
    }

    // Calculate hours based on size and service type
    const hours = calculateAppointmentHours(size, serviceType)

    // Step 4: Create the appointment
    const appt = await prisma.appointment.create({
      data: {
        clientId: client.id,
        adminId,
        templateId: template.id, // Save templateId to database
        date: appointmentDate,
        time,
        type: serviceType as any, // Use the actual service type (STANDARD, DEEP, MOVE_IN_OUT)
        address: appointmentAddress,
        size: mappedSize,
        hours, // Add the calculated hours
        price,
        paid: false,
        paymentMethod: 'CASH',
        tip: 0,
        noTeam: true, // AI appointments are always no team by default
        notes: template.notes,
        status: 'APPOINTED',
        lineage: 'single',
        aiCreated: true, // Mark as AI created
      },
      include: {
        client: true,
        employees: true,
        admin: true,
        payrollItems: { include: { extras: true } },
      },
    })

    return res.json({
      success: true,
      appointment: appt,
      client: client,
      template: template,
      message: 'AI appointment created successfully'
    })

  } catch (err: unknown) {
    const prismaErr = err as { code?: string; meta?: { target?: string[] }; message?: string }
    const errName = err instanceof Error ? err.name : 'UnknownError'
    const errMessage = err instanceof Error ? err.message : String(err)
    const errStack = err instanceof Error ? err.stack : undefined

    console.error('[AI Appointment] Error creating AI appointment:', {
      errorName: errName,
      message: errMessage,
      ...(prismaErr.code && { code: prismaErr.code }),
      ...(prismaErr.meta && { meta: prismaErr.meta }),
      ...(errStack && { stack: errStack }),
    })

    // Known Prisma errors: return specific status and message
    if (prismaErr.code === 'P2002' && prismaErr.meta?.target?.includes('name')) {
      return res.status(409).json({
        error: 'CLIENT_NAME_EXISTS',
        message: 'A client with this name already exists (different phone). Match by phone only; consider using the existing client.',
      })
    }
    if (prismaErr.code === 'P2002' && prismaErr.meta?.target?.includes('number')) {
      return res.status(409).json({
        error: 'CLIENT_PHONE_EXISTS',
        message: 'A client with this phone number already exists.',
      })
    }
    if (errName === 'PrismaClientInitializationError' || errMessage.includes('Can\'t reach database')) {
      return res.status(503).json({
        error: 'DATABASE_UNAVAILABLE',
        message: 'Database server is not reachable. Please try again later.',
      })
    }

    return res.status(500).json({ error: 'Failed to create AI appointment' })
  }
}

export async function getAIAppointments(req: Request, res: Response) {
  try {
    const appointments = await prisma.appointment.findMany({
      where: {
        aiCreated: true
      },
      include: {
        client: true,
        employees: true,
        admin: true,
        payrollItems: { include: { extras: true } },
      },
      orderBy: {
        date: 'desc'
      }
    })

    return res.json(appointments)
  } catch (err: unknown) {
    const errName = err instanceof Error ? err.name : 'UnknownError'
    const errMessage = err instanceof Error ? err.message : String(err)
    const errStack = err instanceof Error ? err.stack : undefined
    console.error('[AI Appointment] Error fetching AI appointments:', {
      errorName: errName,
      message: errMessage,
      ...(errStack && { stack: errStack }),
    })
    return res.status(500).json({ error: 'Failed to fetch AI appointments' })
  }
}

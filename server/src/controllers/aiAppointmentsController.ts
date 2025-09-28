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

    // Hardcode adminId to 9
    const adminId = 9

    // Normalize phone number
    const normalizedPhone = normalizePhone(clientPhone)
    if (!normalizedPhone) {
      return res.status(400).json({ error: 'Invalid phone number format' })
    }

    // Step 1: Find or create client
    let client = await prisma.client.findFirst({
      where: {
        OR: [
          { name: clientName },
          { number: normalizedPhone }
        ]
      }
    })

    if (!client) {
      // Create new client with AI note
      client = await prisma.client.create({
        data: {
          name: clientName,
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
      // Create new template with AI note
      template = await prisma.appointmentTemplate.create({
        data: {
          templateName: `AI Template - ${appointmentAddress}`,
          type: serviceType as any,
          size: mappedSize,
          address: appointmentAddress,
          price: price,
          notes: 'Template created by AI',
          instructions: '',
          clientId: client.id,
        }
      })
    }

    // Calculate hours based on size and service type
    const hours = calculateAppointmentHours(size, serviceType)

    // Step 4: Create the appointment
    const appt = await prisma.appointment.create({
      data: {
        clientId: client.id,
        adminId,
        date: new Date(date),
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
        notes: notes || 'Appointment created by AI',
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

  } catch (err) {
    console.error('Error creating AI appointment:', err)
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
  } catch (err) {
    console.error('Error fetching AI appointments:', err)
    return res.status(500).json({ error: 'Failed to fetch AI appointments' })
  }
}

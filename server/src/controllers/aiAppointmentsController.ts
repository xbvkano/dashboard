import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { calculateAppointmentHours } from '../utils/appointmentUtils'
import { normalizePhone } from '../utils/phoneUtils'

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

    // Use the provided size instead of estimating from address
    const estimatedSize = size

    // Step 3: Find matching template or create new one
    let template = await prisma.appointmentTemplate.findFirst({
      where: {
        clientId: client.id,
        address: appointmentAddress,
        price: price,
        size: estimatedSize
      }
    })

    if (!template) {
      // Create new template with AI note
      template = await prisma.appointmentTemplate.create({
        data: {
          templateName: `AI Template - ${appointmentAddress}`,
          type: serviceType as any,
          size: estimatedSize,
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
        size: estimatedSize,
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

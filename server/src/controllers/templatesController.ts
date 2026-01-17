import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function getAppointmentTemplates(req: Request, res: Response) {
  const clientId = parseInt(String(req.query.clientId))
  if (Number.isNaN(clientId)) {
    return res.status(400).json({ error: 'clientId required' })
  }
  try {
    const templates = await prisma.appointmentTemplate.findMany({
      where: { clientId },
      orderBy: { templateName: 'asc' },
    })
    res.json(templates)
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch templates' })
  }
}

export async function createAppointmentTemplate(req: Request, res: Response) {
  try {
    const {
      clientId,
      templateName,
      type,
      size,
      address,
      price,
      notes,
      instructions,
      carpetRooms,
      carpetPrice,
    } = req.body as {
      clientId?: number
      templateName?: string
      type?: any
      size?: string
      address?: string
      price?: number
      notes?: string
      instructions?: string
      carpetRooms?: number
      carpetPrice?: number
    }

    if (
      !clientId ||
      !templateName ||
      !type ||
      !size ||
      !address ||
      price === undefined
    ) {
      return res.status(400).json({ error: 'Missing fields' })
    }

    const template = await prisma.appointmentTemplate.create({
      data: {
        templateName,
        type,
        size,
        address,
        cityStateZip: null,
        price,
        instructions,
        notes,
        carpetRooms: carpetRooms ?? null,
        carpetPrice: carpetPrice ?? null,
        client: { connect: { id: clientId } },
      },
    })
    res.json(template)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to create template' })
  }
}

export async function updateAppointmentTemplate(req: Request, res: Response) {
  const id = parseInt(req.params.id, 10)
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid id' })
  }
  try {
    const {
      templateName,
      type,
      size,
      address,
      price,
      notes,
      instructions,
      carpetRooms,
      carpetPrice,
    } = req.body as {
      templateName?: string
      type?: any
      size?: string
      address?: string
      price?: number
      notes?: string
      instructions?: string
      carpetRooms?: number
      carpetPrice?: number
    }

    const data: any = {}
    if (templateName !== undefined) data.templateName = templateName
    if (type !== undefined) data.type = type
    if (size !== undefined) data.size = size
    if (address !== undefined) data.address = address
    if (price !== undefined) data.price = price
    if (notes !== undefined) data.notes = notes
    if (instructions !== undefined) data.instructions = instructions
    if (carpetRooms !== undefined) data.carpetRooms = carpetRooms ?? null
    if (carpetPrice !== undefined) data.carpetPrice = carpetPrice ?? null

    const template = await prisma.appointmentTemplate.update({
      where: { id },
      data,
    })
    res.json(template)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to update template' })
  }
}

export async function deleteAppointmentTemplate(req: Request, res: Response) {
  const id = parseInt(req.params.id, 10)
  try {
    await prisma.appointmentTemplate.delete({ where: { id } })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete template' })
  }
}

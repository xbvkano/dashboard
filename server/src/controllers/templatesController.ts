import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { getDefaultTeamSize } from '../data/teamSizeData'
import {
  isSupersededTemplateName,
  nextOldTemplateName,
  stripSupersededSuffix,
} from '../utils/templateVersioning'

const prisma = new PrismaClient()

export async function getAppointmentTemplates(req: Request, res: Response) {
  const clientId = parseInt(String(req.query.clientId))
  if (Number.isNaN(clientId)) {
    return res.status(400).json({ error: 'clientId required' })
  }
  const excludeSuperseded =
    String(req.query.excludeSuperseded ?? '').toLowerCase() === 'true' ||
    String(req.query.excludeSuperseded ?? '') === '1'
  try {
    const templates = await prisma.appointmentTemplate.findMany({
      where: { clientId },
      orderBy: { templateName: 'asc' },
    })
    res.json(
      excludeSuperseded
        ? templates.filter((t) => !isSupersededTemplateName(t.templateName))
        : templates,
    )
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
      teamSize,
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
      teamSize?: number
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

    const defaultTeamSize = getDefaultTeamSize(size, type)
    const finalTeamSize = teamSize !== undefined && teamSize !== null ? teamSize : defaultTeamSize

    const template = await prisma.appointmentTemplate.create({
      data: {
        templateName,
        type,
        size,
        teamSize: finalTeamSize,
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
      teamSize,
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
      teamSize?: number
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
    if (teamSize !== undefined) data.teamSize = teamSize
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

/**
 * Copy-on-write versioning: rename the existing row to "{name} old(n)", create a new
 * current template with the short name + provided fields, retarget recurrence families.
 * Optionally retarget a single appointment (the one being edited) to the new template.
 * Other appointments keep pointing at the old row.
 */
export async function versionAppointmentTemplate(req: Request, res: Response) {
  const id = parseInt(req.params.id, 10)
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid id' })
  }

  try {
    const {
      templateName,
      type,
      size,
      teamSize,
      address,
      price,
      notes,
      instructions,
      carpetRooms,
      carpetPrice,
      retargetAppointmentId,
    } = req.body as {
      templateName?: string
      type?: any
      size?: string
      teamSize?: number
      address?: string
      price?: number
      notes?: string | null
      instructions?: string | null
      carpetRooms?: number | null
      carpetPrice?: number | null
      retargetAppointmentId?: number
    }

    const existing = await prisma.appointmentTemplate.findUnique({ where: { id } })
    if (!existing) {
      return res.status(404).json({ error: 'Template not found' })
    }

    const shortName = stripSupersededSuffix(
      (templateName !== undefined ? templateName : existing.templateName).trim(),
    )
    if (!shortName) {
      return res.status(400).json({ error: 'templateName required' })
    }

    const siblings = await prisma.appointmentTemplate.findMany({
      where: { clientId: existing.clientId },
      select: { templateName: true },
    })
    const oldName = nextOldTemplateName(
      stripSupersededSuffix(existing.templateName),
      siblings.map((s) => s.templateName),
    )

    const newType = type !== undefined ? type : existing.type
    const newSize = size !== undefined ? size : existing.size
    const newTeamSize =
      teamSize !== undefined && teamSize !== null
        ? teamSize
        : existing.teamSize
    const newAddress = address !== undefined ? address : existing.address
    const newPrice = price !== undefined ? price : existing.price
    const newNotes = notes !== undefined ? notes : existing.notes
    const newInstructions =
      instructions !== undefined ? instructions : existing.instructions
    const newCarpetRooms =
      carpetRooms !== undefined ? carpetRooms : existing.carpetRooms
    const newCarpetPrice =
      carpetPrice !== undefined ? carpetPrice : existing.carpetPrice

    if (!newType || !newSize || !newAddress || newPrice === undefined || newPrice === null) {
      return res.status(400).json({ error: 'Missing fields' })
    }

    const result = await prisma.$transaction(async (tx) => {
      const archived = await tx.appointmentTemplate.update({
        where: { id },
        data: { templateName: oldName },
      })

      const current = await tx.appointmentTemplate.create({
        data: {
          templateName: shortName,
          type: newType,
          size: newSize,
          teamSize: newTeamSize ?? 1,
          address: newAddress,
          cityStateZip: existing.cityStateZip,
          price: newPrice,
          notes: newNotes ?? null,
          instructions: newInstructions ?? null,
          carpetRooms: newCarpetRooms ?? null,
          carpetPrice: newCarpetPrice ?? null,
          clientId: existing.clientId,
        },
      })

      await tx.recurrenceFamily.updateMany({
        where: { templateId: id },
        data: { templateId: current.id },
      })

      let retargetedAppointment = null
      if (retargetAppointmentId != null && !Number.isNaN(Number(retargetAppointmentId))) {
        retargetedAppointment = await tx.appointment.update({
          where: { id: Number(retargetAppointmentId) },
          data: {
            templateId: current.id,
            cityStateZip: newInstructions ?? null,
          },
          include: {
            client: true,
            employees: true,
            admin: true,
          },
        })
      }

      return { archived, current, retargetedAppointment }
    })

    res.json(result)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to version template' })
  }
}

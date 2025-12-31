import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library'
import { normalizePhone } from '../utils/phoneUtils'

const prisma = new PrismaClient()

export async function getClients(req: Request, res: Response) {
  // 1. Pull and normalize query params
  const searchTerm = String(req.query.search || '').trim()
  const skip = parseInt(String(req.query.skip || '0'), 10)
  const take = parseInt(String(req.query.take || '20'), 10)
  const includeDisabled = String(req.query.all) === 'true'

  // 2. Build a typed `where` clause
  const where: any = searchTerm
    ? {
        ...(includeDisabled ? {} : { disabled: false }),
        OR: [
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { number: { contains: searchTerm, mode: 'insensitive' } },
          { appointmentTemplates: { some: { address: { contains: searchTerm, mode: 'insensitive' } } } },
        ],
      }
    : includeDisabled ? {} : { disabled: false }

  try {
    // 3. Fetch and return
    const clients = await prisma.client.findMany({
      where,
      skip,
      take,
      orderBy: { name: 'asc' },
    })
    res.json(clients)
  } catch (error) {
    console.error('Error fetching clients:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}

export async function createClient(req: Request, res: Response) {
  try {
    const { name, number, from, notes, disabled } = req.body as {
      name?: string
      number?: string
      from?: string
      notes?: string
      disabled?: boolean
    }
    if (!name || !number || !from) {
      return res.status(400).json({ error: 'Name, number and from are required' })
    }
    const normalized = normalizePhone(number)
    if (!normalized) {
      return res.status(400).json({ error: 'Number must be 10 or 11 digits' })
    }
    const client = await prisma.client.create({
      data: { name, number: normalized, from, notes, disabled: disabled ?? false },
    })
    res.json(client)
  } catch (e: any) {
    if (
      e instanceof PrismaClientKnownRequestError &&
      e.code === 'P2002'
    ) {
      res.status(400).json({ error: 'Client name must be unique' })
    } else {
      console.error(e)
      res.status(500).json({ error: 'Failed to create client' })
    }
  }
}

export async function getClient(req: Request, res: Response) {
  const id = parseInt(req.params.id, 10)
  const client = await prisma.client.findUnique({ where: { id } })
  if (!client) return res.status(404).json({ error: 'Not found' })
  res.json(client)
}

export async function updateClient(req: Request, res: Response) {
  const id = parseInt(req.params.id, 10)
  try {
    const { name, number, from, notes, disabled } = req.body as {
      name?: string
      number?: string
      from?: string
      notes?: string
      disabled?: boolean
    }
    const data: any = {}
    if (name !== undefined) data.name = name
    if (number !== undefined) {
      const normalized = normalizePhone(number)
      if (!normalized) {
        return res.status(400).json({ error: 'Number must be 10 or 11 digits' })
      }
      data.number = normalized
    }
    if (from !== undefined) data.from = from
    if (notes !== undefined) data.notes = notes
    if (disabled !== undefined) data.disabled = disabled
    const client = await prisma.client.update({ where: { id }, data })
    res.json(client)
  } catch (e) {
    res.status(500).json({ error: 'Failed to update client' })
  }
}

export async function deleteClient(req: Request, res: Response) {
  const id = parseInt(req.params.id, 10)
  try {
    await prisma.client.delete({ where: { id } })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete client' })
  }
}

export async function getClientAppointments(req: Request, res: Response) {
  const id = parseInt(req.params.id, 10)
  const skip = parseInt(String(req.query.skip || '0'), 10)
  const take = parseInt(String(req.query.take || '25'), 10)
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' })
  try {
    const appts = await prisma.appointment.findMany({
      where: {
        clientId: id,
        status: { notIn: ['DELETED', 'RESCHEDULE_OLD'] },
      },
      orderBy: [{ date: 'desc' }, { time: 'desc' }],
      skip,
      take,
      include: {
        client: true,
        employees: true,
        admin: true,
        payrollItems: { include: { extras: true } },
      },
    })
    res.json(appts)
  } catch (e) {
    console.error('Error fetching client appointments:', e)
    res.status(500).json({ error: 'Failed to fetch appointments' })
  }
}

import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { normalizePhone } from '../utils/phoneUtils'

const prisma = new PrismaClient()

export async function getEmployees(req: Request, res: Response) {
  const searchTerm = String(req.query.search || '').trim()
  const skip = parseInt(String(req.query.skip || '0'), 10)
  const take = parseInt(String(req.query.take || '20'), 10)
  const includeDisabled = String(req.query.all) === 'true'

  const where: any = searchTerm
    ? {
        ...(includeDisabled ? {} : { disabled: false }),
        OR: [
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { number: { contains: searchTerm, mode: 'insensitive' } },
        ],
      }
    : includeDisabled ? {} : { disabled: false }

  try {
    const employees = await prisma.employee.findMany({
      where,
      skip,
      take,
      orderBy: { name: 'asc' },
    })
    res.json(employees)
  } catch (error) {
    console.error('Error fetching employees:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}

export async function createEmployee(req: Request, res: Response) {
  try {
    const { name, number, notes, experienced, disabled } = req.body as {
      name?: string
      number?: string
      notes?: string
      experienced?: boolean
      disabled?: boolean
    }
    if (!name || !number) {
      return res.status(400).json({ error: 'Name and number are required' })
    }
    const normalized = normalizePhone(number)
    if (!normalized) {
      return res.status(400).json({ error: 'Number must be 10 or 11 digits' })
    }
    const employee = await prisma.employee.create({
      data: {
        name,
        number: normalized,
        notes,
        experienced: experienced ?? false,
        disabled: disabled ?? false,
      },
    })
    res.json(employee)
  } catch (e) {
    res.status(500).json({ error: 'Failed to create employee' })
  }
}

export async function getEmployee(req: Request, res: Response) {
  const id = parseInt(req.params.id, 10)
  const employee = await prisma.employee.findUnique({ where: { id } })
  if (!employee) return res.status(404).json({ error: 'Not found' })
  res.json(employee)
}

export async function updateEmployee(req: Request, res: Response) {
  const id = parseInt(req.params.id, 10)
  try {
    const { name, number, notes, experienced, disabled } = req.body as {
      name?: string
      number?: string
      notes?: string
      experienced?: boolean
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
    if (notes !== undefined) data.notes = notes
    if (experienced !== undefined) data.experienced = experienced
    if (disabled !== undefined) data.disabled = disabled
    const employee = await prisma.employee.update({ where: { id }, data })
    res.json(employee)
  } catch (e) {
    res.status(500).json({ error: 'Failed to update employee' })
  }
}

export async function deleteEmployee(req: Request, res: Response) {
  const id = parseInt(req.params.id, 10)
  try {
    await prisma.employee.delete({ where: { id } })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete employee' })
  }
}

export async function getEmployeeAppointments(req: Request, res: Response) {
  const id = parseInt(req.params.id, 10)
  const skip = parseInt(String(req.query.skip || '0'), 10)
  const take = parseInt(String(req.query.take || '25'), 10)
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' })
  try {
    const appts = await prisma.appointment.findMany({
      where: {
        employees: { some: { id } },
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
    res.status(500).json({ error: 'Failed to fetch appointments' })
  }
}

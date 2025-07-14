import express, { Request, Response } from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { PrismaClient } from '@prisma/client'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library'
import { OAuth2Client } from 'google-auth-library'
dotenv.config()

const prisma = new PrismaClient()
const app = express()
const port = process.env.PORT || 3000
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim()).filter(Boolean)

app.use(cors())
app.use(express.json())

app.get('/', async (_req: Request, res: Response) => {
  res.json({ message: 'Hello from server' })
})

app.get('/users', async (_req: Request, res: Response) => {
  const users = await prisma.user.findMany()
  res.json(users)
})

app.get('/month-info', (req: Request, res: Response) => {
  const year = parseInt(String(req.query.year))
  const month = parseInt(String(req.query.month))

  if (Number.isNaN(year) || Number.isNaN(month)) {
    return res.status(400).json({ error: 'Invalid year or month' })
  }

  const first = new Date(year, month - 1, 1)
  const last = new Date(year, month, 0)

  res.json({
    startDay: first.getDay(),
    endDay: last.getDay(),
    daysInMonth: last.getDate(),
  })
})

app.get('/clients', async (req: Request, res: Response) => {
  // 1. Pull and normalize query params
  const searchTerm = String(req.query.search || '').trim()
  const skip = parseInt(String(req.query.skip || '0'), 10)
  const take = parseInt(String(req.query.take || '20'), 10)

  // 2. Build a typed `where` clause
  const where: any = searchTerm
    ? {
        OR: [
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { number: { contains: searchTerm, mode: 'insensitive' } },
        ],
      }
    : {}

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
})

app.post('/clients', async (req: Request, res: Response) => {
  try {
    const { name, number, notes } = req.body as {
      name?: string
      number?: string
      notes?: string
    }
    if (!name || !number) {
      return res.status(400).json({ error: 'Name and number are required' })
    }
    if (!/^\d{10}$/.test(number)) {
      return res.status(400).json({ error: 'Number must be 10 digits' })
    }
    const client = await prisma.client.create({ data: { name, number, notes } })
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
})

app.get('/clients/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10)
  const client = await prisma.client.findUnique({ where: { id } })
  if (!client) return res.status(404).json({ error: 'Not found' })
  res.json(client)
})

app.put('/clients/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10)
  try {
    const { name, number, notes } = req.body as {
      name?: string
      number?: string
      notes?: string
    }
    const data: any = {}
    if (name !== undefined) data.name = name
    if (number !== undefined) {
      if (!/^\d{10}$/.test(number)) {
        return res.status(400).json({ error: 'Number must be 10 digits' })
      }
      data.number = number
    }
    if (notes !== undefined) data.notes = notes
    const client = await prisma.client.update({ where: { id }, data })
    res.json(client)
  } catch (e) {
    res.status(500).json({ error: 'Failed to update client' })
  }
})

app.get('/employees', async (req: Request, res: Response) => {
  const searchTerm = String(req.query.search || '').trim()
  const skip = parseInt(String(req.query.skip || '0'), 10)
  const take = parseInt(String(req.query.take || '20'), 10)

  const where: any = searchTerm
    ? {
        OR: [
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { number: { contains: searchTerm, mode: 'insensitive' } },
        ],
      }
    : {}

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
})

app.post('/employees', async (req: Request, res: Response) => {
  try {
    const { name, number, notes } = req.body as {
      name?: string
      number?: string
      notes?: string
    }
    if (!name || !number) {
      return res.status(400).json({ error: 'Name and number are required' })
    }
    if (!/^\d{10}$/.test(number)) {
      return res.status(400).json({ error: 'Number must be 10 digits' })
    }
    const employee = await prisma.employee.create({ data: { name, number, notes } })
    res.json(employee)
  } catch (e) {
    res.status(500).json({ error: 'Failed to create employee' })
  }
})

app.get('/employees/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10)
  const employee = await prisma.employee.findUnique({ where: { id } })
  if (!employee) return res.status(404).json({ error: 'Not found' })
  res.json(employee)
})

app.put('/employees/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10)
  try {
    const { name, number, notes } = req.body as {
      name?: string
      number?: string
      notes?: string
    }
    const data: any = {}
    if (name !== undefined) data.name = name
    if (number !== undefined) {
      if (!/^\d{10}$/.test(number)) {
        return res.status(400).json({ error: 'Number must be 10 digits' })
      }
      data.number = number
    }
    if (notes !== undefined) data.notes = notes
    const employee = await prisma.employee.update({ where: { id }, data })
    res.json(employee)
  } catch (e) {
    res.status(500).json({ error: 'Failed to update employee' })
  }
})

// Appointment templates ---------------------------
app.get('/appointment-templates', async (req: Request, res: Response) => {
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
})

app.post('/appointment-templates', async (req: Request, res: Response) => {
  try {
    const { clientId, templateName, type, size, address, price, notes } =
      req.body as {
        clientId?: number
        templateName?: string
        type?: any
        size?: string
        address?: string
        price?: number
        notes?: string
      }

    if (
      !clientId ||
      !templateName ||
      !type ||
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
        cityStateZip: notes,
        price,
        client: { connect: { id: clientId } },
      },
    })
    res.json(template)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to create template' })
  }
})

// Appointments ------------------------------------
app.get('/appointments', async (req: Request, res: Response) => {
  const dateStr = String(req.query.date || '')
  if (!dateStr) return res.status(400).json({ error: 'date required' })
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) {
    return res.status(400).json({ error: 'invalid date' })
  }
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
  try {
    const appts = await prisma.appointment.findMany({
      where: { date: { gte: date, lt: next } },
      orderBy: { time: 'asc' },
    })
    res.json(appts)
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch appointments' })
  }
})

app.post('/appointments', async (req: Request, res: Response) => {
  try {
    const { clientId, templateId, date, time } = req.body as {
      clientId?: number
      templateId?: number
      date?: string
      time?: string
    }
    if (!clientId || !templateId || !date || !time) {
      return res.status(400).json({ error: 'Missing fields' })
    }

    const template = await prisma.appointmentTemplate.findUnique({
      where: { id: templateId },
    })
    if (!template) return res.status(400).json({ error: 'Invalid template' })

    const appt = await prisma.appointment.create({
      data: {
        client: { connect: { id: clientId } },
        date: new Date(date),
        time,
        type: template.type,
        address: template.address,
        cityStateZip: template.cityStateZip,
        size: template.size,
        price: template.price,
        paymentMethod: 'CASH',
        lineage: 'single',
        notes: template.cityStateZip || undefined,
      },
    })
    res.json(appt)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to create appointment' })
  }
})

app.post('/login', async (req: Request, res: Response) => {
  const { token } = req.body
  if (!token) {
    return res.status(400).json({ error: 'Missing token' })
  }
  try {
    const ticket = await client.verifyIdToken({ idToken: token, audience: process.env.GOOGLE_CLIENT_ID })
    const payload = ticket.getPayload()
    if (!payload?.email) {
      return res.status(400).json({ error: 'Invalid token' })
    }

    const user = await prisma.user.upsert({
      where: { email: payload.email },
      update: { name: payload.name || undefined },
      create: { email: payload.email, name: payload.name || undefined }
    })

    const role = adminEmails.includes(payload.email) ? 'admin' : 'user'
    res.json({ role, user })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Authentication failed' })
  }
})

app.listen(port, () => {
  console.log(`Server listening on port ${port}`)
})

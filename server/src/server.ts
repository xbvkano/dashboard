import express, { Request, Response } from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { PrismaClient } from '@prisma/client'
import { OAuth2Client } from 'google-auth-library'
import type { Prisma } from '@prisma/client'
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

app.get('/clients', async (req: Request, res: Response) => {
  // 1. Pull and normalize query params
  const searchTerm = String(req.query.search || '').trim()
  const skip = parseInt(String(req.query.skip || '0'), 10)
  const take = parseInt(String(req.query.take || '20'), 10)

  // 2. Build a typed `where` clause
  const where: Prisma.ClientWhereInput = searchTerm
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
  } catch (e) {
    res.status(500).json({ error: 'Failed to create client' })
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
    const data: Prisma.ClientUpdateInput = {}
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

  const where: Prisma.EmployeeWhereInput = searchTerm
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
    const data: Prisma.EmployeeUpdateInput = {}
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

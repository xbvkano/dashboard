import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import fs from 'fs'
import https from 'https'
import path from 'path'
import { PrismaClient } from '@prisma/client'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library'
import { OAuth2Client } from 'google-auth-library'
import axios from 'axios'
import crypto from 'crypto'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

let lastRecurringCheck = ''

async function ensureRecurringFuture() {
  const todayStr = new Date().toISOString().slice(0, 10)
  if (lastRecurringCheck === todayStr) return
  lastRecurringCheck = todayStr

  const lineages = await prisma.appointment.findMany({
    where: { reoccurring: true },
    select: { lineage: true },
    distinct: ['lineage'],
  })

  for (const { lineage } of lineages) {
    const latest = await prisma.appointment.findFirst({
      where: { lineage, status: { notIn: ['DELETED', 'CANCEL'] } },
      orderBy: { date: 'desc' },
      include: { employees: true },
    })
    if (!latest) continue

    const upcoming = await prisma.appointment.findMany({
      where: {
        lineage,
        status: { notIn: ['DELETED', 'CANCEL'] },
        date: { gte: new Date(todayStr) },
      },
      orderBy: { date: 'asc' },
      include: { employees: true },
    })
    if (upcoming.length >= 10 || upcoming.length === 0) continue

    let last = upcoming[upcoming.length - 1]
    let prev =
      upcoming.length >= 2
        ? upcoming[upcoming.length - 2]
        : await prisma.appointment.findFirst({
            where: {
              lineage,
              status: { notIn: ['DELETED', 'CANCEL'] },
              date: { lt: last.date },
            },
            orderBy: { date: 'desc' },
          })
    if (!prev) continue
    const diffDays = Math.round(
      (last.date.getTime() - prev.date.getTime()) / 86400000
    )
    const diffMonths =
      last.date.getMonth() - prev.date.getMonth() +
      12 * (last.date.getFullYear() - prev.date.getFullYear())
    const byMonth = diffDays > 25 || diffMonths > 0

    for (let i = upcoming.length; i < 10; i++) {
      const nextDate = new Date(last.date)
      if (byMonth) nextDate.setMonth(nextDate.getMonth() + diffMonths)
      else nextDate.setDate(nextDate.getDate() + diffDays)

      last = await prisma.appointment.create({
        data: {
          clientId: last.clientId,
          adminId: last.adminId,
          date: nextDate,
          time: last.time,
          type: last.type,
          address: last.address,
          cityStateZip: last.cityStateZip ?? undefined,
          size: last.size ?? undefined,
          hours: last.hours ?? null,
          price: last.price ?? null,
          paid: last.paid,
          tip: last.tip,
          carpetRooms: last.carpetRooms ?? null,
          paymentMethod: last.paymentMethod,
          notes: last.notes ?? undefined,
          status: 'REOCCURRING',
          lineage,
          reoccurring: true,
          ...(last.employees.length && {
            employees: {
              connect: last.employees.map((e: { id: number }) => ({ id: e.id })),
            },
          }),
        },
        include: { employees: true },
      })
    }
  }
}

import { staffOptionsData } from './data/staffOptions'
dotenv.config()

const prisma = new PrismaClient()
const app = express()
const port = process.env.PORT || 3000

const client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5173'
)

app.use(cors({
  allowedHeaders: [
    'Content-Type',
    'ngrok-skip-browser-warning',  // <- allow it here
  ],
}))
app.use(express.json())

// Basic request/response logging middleware
app.use((req: Request, res: Response, next) => {
  console.log(`got ${req.method} ${req.originalUrl} body: ${JSON.stringify(req.body)}`)
  const originalJson = res.json.bind(res)
  let responseBody: any
  res.json = ((body: any) => {
    responseBody = body
    return originalJson(body)
  }) as any
  res.on('finish', () => {
    console.log(
      `Responded ${req.method} ${req.originalUrl} -> ${res.statusCode} ${JSON.stringify(responseBody)}`
    )
  })
  next()
})

app.get('/', async (_req: Request, res: Response) => {
  res.json({ message: 'Hello from server' })
})

app.get('/users', async (_req: Request, res: Response) => {
  const users = await prisma.user.findMany()
  res.json(users)
})

app.get('/admins', async (_req: Request, res: Response) => {
  const admins = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'OWNER'] } },
    orderBy: { name: 'asc' },
  })
  res.json(admins)
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
    const { name, number, notes, experienced } = req.body as {
      name?: string
      number?: string
      notes?: string
      experienced?: boolean
    }
    if (!name || !number) {
      return res.status(400).json({ error: 'Name and number are required' })
    }
    if (!/^\d{10}$/.test(number)) {
      return res.status(400).json({ error: 'Number must be 10 digits' })
    }
    const employee = await prisma.employee.create({
      data: { name, number, notes, experienced: experienced ?? false }
    })
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
    const { name, number, notes, experienced } = req.body as {
      name?: string
      number?: string
      notes?: string
      experienced?: boolean
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
    if (experienced !== undefined) data.experienced = experienced
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

// Staff options lookup
app.get('/staff-options', (req: Request, res: Response) => {
  const size = String(req.query.size || '')
  const type = String(req.query.type || '')
  if (!size || !type) {
    return res.status(400).json({ error: 'size and type required' })
  }
  // map appointment type to service names used in data
  const serviceMap: Record<string, string> = {
    STANDARD: 'Standard',
    DEEP: 'Deep',
    MOVE_IN_OUT: 'Move',
  }
  const service = serviceMap[type as keyof typeof serviceMap]
  if (!service) {
    return res.status(400).json({ error: 'invalid type' })
  }
  const options = staffOptionsData
    .filter((o) => o.size === size && o.service === service && o.available)
    .map((o) => ({ sem: o.sem, com: o.com, hours: o.hours }))
  res.json(options)
})

// Pay rate calculator
app.get('/pay-rate', (req: Request, res: Response) => {
  const type = String(req.query.type || '')
  const size = String(req.query.size || '')
  const count = parseInt(String(req.query.count || '0'), 10)

  if (!type || !size || isNaN(count)) {
    return res.status(400).json({ error: 'type, size and count required' })
  }

  const parseSize = (s: string): number | null => {
    if (!s) return null
    const parts = s.split('-')
    let n = parseInt(parts[1] || parts[0])
    if (isNaN(n)) {
      n = parseInt(s)
    }
    return isNaN(n) ? null : n
  }

  const sqft = parseSize(size)
  if (sqft === null) {
    return res.status(400).json({ error: 'invalid size' })
  }

  const isLarge = sqft > 2500
  let rate = 0

  if (type === 'STANDARD') {
    rate = isLarge ? 100 : 80
  } else if (type === 'DEEP' || type === 'MOVE_IN_OUT') {
    if (isLarge) {
      rate = 100
    } else {
      rate = count === 1 ? 100 : 90
    }
  } else {
    return res.status(400).json({ error: 'invalid type' })
  }

  res.json({ rate })
})

// Carpet cleaning rate lookup
app.get('/carpet-rate', (req: Request, res: Response) => {
  const size = String(req.query.size || '')
  const rooms = parseInt(String(req.query.rooms || '0'), 10)

  if (!size || isNaN(rooms) || rooms <= 0) {
    return res.status(400).json({ error: 'size and rooms required' })
  }

  const parseSize = (s: string): number | null => {
    if (!s) return null
    const parts = s.split('-')
    let n = parseInt(parts[1] || parts[0])
    if (isNaN(n)) {
      n = parseInt(s)
    }
    return isNaN(n) ? null : n
  }

  const sqft = parseSize(size)
  if (sqft === null) {
    return res.status(400).json({ error: 'invalid size' })
  }

  const isLarge = sqft > 2500
  let rate = 0

  if (rooms === 1) {
    rate = isLarge ? 20 : 10
  } else if (rooms <= 3) {
    rate = isLarge ? 30 : 20
  } else if (rooms <= 5) {
    rate = isLarge ? 40 : 30
  } else if (rooms <= 8) {
    rate = isLarge ? 60 : 40
  } else {
    rate = (isLarge ? 60 : 40) + 10 * (rooms - 8)
  }

  res.json({ rate })
})

// Appointments ------------------------------------
app.get('/appointments', async (req: Request, res: Response) => {
  await ensureRecurringFuture()
  const dateStr = String(req.query.date || '')
  if (!dateStr) return res.status(400).json({ error: 'date required' })
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) {
    return res.status(400).json({ error: 'invalid date' })
  }
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
  try {
    const appts = await prisma.appointment.findMany({
      where: {
        date: { gte: date, lt: next },
        status: { notIn: ['DELETED', 'RESCHEDULE_OLD'] },
      },
      orderBy: { time: 'asc' },
      include: { client: true, employees: true },
    })
    res.json(appts)
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch appointments' })
  }
})

app.get('/appointments/lineage/:lineage', async (req: Request, res: Response) => {
  const { lineage } = req.params
  try {
    const appts = await prisma.appointment.findMany({
      where: { lineage },
      orderBy: { date: 'asc' },
      include: { client: true, employees: true },
    })
    res.json(appts)
  } catch {
    res.status(500).json({ error: 'Failed to fetch lineage appointments' })
  }
})

app.post('/appointments/recurring', async (req: Request, res: Response) => {
  try {
    const {
      clientId,
      templateId,
      date,
      time,
      hours,
      employeeIds = [],
      adminId,
      paid = false,
      paymentMethod = 'CASH',
      paymentMethodNote,
      tip = 0,
      carpetRooms,
      count = 1,
      frequency,
    } = req.body as {
      clientId?: number
      templateId?: number
      date?: string
      time?: string
      hours?: number
      employeeIds?: number[]
      adminId?: number
      paid?: boolean
      paymentMethod?: string
      paymentMethodNote?: string
      tip?: number
      carpetRooms?: number
      count?: number
      frequency?: string
    }

    if (!clientId || !templateId || !date || !time || !adminId || !frequency) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    const template = await prisma.appointmentTemplate.findUnique({
      where: { id: templateId },
    })
    if (!template) {
      return res.status(400).json({ error: 'Invalid templateId' })
    }

    const lineage = crypto.randomUUID()
    const first = new Date(date)
    const created: any[] = []
    for (let i = 0; i < count; i++) {
      const d = new Date(first)
      if (frequency === 'WEEKLY') d.setDate(d.getDate() + i * 7)
      else if (frequency === 'BIWEEKLY') d.setDate(d.getDate() + i * 14)
      else if (frequency === 'EVERY3') d.setDate(d.getDate() + i * 21)
      else if (frequency === 'MONTHLY') d.setMonth(d.getMonth() + i)
      else {
        const m = parseInt(String(req.body.months || 1), 10)
        d.setMonth(d.getMonth() + i * (isNaN(m) ? 1 : m))
      }
      const appt = await prisma.appointment.create({
        data: {
          clientId,
          adminId,
          date: d,
          time,
          type: template.type,
          address: template.address,
          cityStateZip: template.cityStateZip,
          size: template.size,
          hours: hours ?? null,
          price: template.price,
          paid,
          tip,
          carpetRooms: carpetRooms ?? null,
          paymentMethod: paymentMethod as any,
          notes: paymentMethodNote || undefined,
          status: 'REOCCURRING',
          lineage,
          reoccurring: true,
          ...(employeeIds.length > 0 && {
            employees: {
              connect: employeeIds.map((id) => ({ id })),
            },
          }),
        },
      })
      created.push(appt)
    }

    res.json(created)
  } catch (err) {
    console.error('Error creating recurring appointments:', err)
    res.status(500).json({ error: 'Failed to create recurring appointments' })
  }
})

app.post('/appointments', async (req: Request, res: Response) => {
  try {
    const {
      clientId,
      templateId,
      date,
      time,
      hours,
      employeeIds = [],
      adminId,
      paid = false,
      paymentMethod = 'CASH',
      paymentMethodNote,
      tip = 0,
      carpetRooms,
      status = 'APPOINTED',
    } = req.body as {
      clientId?: number
      templateId?: number
      date?: string
      time?: string
      hours?: number
      employeeIds?: number[]
      adminId?: number
      paid?: boolean
      paymentMethod?: string
      paymentMethodNote?: string
      tip?: number
      carpetRooms?: number
      status?: string
    }

    // required-field guard
    if (!clientId || !templateId || !date || !time || !adminId) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    const template = await prisma.appointmentTemplate.findUnique({
      where: { id: templateId },
    })
    if (!template) {
      return res.status(400).json({ error: 'Invalid templateId' })
    }

    const appt = await prisma.appointment.create({
      data: {
        clientId,              // scalar shortcut instead of nested connect
        adminId,               // same here
        date: new Date(date),
        time,
        type: template.type,
        address: template.address,
        cityStateZip: template.cityStateZip,
        size: template.size,
        hours: hours ?? null,
        price: template.price,
        paid,
        tip,
        carpetRooms: carpetRooms ?? null,
        paymentMethod: paymentMethod as any, // or cast to your enum
        notes: paymentMethodNote || undefined,
        status: status as any,
        lineage: 'single',
        // only include the relation if there are IDs
        ...(employeeIds.length > 0 && {
          employees: {
            connect: employeeIds.map((id) => ({ id })),
          },
        }),
      },
    })

    return res.json(appt)
  } catch (err) {
    console.error('Error creating appointment:', err)
    return res.status(500).json({ error: 'Failed to create appointment' })
  }
})

app.put('/appointments/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10)
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' })
  try {
    const {
      clientId,
      templateId,
      date,
      time,
      hours,
      employeeIds,
      adminId,
      paid,
      paymentMethod,
      paymentMethodNote,
      tip,
      status,
      observe,
      carpetRooms,
    } = req.body as {
      clientId?: number
      templateId?: number
      date?: string
      time?: string
      hours?: number
      employeeIds?: number[]
      adminId?: number
      paid?: boolean
      paymentMethod?: string
      paymentMethodNote?: string
      tip?: number
      status?: string
      observe?: boolean
      carpetRooms?: number
    }
    const data: any = {}
    if (clientId !== undefined) data.clientId = clientId
    if (templateId !== undefined) {
      const template = await prisma.appointmentTemplate.findUnique({
        where: { id: templateId },
      })
      if (!template) return res.status(400).json({ error: 'Invalid templateId' })
      data.type = template.type
      data.address = template.address
      data.cityStateZip = template.cityStateZip ?? undefined
      data.size = template.size ?? undefined
      data.price = template.price
    }
    if (date !== undefined) data.date = new Date(date)
    if (time !== undefined) data.time = time
    if (hours !== undefined) data.hours = hours
    if (adminId !== undefined) data.adminId = adminId
    if (paid !== undefined) data.paid = paid
    if (paymentMethod !== undefined) data.paymentMethod = paymentMethod as any
    if (paymentMethodNote !== undefined) data.notes = paymentMethodNote
    if (tip !== undefined) data.tip = tip
    if (status !== undefined) data.status = status as any
    if (observe !== undefined) data.observe = observe
    if (carpetRooms !== undefined) data.carpetRooms = carpetRooms
    if (employeeIds) {
      data.employees = { set: employeeIds.map((id) => ({ id })) }
    }
    const future = req.query.future === 'true'
    const current = await prisma.appointment.findUnique({ where: { id }, include: { employees: true, client: true } })
    if (!current) return res.status(404).json({ error: 'Not found' })

    const convertToRecurring =
      current.lineage === 'single' && (data.status === 'REOCCURRING' || req.body.reoccurring)
    if (convertToRecurring) {
      const lineage = crypto.randomUUID()
      const updated = await prisma.appointment.update({
        where: { id: current.id },
        data: { ...data, lineage, reoccurring: true },
        include: { employees: true, client: true },
      })

      const frequency: string = req.body.frequency || 'WEEKLY'
      const months = parseInt(String(req.body.months || 1), 10)
      const results: any[] = [updated]
      let last: any = updated
      for (let i = 1; i < 10; i++) {
        const nextDate = new Date(last.date)
        if (frequency === 'BIWEEKLY') nextDate.setDate(nextDate.getDate() + 14)
        else if (frequency === 'EVERY3') nextDate.setDate(nextDate.getDate() + 21)
        else if (frequency === 'MONTHLY') nextDate.setMonth(nextDate.getMonth() + 1)
        else if (frequency === 'CUSTOM') nextDate.setMonth(nextDate.getMonth() + months)
        else nextDate.setDate(nextDate.getDate() + 7)

        last = await prisma.appointment.create({
          data: {
            clientId: last.clientId,
            adminId: last.adminId,
            date: nextDate,
            time: last.time,
            type: last.type,
            address: last.address,
            cityStateZip: last.cityStateZip ?? undefined,
            size: last.size ?? undefined,
            hours: last.hours ?? null,
            price: last.price ?? null,
            paid: last.paid,
            tip: last.tip,
            carpetRooms: last.carpetRooms ?? null,
            paymentMethod: last.paymentMethod,
            notes: last.notes ?? undefined,
            status: 'REOCCURRING',
            lineage,
            reoccurring: true,
            ...(last.employees.length && {
              employees: {
                connect: last.employees.map((e: { id: number }) => ({ id: e.id })),
              },
            }),
          },
          include: { employees: true },
        })
        results.push(last)
      }
      return res.json(results)
    }

    if (future && current.lineage !== 'single') {
      function toMinutes(t: string) {
        const [h, m] = t.split(':').map(Number)
        return h * 60 + m
      }
      function minutesToTime(m: number) {
        const hh = Math.floor(((m % 1440) + 1440) % 1440 / 60)
        const mm = Math.floor(((m % 1440) + 1440) % 1440 % 60)
        return `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`
      }

      const dateDiff = data.date ? new Date(data.date).getTime() - current.date.getTime() : 0
      const timeDiff = data.time ? toMinutes(data.time) - toMinutes(current.time) : 0
      const base: any = { ...data }
      delete base.date
      delete base.time

      const targets = await prisma.appointment.findMany({
        where: { lineage: current.lineage, date: { gte: current.date } },
        orderBy: { date: 'asc' },
        include: { employees: true },
      })

      if (targets.length <= 1) {
        const prev = await prisma.appointment.findFirst({
          where: {
            lineage: current.lineage,
            status: { notIn: ['DELETED', 'CANCEL'] },
            date: { lt: current.date },
          },
          orderBy: { date: 'desc' },
        })

        const newLineage = crypto.randomUUID()
        const updated = await prisma.appointment.update({
          where: { id: current.id },
          data: { ...data, lineage: newLineage, reoccurring: true },
          include: { client: true, employees: true },
        })

        const results: any[] = [updated]
        if (prev) {
          const diffDays = Math.round((updated.date.getTime() - prev.date.getTime()) / 86400000)
          const diffMonths =
            updated.date.getMonth() - prev.date.getMonth() +
            12 * (updated.date.getFullYear() - prev.date.getFullYear())
          const byMonth = diffDays > 25 || diffMonths > 0

          let last: any = updated
          for (let i = 1; i < 10; i++) {
            const nextDate = new Date(last.date)
            if (byMonth) nextDate.setMonth(nextDate.getMonth() + diffMonths)
            else nextDate.setDate(nextDate.getDate() + diffDays)

            last = await prisma.appointment.create({
              data: {
                clientId: last.clientId,
                adminId: last.adminId,
                date: nextDate,
                time: last.time,
                type: last.type,
                address: last.address,
                cityStateZip: last.cityStateZip ?? undefined,
                size: last.size ?? undefined,
                hours: last.hours ?? null,
                price: last.price ?? null,
                paid: last.paid,
                tip: last.tip,
                carpetRooms: last.carpetRooms ?? null,
                paymentMethod: last.paymentMethod,
                notes: last.notes ?? undefined,
                status: 'REOCCURRING',
                lineage: newLineage,
                reoccurring: true,
                ...(last.employees.length && {
                  employees: {
                    connect: last.employees.map((e: { id: number }) => ({ id: e.id })),
                  },
                }),
              },
              include: { employees: true },
            })
            results.push(last)
          }
        }
        res.json(results)
      } else {
        for (const appt of targets) {
          const newDate = data.date ? new Date(appt.date.getTime() + dateDiff) : appt.date
          const newTime = data.time ? minutesToTime(toMinutes(appt.time) + timeDiff) : appt.time
          await prisma.appointment.update({
            where: { id: appt.id },
            data: { ...base, date: newDate, time: newTime },
          })
        }

        const appts = await prisma.appointment.findMany({
          where: { lineage: current.lineage, date: { gte: current.date } },
          include: { client: true, employees: true },
          orderBy: { date: 'asc' },
        })
        res.json(appts)
      }
    } else {
      const appt = await prisma.appointment.update({
        where: { id },
        data,
        include: { client: true, employees: true },
      })
      res.json(appt)
    }
  } catch (e) {
    console.error('Error updating appointment:', e)
    res.status(500).json({ error: 'Failed to update appointment' })
  }
})

// Create invoice entry
app.post('/invoices', async (req: Request, res: Response) => {
  try {
    const {
      clientName,
      billedTo,
      address,
      serviceDate,
      serviceTime,
      serviceType,
      price,
      carpetPrice,
      discount,
      taxPercent,
    } = req.body as {
      clientName?: string
      billedTo?: string
      address?: string
      serviceDate?: string
      serviceTime?: string
      serviceType?: string
      price?: number
      carpetPrice?: number
      discount?: number
      taxPercent?: number
    }
    if (!clientName || !billedTo || !address || !serviceDate || !serviceTime || !serviceType || price === undefined) {
      return res.status(400).json({ error: 'Missing fields' })
    }
    const subtotal = price + (carpetPrice || 0) - (discount || 0)
    const total = subtotal + (taxPercent ? subtotal * (taxPercent / 100) : 0)
    const invoice = await prisma.invoice.create({
      data: {
        clientName,
        billedTo,
        address,
        serviceDate: new Date(serviceDate),
        serviceTime,
        serviceType,
        price,
        carpetPrice: carpetPrice ?? null,
        discount: discount ?? null,
        taxPercent: taxPercent ?? null,
        total,
      },
    })
    res.json({ id: invoice.id })
  } catch (err) {
    console.error('Failed to create invoice:', err)
    res.status(500).json({ error: 'Failed to create invoice' })
  }
})

// Serve invoice PDF
app.get('/invoices/:id/pdf', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const inv = await prisma.invoice.findUnique({ where: { id } })
    if (!inv) return res.status(404).json({ error: 'Not found' })

    const pdf = await PDFDocument.create()
    const page = pdf.addPage()
    const font = await pdf.embedFont(StandardFonts.Helvetica)

    const logoPath = path.join(__dirname, '../../client/public/logo.png')
    if (fs.existsSync(logoPath)) {
      const imgBytes = fs.readFileSync(logoPath)
      const png = await pdf.embedPng(imgBytes)
      const dims = png.scale(0.25)
      page.drawImage(png, {
        x: 40,
        y: page.getHeight() - dims.height - 30,
        width: dims.width,
        height: dims.height,
      })
    }

    let y = page.getHeight() - 120
    const draw = (text: string, size = 12, color = rgb(0, 0, 0)) => {
      page.drawText(text, { x: 40, y, size, font, color })
      y -= size + 8
    }

    const blue = rgb(0.2, 0.3, 0.6)
    draw('Evidence Cleaning', 18, blue)
    draw('850 E desert inn rd')
    draw(`Invoice #: ${inv.id}`)
    draw(`Date of Issue: ${new Date().toISOString().slice(0, 10)}`)
    y -= 10

    draw('Billing Information', 14, blue)
    draw(`Billed to: ${inv.billedTo}`)
    draw(`Address: ${inv.address}`)
    y -= 6

    draw('Service Details', 14, blue)
    draw(`Service Date: ${inv.serviceDate.toISOString().slice(0,10)} ${inv.serviceTime}`)
    draw(`Service Type: ${inv.serviceType}`)
    y -= 6

    draw('Charges', 14, blue)
    const charges: [string, number][] = []
    charges.push(['Service', Number(inv.price)])
    if (inv.carpetPrice != null) charges.push(['Carpet', Number(inv.carpetPrice)])
    if (inv.discount != null) charges.push(['Discount', -Number(inv.discount)])
    if (inv.taxPercent != null) {
      const sub = Number(inv.price) + (inv.carpetPrice ?? 0) - (inv.discount ?? 0)
      charges.push(['Tax', sub * (Number(inv.taxPercent) / 100)])
    }
    const columnX = page.getWidth() - 150
    charges.forEach(([label, val]) => {
      page.drawRectangle({ x: 40, y: y - 4, width: page.getWidth() - 80, height: 18, color: rgb(0.95, 0.95, 0.95) })
      page.drawText(label, { x: 44, y, size: 12, font })
      page.drawText(`$${val.toFixed(2)}`, { x: columnX, y, size: 12, font })
      y -= 22
    })
    y -= 4
    draw('Total', 14, blue)
    page.drawText(`$${Number(inv.total).toFixed(2)}`, { x: columnX, y, size: 14, font })
    const bytes = await pdf.save()
    res.setHeader('Content-Type', 'application/pdf')
    res.send(Buffer.from(bytes))
  } catch (err) {
    console.error('Failed to generate invoice PDF:', err)
    res.status(500).json({ error: 'Failed to generate PDF' })
  }
})

app.post('/login', async (req: Request, res: Response) => {
  const { token, code } = req.body as { token?: string; code?: string }
  if (!token && !code) {
    return res.status(400).json({ error: 'Missing token or code' })
  }
  try {
    let email: string | undefined
    let name: string | undefined

    if (code) {
      const { tokens } = await client.getToken({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5173',
      })
      if (tokens.id_token) {
        const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: process.env.GOOGLE_CLIENT_ID })
        const payload = ticket.getPayload()
        email = payload?.email
        name = payload?.name || undefined
      } else if (tokens.access_token) {
        const resp = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        })
        email = resp.data.email
        name = resp.data.name
      }
    } else if (token) {
      if (token.includes('.')) {
        const ticket = await client.verifyIdToken({ idToken: token, audience: process.env.GOOGLE_CLIENT_ID })
        const payload = ticket.getPayload()
        email = payload?.email
        name = payload?.name || undefined
      } else {
        const resp = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${token}` },
        })
        email = resp.data.email
        name = resp.data.name
      }
    }

    if (!email) {
      return res.status(400).json({ error: 'Invalid token' })
    }

    const user = await prisma.user.upsert({
      where: { email },
      update: { name: name || undefined },
      create: { email, name: name || undefined, role: 'EMPLOYEE' },
    })

    res.json({ role: user.role, user })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Authentication failed' })
  }
})

// 404 handler for unmatched routes
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' })
})

// Error handler to ensure JSON responses
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
})

const keyPath = process.env.SSL_KEY_PATH
const certPath = process.env.SSL_CERT_PATH

if (keyPath && certPath) {
  const key = fs.readFileSync(path.resolve(keyPath))
  const cert = fs.readFileSync(path.resolve(certPath))
  https.createServer({ key, cert }, app).listen(port, () => {
    console.log(`HTTPS server listening on port ${port}`)
  })
} else {
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`)
  })
}

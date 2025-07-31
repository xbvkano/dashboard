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
import { PDFDocument, StandardFonts, rgb, PDFFont, degrees } from 'pdf-lib'
import nodemailer from 'nodemailer'
import twilio from 'twilio'

async function ensureRecurringFuture() {
  return
}

import { staffOptionsData } from './data/staffOptions'
dotenv.config()

const prisma = new PrismaClient()
const app = express()
const port = process.env.PORT || 3000
const smsClient = twilio(
  process.env.TWILIO_ACCOUNT_SID || '',
  process.env.TWILIO_AUTH_TOKEN || '',
)

function parseSqft(s: string | null | undefined): number | null {
  if (!s) return null
  const parts = s.split('-')
  let n = parseInt(parts[1] || parts[0])
  if (isNaN(n)) n = parseInt(s)
  return isNaN(n) ? null : n
}

function calculatePayRate(type: string, size: string | null, count: number): number {
  const parseSize = (s: string): number | null => {
    if (!s) return null
    const parts = s.split('-')
    let n = parseInt(parts[1] || parts[0])
    if (isNaN(n)) n = parseInt(s)
    return isNaN(n) ? null : n
  }
  const sqft = size ? parseSize(size) : null
  const isLarge = sqft != null && sqft > 2500
  if (type === 'STANDARD') return isLarge ? 100 : 80
  if (type === 'DEEP' || type === 'MOVE_IN_OUT') {
    if (isLarge) return 100
    return count === 1 ? 100 : 90
  }
  return 0
}

function calculateCarpetRate(size: string, rooms: number): number {
  const sqft = parseSqft(size)
  if (sqft === null) return 0
  const isLarge = sqft > 2500
  if (rooms === 1) return isLarge ? 20 : 10
  if (rooms <= 3) return isLarge ? 30 : 20
  if (rooms <= 5) return isLarge ? 40 : 30
  if (rooms <= 8) return isLarge ? 60 : 40
  return (isLarge ? 60 : 40) + 10 * (rooms - 8)
}

async function syncPayrollItems(apptId: number, employeeIds: number[]) {
  const existing = await prisma.payrollItem.findMany({ where: { appointmentId: apptId } })
  const existingIds = existing.map((p: { employeeId: number }) => p.employeeId)
  const toAdd = employeeIds.filter((id) => !existingIds.includes(id))
  const toRemove = existing.filter((p: { employeeId: number }) => !employeeIds.includes(p.employeeId))
  if (toAdd.length) {
    await prisma.payrollItem.createMany({ data: toAdd.map((id: number) => ({ appointmentId: apptId, employeeId: id })) })
  }
  if (toRemove.length) {
    await prisma.payrollItem.deleteMany({ where: { id: { in: toRemove.map((p: { id: number }) => p.id) } } })
  }
}

const client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5173'
)

async function generateInvoicePdf(inv: any): Promise<Buffer> {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)

  const width = page.getWidth()
  const height = page.getHeight()
  const margin = 40
  const contentWidth = width - margin * 2

  const darkBlue = rgb(0.05, 0.2, 0.45)
  const lightBlue = rgb(0.3, 0.55, 0.85)
  const gray = rgb(0.93, 0.93, 0.93)

  let y = height - margin
  let infoX = margin

  try {
    const logoPath = path.resolve(__dirname, '..', '..', 'client', 'public', 'logo.png')
    const logoBytes = fs.readFileSync(logoPath)
    const logoImg = await pdf.embedPng(logoBytes)
    const logoWidth = 80
    const scale = logoWidth / logoImg.width
    const logoHeight = logoImg.height * scale
    page.drawImage(logoImg, {
      x: margin,
      y: y - logoHeight,
      width: logoWidth,
      height: logoHeight,
    })
    infoX = margin + logoWidth + 10
    page.drawText('Evidence Cleaning', {
      x: infoX,
      y: y - 20,
      size: 22,
      font: bold,
      color: lightBlue,
    })
  } catch (err) {
    page.drawText('Evidence Cleaning', { x: margin, y: y - 20, size: 22, font: bold, color: lightBlue })
  }

  if (inv.paid === false) {
    const wm = 'NOT PAID'
    const size = 80
    const wmWidth = bold.widthOfTextAtSize(wm, size)
    page.drawText(wm, {
      x: width / 2 - wmWidth / 2,
      y: height / 2,
      size,
      font: bold,
      color: rgb(1, 0, 0),
      rotate: degrees(45),
      opacity: 0.3,
    })
  }

  // Section 1 - company / invoice info
  const companyInfo = [
    '850 E desert inn rd',
    'Las Vegas, NV, 89109',
    'Phone: 725-577-4523',
    'Email: contact@worldwideevidence.com',
    'Website: www.worldwideevidence.com',
  ]
  let infoY = y - 40
  companyInfo.forEach((l) => {
    page.drawText(l, { x: infoX, y: infoY, size: 10, font })
    infoY -= 12
  })

  const idDigits = BigInt('0x' + inv.id.replace(/-/g, '')).toString().slice(-20)
  page.drawText('INVOICE', { x: width - margin - 120, y: y - 20, size: 26, font: bold, color: rgb(0.5, 0.7, 0.9) })
  page.drawText(`Date of issue: ${inv.createdAt.toISOString().slice(0, 10)}`, { x: width - margin - 200, y: y - 50, size: 10, font })
  page.drawText(`Invoice # ${idDigits}`, { x: width - margin - 200, y: y - 62, size: 10, font })
  page.drawText(`Service date: ${inv.serviceDate.toISOString().slice(0, 10)}`, { x: width - margin - 200, y: y - 74, size: 10, font })

  y = infoY - 20

  // Section 2 - Bill to
  const secHeader = 18
  const secBody = 34
  page.drawRectangle({ x: margin, y: y - secHeader - secBody, width: contentWidth, height: secHeader + secBody, color: rgb(1, 1, 1) })
  page.drawRectangle({ x: margin, y: y - secHeader, width: contentWidth, height: secHeader, color: darkBlue })
  page.drawText('Bill to', { x: margin + 6, y: y - 13, size: 12, font: bold, color: rgb(1, 1, 1) })
  page.drawText(`Name: ${inv.billedTo}`, { x: margin + 6, y: y - secHeader - 14, size: 11, font })
  page.drawText(`Address: ${inv.address}`, { x: margin + 6, y: y - secHeader - 26, size: 11, font })

  y = y - secHeader - secBody - 20

  // Section 3 - Table
  const tableHeaderHeight = 20
  const rowHeight = 18
  const rows = 16
  const descWidth = contentWidth * 0.6
  const taxWidth = contentWidth * 0.1
  const amtWidth = contentWidth * 0.3

  // header
  page.drawRectangle({ x: margin, y: y - tableHeaderHeight, width: contentWidth, height: tableHeaderHeight, color: darkBlue })
  page.drawText('Description', { x: margin + descWidth / 2 - 30, y: y - 14, font: bold, size: 12, color: rgb(1, 1, 1) })
  page.drawText('Taxed', { x: margin + descWidth + taxWidth / 2 - 15, y: y - 14, font: bold, size: 12, color: rgb(1, 1, 1) })
  page.drawText('Amount', { x: margin + descWidth + taxWidth + amtWidth / 2 - 20, y: y - 14, font: bold, size: 12, color: rgb(1, 1, 1) })

  // rows background
  const tableBottom = y - tableHeaderHeight - rowHeight * rows
  for (let i = 0; i < rows; i++) {
    const ry = y - tableHeaderHeight - rowHeight * i
    page.drawRectangle({ x: margin, y: ry - rowHeight, width: contentWidth, height: rowHeight, color: i % 2 ? gray : rgb(1, 1, 1) })
  }

  // column lines (not in header)
  page.drawLine({ start: { x: margin + descWidth, y: y - tableHeaderHeight }, end: { x: margin + descWidth, y: tableBottom }, thickness: 1, color: rgb(0, 0, 0) })
  page.drawLine({ start: { x: margin + descWidth + taxWidth, y: y - tableHeaderHeight }, end: { x: margin + descWidth + taxWidth, y: tableBottom }, thickness: 1, color: rgb(0, 0, 0) })

  const services: { d: string; a: number }[] = []
  services.push({ d: inv.serviceType, a: Number(inv.price) })
  if (inv.carpetPrice != null) services.push({ d: 'Carpet Cleaning', a: Number(inv.carpetPrice) })

  services.forEach((s, idx) => {
    const ry = y - tableHeaderHeight - rowHeight * idx - rowHeight + 5
    page.drawText(s.d, { x: margin + 4, y: ry, font, size: 11 })
    page.drawText(`$${s.a.toFixed(2)}`, { x: margin + descWidth + taxWidth + 4, y: ry, font, size: 11 })
  })

  y = tableBottom - 20

  // Section 4 - totals and comments
  const sub = Number(inv.price) + (inv.carpetPrice ?? 0)
  const taxable = inv.taxPercent ? sub * (inv.taxPercent / 100) : 0
  const other = inv.discount ?? 0
  const texts: [string, string][] = [
    ['Subtotal:', `$${sub.toFixed(2)}`],
    ['Taxable:', `$${taxable.toFixed(2)}`],
    ['Other:', `$${other.toFixed(2)}`],
    ['Total:', `$${Number(inv.total).toFixed(2)}`],
  ]
  let tY = y
  const totalsValX = margin + descWidth + taxWidth + 4
  const totalsLabelX = totalsValX - 80
  texts.forEach(([l, v]) => {
    page.drawText(l, { x: totalsLabelX, y: tY, font: bold, size: 11 })
    page.drawText(v, { x: totalsValX, y: tY, font, size: 11 })
    tY -= 14
  })

  y = tY - 20

  page.drawRectangle({ x: margin, y: y - 60 - secHeader, width: contentWidth, height: 60 + secHeader, color: rgb(1, 1, 1) })
  page.drawRectangle({ x: margin, y: y - secHeader, width: contentWidth, height: secHeader, color: darkBlue })
  page.drawText('Other comments', { x: margin + 6, y: y - 13, font: bold, size: 12, color: rgb(1, 1, 1) })
  if (inv.comment) {
    page.drawText(String(inv.comment), { x: margin + 6, y: y - secHeader - 14, font, size: 11 })
  }

  y = y - 60 - secHeader - 30

  const qText = 'If you have any questions about this invoice, please contact'
  const cText = 'Marcelo Kano, contact@worldwideevidence.com'
  const tText = 'Thank You For Your Business!'
  const centerX = (txt: string, size: number, f: PDFFont) =>
    margin + contentWidth / 2 - f.widthOfTextAtSize(txt, size) / 2
  page.drawText(qText, { x: centerX(qText, 11, font), y, font, size: 11 })
  page.drawText(cText, { x: centerX(cText, 11, font), y: y - 14, font, size: 11 })
  page.drawText(tText, { x: centerX(tText, 12, bold), y: y - 28, font: bold, size: 12 })

  const bytes = await pdf.save()
  return Buffer.from(bytes)
}

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
  const includeDisabled = String(req.query.all) === 'true'

  // 2. Build a typed `where` clause
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
    const { name, number, notes, disabled } = req.body as {
      name?: string
      number?: string
      notes?: string
      disabled?: boolean
    }
    if (!name || !number) {
      return res.status(400).json({ error: 'Name and number are required' })
    }
    if (!/^\d{10}$/.test(number)) {
      return res.status(400).json({ error: 'Number must be 10 digits' })
    }
    const client = await prisma.client.create({
      data: { name, number, notes, disabled: disabled ?? false },
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
    const { name, number, notes, disabled } = req.body as {
      name?: string
      number?: string
      notes?: string
      disabled?: boolean
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
    if (disabled !== undefined) data.disabled = disabled
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
})

app.post('/employees', async (req: Request, res: Response) => {
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
    if (!/^\d{10}$/.test(number)) {
      return res.status(400).json({ error: 'Number must be 10 digits' })
    }
    const employee = await prisma.employee.create({
      data: {
        name,
        number,
        notes,
        experienced: experienced ?? false,
        disabled: disabled ?? false,
      },
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
      if (!/^\d{10}$/.test(number)) {
        return res.status(400).json({ error: 'Number must be 10 digits' })
      }
      data.number = number
    }
    if (notes !== undefined) data.notes = notes
    if (experienced !== undefined) data.experienced = experienced
    if (disabled !== undefined) data.disabled = disabled
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

app.get('/appointments/no-team', async (_req: Request, res: Response) => {
  try {
    const appts = await prisma.appointment.findMany({
      where: {
        noTeam: true,
        status: { notIn: ['DELETED', 'RESCHEDULE_OLD', 'CANCEL'] },
      },
      orderBy: [{ date: 'asc' }, { time: 'asc' }],
      include: { client: true, employees: true },
    })
    res.json(appts)
  } catch (err) {
    console.error('Failed to fetch no-team appointments:', err)
    res.status(500).json({ error: 'Failed to fetch appointments' })
  }
})

app.get('/appointments/upcoming-recurring', async (_req: Request, res: Response) => {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const next = new Date(today)
    next.setDate(next.getDate() + 7)
    const appts = await prisma.appointment.findMany({
      where: {
        reoccurring: true,
        reocuringDate: { gte: today, lte: next },
        status: { notIn: ['DELETED', 'CANCEL'] },
      },
      orderBy: { reocuringDate: 'asc' },
      include: { client: true, employees: true },
    })
    const results = appts.map((a: any) => ({
      ...a,
      daysLeft: Math.ceil((a.reocuringDate!.getTime() - today.getTime()) / 86400000),
    }))
    res.json(results)
  } catch (err) {
    console.error('Failed to fetch upcoming recurring appointments:', err)
    res.status(500).json({ error: 'Failed to fetch appointments' })
  }
})

app.put('/appointments/:id/recurring-done', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10)
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' })
  const done = !!(req.body as any).done
  try {
    const appt = await prisma.appointment.update({
      where: { id },
      data: { recurringDone: done },
      include: { client: true, employees: true },
    })
    res.json(appt)
  } catch (err) {
    console.error('Failed to update recurringDone:', err)
    res.status(500).json({ error: 'Failed to update appointment' })
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
      carpetPrice,
      carpetEmployees = [],
      count = 1,
      frequency,
      noTeam = false,
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
      carpetPrice?: number
      carpetEmployees?: number[]
      count?: number
      frequency?: string
      noTeam?: boolean
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
    const nextDate = new Date(first)
    if (frequency === 'WEEKLY') nextDate.setDate(nextDate.getDate() + 7)
    else if (frequency === 'BIWEEKLY') nextDate.setDate(nextDate.getDate() + 14)
    else if (frequency === 'EVERY3') nextDate.setDate(nextDate.getDate() + 21)
    else if (frequency === 'MONTHLY') nextDate.setMonth(nextDate.getMonth() + 1)
    else {
      const m = parseInt(String(req.body.months || 1), 10)
      nextDate.setMonth(nextDate.getMonth() + (isNaN(m) ? 1 : m))
    }
    const carpetRoomsFinal =
      carpetRooms !== undefined ? carpetRooms : template.carpetRooms ?? null
    let finalCarpetPrice = carpetPrice
    if (finalCarpetPrice === undefined) {
      if (template.carpetPrice != null && carpetRoomsFinal) {
        finalCarpetPrice = template.carpetPrice
      } else if (carpetRoomsFinal && template.size) {
        const sqft = parseSqft(template.size)
        if (sqft !== null) {
          finalCarpetPrice = carpetRoomsFinal * (sqft >= 4000 ? 40 : 35)
        }
      }
    }
    const appt = await prisma.appointment.create({
      data: {
        clientId,
        adminId,
        date: first,
        time,
        type: template.type,
        address: template.address,
        cityStateZip: template.instructions ?? undefined,
        size: template.size,
        hours: hours ?? null,
        price: template.price,
        paid,
        tip,
        noTeam,
        carpetRooms: carpetRoomsFinal,
        carpetPrice: finalCarpetPrice ?? null,
        carpetEmployees,
        paymentMethod: paymentMethod as any,
        notes:
          [template.notes, paymentMethodNote].filter(Boolean).join(' | ') ||
          undefined,
        status: 'REOCCURRING',
        lineage,
        reoccurring: true,
        reocuringDate: nextDate,
        ...(employeeIds.length > 0 && {
          employees: {
            connect: employeeIds.map((id) => ({ id })),
          },
        }),
      },
    })
    if (!noTeam && employeeIds.length) {
      await syncPayrollItems(appt.id, employeeIds)
    }

    res.json(appt)
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
      carpetPrice,
      carpetEmployees = [],
      status = 'APPOINTED',
      observation,
      noTeam = false,
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
      carpetPrice?: number
      carpetEmployees?: number[]
      status?: string
      observation?: string
      noTeam?: boolean
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

    const carpetRoomsFinal =
      carpetRooms !== undefined ? carpetRooms : template.carpetRooms ?? null
    let finalCarpetPrice = carpetPrice
    if (finalCarpetPrice === undefined) {
      if (template.carpetPrice != null && carpetRoomsFinal) {
        finalCarpetPrice = template.carpetPrice
      } else if (carpetRoomsFinal && template.size) {
        const sqft = parseSqft(template.size)
        if (sqft !== null) {
          finalCarpetPrice = carpetRoomsFinal * (sqft >= 4000 ? 40 : 35)
        }
      }
    }

    const appt = await prisma.appointment.create({
      data: {
        clientId,              // scalar shortcut instead of nested connect
        adminId,               // same here
        date: new Date(date),
        time,
        type: template.type,
        address: template.address,
        cityStateZip: template.instructions ?? undefined,
        size: template.size,
        hours: hours ?? null,
        price: template.price,
        paid,
        tip,
        noTeam,
        carpetRooms: carpetRoomsFinal,
        carpetPrice: finalCarpetPrice ?? null,
        carpetEmployees,
        paymentMethod: paymentMethod as any, // or cast to your enum
        notes:
          [template.notes, paymentMethodNote].filter(Boolean).join(' | ') ||
          undefined,
        observation: observation ?? undefined,
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

    if (!noTeam && employeeIds.length) {
      await syncPayrollItems(appt.id, employeeIds)
    }

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
      carpetPrice,
      carpetEmployees,
      observation,
      noTeam = false,
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
      carpetPrice?: number
      carpetEmployees?: number[]
      observation?: string | null
      noTeam?: boolean
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
      data.cityStateZip = template.instructions ?? undefined
      data.size = template.size ?? undefined
      data.price = template.price
      data.notes = template.notes ?? data.notes
      if (carpetRooms === undefined && template.carpetRooms != null) {
        data.carpetRooms = template.carpetRooms
      }
      if (carpetPrice === undefined) {
        if (template.carpetPrice != null) {
          data.carpetPrice = template.carpetPrice
        } else if (
          (data.carpetRooms ?? template.carpetRooms) != null &&
          template.size
        ) {
          const cr = data.carpetRooms ?? template.carpetRooms
          const sqft = parseSqft(template.size)
          if (sqft !== null) {
            data.carpetPrice = cr * (sqft >= 4000 ? 40 : 35)
          }
        }
      }
    }
    if (date !== undefined) data.date = new Date(date)
    if (time !== undefined) data.time = time
    if (hours !== undefined) data.hours = hours
    if (adminId !== undefined) data.adminId = adminId
    if (paid !== undefined) data.paid = paid
    if (paymentMethod !== undefined) data.paymentMethod = paymentMethod as any
    if (paymentMethodNote !== undefined) data.notes = paymentMethodNote
    if (tip !== undefined) data.tip = tip
    if (noTeam !== undefined) data.noTeam = noTeam
    if (observation !== undefined) data.observation = observation
    if (status !== undefined) data.status = status as any
    if (observe !== undefined) data.observe = observe
    if (carpetRooms !== undefined) data.carpetRooms = carpetRooms
    if (carpetPrice !== undefined) data.carpetPrice = carpetPrice
    if (carpetEmployees !== undefined) data.carpetEmployees = carpetEmployees
    if (employeeIds) {
      data.employees = { set: employeeIds.map((id) => ({ id })) }
    }

    if (observe === false ||
        (status && ['CANCEL', 'RESCHEDULE_OLD', 'DELETED'].includes(status))) {
      data.observation = null
    }
    const future = req.query.future === 'true'
    const current = await prisma.appointment.findUnique({ where: { id }, include: { employees: true, client: true } })
    if (!current) return res.status(404).json({ error: 'Not found' })

    const convertToRecurring =
      current.lineage === 'single' && (data.status === 'REOCCURRING' || req.body.reoccurring)
    if (convertToRecurring) {
      const lineage = crypto.randomUUID()
      const frequency: string = req.body.frequency || 'WEEKLY'
      const nextDate = new Date(data.date ? new Date(data.date) : current.date)
      if (frequency === 'BIWEEKLY') nextDate.setDate(nextDate.getDate() + 14)
      else if (frequency === 'EVERY3') nextDate.setDate(nextDate.getDate() + 21)
      else if (frequency === 'MONTHLY') nextDate.setMonth(nextDate.getMonth() + 1)
      else if (frequency === 'CUSTOM') {
        const m = parseInt(String(req.body.months || 1), 10)
        nextDate.setMonth(nextDate.getMonth() + (isNaN(m) ? 1 : m))
      } else nextDate.setDate(nextDate.getDate() + 7)

      const updated = await prisma.appointment.update({
        where: { id: current.id },
        data: { ...data, lineage, reoccurring: true, reocuringDate: nextDate },
        include: { employees: true, client: true },
      })
      return res.json(updated)
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
    } else {
      const appt = await prisma.appointment.update({
        where: { id },
        data,
        include: { client: true, employees: true },
      })
      if (employeeIds && !noTeam) {
        await syncPayrollItems(appt.id, employeeIds)
      }
      res.json(appt)
    }
  } catch (e) {
    console.error('Error updating appointment:', e)
    res.status(500).json({ error: 'Failed to update appointment' })
  }
})

app.post('/appointments/:id/send-info', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10)
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' })
  try {
    const note = String((req.body as any).note || '')
    const appt = await prisma.appointment.findUnique({
      where: { id },
      include: { client: true, employees: true },
    })
    if (!appt) return res.status(404).json({ error: 'Not found' })

    const pay = calculatePayRate(appt.type, appt.size ?? null, appt.employees.length || 1)
    const carpetIds = appt.carpetEmployees || []
    const carpetPer =
      appt.carpetRooms && appt.size && carpetIds.length
        ? calculateCarpetRate(appt.size, appt.carpetRooms) / carpetIds.length
        : 0

    for (const e of appt.employees) {
      const body = [
        `New appointment from Evidence Cleaning`,
        `Appointment Date: ${appt.date.toISOString().slice(0, 10)}`,
        `Appointment Time: ${appt.time}`,
        `Appointment Type: ${appt.type}`,
        `Address: ${appt.address}`,
        `Pay: $${(pay + (carpetIds.includes(e.id) ? carpetPer : 0)).toFixed(2)}`,
        appt.cityStateZip ? `Instructions: ${appt.cityStateZip}` : undefined,
        note && `Note: ${note}`,
      ]
        .filter(Boolean)
        .join('\n')

      await smsClient.messages.create({
        to: e.number,
        from: process.env.TWILIO_FROM_NUMBER || '',
        body,
      })
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: { infoSent: true },
      include: { client: true, employees: true },
    })

    res.json(updated)
  } catch (err) {
    console.error('Failed to send appointment info:', err)
    res.status(500).json({ error: 'Failed to send info' })
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
      comment,
      paid,
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
      comment?: string
      paid?: boolean
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
        comment: comment ?? null,
        paid: paid ?? true,
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

    const bytes = await generateInvoicePdf(inv)
    res.setHeader('Content-Type', 'application/pdf')
    res.send(bytes)
  } catch (err) {
    console.error('Failed to generate invoice PDF:', err)
    res.status(500).json({ error: 'Failed to generate PDF' })
  }
})

app.post('/invoices/:id/send', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const email = String((req.body as any).email || '').trim()
    if (!email) return res.status(400).json({ error: 'email required' })
    const inv = await prisma.invoice.findUnique({ where: { id } })
    if (!inv) return res.status(404).json({ error: 'Not found' })

    const attachment = await generateInvoicePdf(inv)

    const transport = nodemailer.createTransport({
      host: process.env.MAILTRAP_HOST,
      port: Number(process.env.MAILTRAP_PORT),
      auth: {
        user: process.env.MAILTRAP_USER,
        pass: process.env.MAILTRAP_API_KEY,
      },
    })

    await transport.sendMail({
      from: process.env.SMTP_FROM || 'no-reply@example.com',
      to: email,
      subject: 'Evidence Cleaning Invoice',
      text:
        'Hello,\n\nthis is an automated message from Evidence Cleaning. Attached is you invoice.\n\nPlease feel free to text Cassia at 725-577-4524 if you have any questions.\nBest,\nEvidence Cleaning.',
      attachments: [
        { filename: 'invoice.pdf', content: attachment },
      ],
    })

    res.json({ ok: true })
  } catch (err) {
    console.error('Failed to send invoice email:', err)
    res.status(500).json({ error: 'Failed to send invoice' })
  }
})

app.get('/revenue', async (_req: Request, res: Response) => {
  try {
    const invoices = await prisma.invoice.findMany({
      orderBy: { serviceDate: 'asc' },
      select: { serviceDate: true, total: true, serviceType: true },
    })
    res.json(
      invoices.map((i: any) => ({
        serviceDate: i.serviceDate.toISOString(),
        total: i.total,
        serviceType: i.serviceType,
      }))
    )
  } catch (err) {
    console.error('Failed to fetch revenue:', err)
    res.status(500).json({ error: 'Failed to fetch revenue' })
  }
})

app.get('/payroll/due', async (_req: Request, res: Response) => {
  const items = await prisma.payrollItem.findMany({
    where: { paid: false },
    include: { appointment: { include: { employees: true } }, employee: true },
  })
  const map: Record<number, any> = {}
  for (const it of items) {
    const e = it.employee
    const appt = it.appointment
    const count = appt.employees.length || 1
    const pay = calculatePayRate(appt.type, appt.size ?? null, count)
    const carpetIds = appt.carpetEmployees || []
    const carpetShare =
      appt.carpetRooms && appt.size && carpetIds.length
        ? calculateCarpetRate(appt.size, appt.carpetRooms) / carpetIds.length
        : 0
    const tip = (appt.tip || 0) / count
    if (!map[e.id]) {
      map[e.id] = { employee: e, items: [], total: e.prevBalance || 0 }
      if (e.prevBalance && e.prevBalance > 0) {
        map[e.id].items.push({ service: 'Previous balance', date: e.lastPaidAt, amount: e.prevBalance, tip: 0 })
      }
    }
    const amount = pay + (carpetIds.includes(e.id) ? carpetShare : 0)
    map[e.id].items.push({ service: appt.type, date: appt.date, amount, tip })
    map[e.id].total += amount + tip
  }
  // include employees that only have a previous balance
  const balancedEmployees = await prisma.employee.findMany({ where: { prevBalance: { gt: 0 } } })
  for (const e of balancedEmployees) {
    if (!map[e.id]) {
      map[e.id] = { employee: e, items: [], total: e.prevBalance }
      map[e.id].items.push({ service: 'Previous balance', date: e.lastPaidAt, amount: e.prevBalance, tip: 0 })
    }
  }
  res.json(Object.values(map))
})

app.get('/payroll/paid', async (_req: Request, res: Response) => {
  const payments = await prisma.employeePayment.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: { employee: true, items: { include: { appointment: true } } },
  })
  res.json(payments)
})

app.post('/payroll/pay', async (req: Request, res: Response) => {
  const { employeeId, amount, extra = 0 } = req.body as { employeeId?: number; amount?: number; extra?: number }
  if (!employeeId || amount == null) {
    return res.status(400).json({ error: 'employeeId and amount required' })
  }
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } })
  if (!employee) return res.status(404).json({ error: 'employee not found' })
  const items = await prisma.payrollItem.findMany({
    where: { employeeId, paid: false },
    include: { appointment: { include: { employees: true } } },
  })
  let totalDue = employee.prevBalance || 0
  for (const it of items) {
    const c = it.appointment.employees.length || 1
    totalDue += calculatePayRate(it.appointment.type, it.appointment.size ?? null, c)
    if (
      it.appointment.carpetRooms &&
      it.appointment.size &&
      it.appointment.carpetEmployees?.length
    ) {
      const share =
        calculateCarpetRate(
          it.appointment.size,
          it.appointment.carpetRooms,
        ) / it.appointment.carpetEmployees.length
      if (it.appointment.carpetEmployees.includes(employeeId)) {
        totalDue += share
      }
    }
    totalDue += (it.appointment.tip || 0) / c
  }
  const payment = await prisma.employeePayment.create({ data: { employeeId, amount, extra } })
  if (items.length) {
    await prisma.payrollItem.updateMany({ where: { id: { in: items.map((i: { id: number }) => i.id) } }, data: { paid: true, paymentId: payment.id } })
  }
  const balance = totalDue - amount
  await prisma.employee.update({ where: { id: employeeId }, data: { prevBalance: balance > 0 ? balance : 0, lastPaidAt: new Date() } })
  res.json({ id: payment.id })
})

app.post('/payroll/chargeback', async (req: Request, res: Response) => {
  const { id } = req.body as { id?: number }
  if (!id) return res.status(400).json({ error: 'id required' })
  const payment = await prisma.employeePayment.findUnique({
    where: { id },
    include: {
      employee: true,
      items: { include: { appointment: { include: { employees: true } } } },
    },
  })
  if (!payment) return res.status(404).json({ error: 'payment not found' })

  let itemsTotal = 0
  for (const it of payment.items) {
    const c = it.appointment.employees.length || 1
    itemsTotal += calculatePayRate(it.appointment.type, it.appointment.size ?? null, c)
    if (
      it.appointment.carpetRooms &&
      it.appointment.size &&
      it.appointment.carpetEmployees?.length
    ) {
      const share =
        calculateCarpetRate(it.appointment.size, it.appointment.carpetRooms) /
        it.appointment.carpetEmployees.length
      if (it.appointment.carpetEmployees.includes(payment.employeeId)) {
        itemsTotal += share
      }
    }
    itemsTotal += (it.appointment.tip || 0) / c
  }

  if (payment.items.length) {
    await prisma.payrollItem.updateMany({
      where: { id: { in: payment.items.map((it: { id: number }) => it.id) } },
      data: { paid: false, paymentId: null },
    })
  }

  const prevBalance = Math.max(
    0,
    (payment.employee.prevBalance || 0) + payment.amount - itemsTotal,
  )

  await prisma.employee.update({
    where: { id: payment.employeeId },
    data: { prevBalance },
  })

  await prisma.employeePayment.delete({ where: { id } })
  res.json({ ok: true })
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

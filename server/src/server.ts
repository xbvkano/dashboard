import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import fs from 'fs'
import https from 'https'
import path from 'path'
import { PrismaClient } from '@prisma/client'
import { OAuth2Client } from 'google-auth-library'
import { PDFDocument, StandardFonts, rgb, PDFFont, degrees } from 'pdf-lib'
import nodemailer from 'nodemailer'
import twilio from 'twilio'
import { uploadInvoiceToDrive } from './drive'

dotenv.config()

const prisma = new PrismaClient()
const app = express()
const port = process.env.PORT || 3000
const smsClient = twilio(
  process.env.TWILIO_ACCOUNT_SID || '',
  process.env.TWILIO_AUTH_TOKEN || '',
)



const client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5173'
)

// test
async function generateInvoicePdf(inv: any, tzOffset = 0): Promise<Buffer> {
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

  const formatDate = (d: Date) => d.toISOString().slice(0, 10)
  const formatDateLocal = (d: Date) =>
    new Date(d.getTime() - tzOffset * 60000)
      .toISOString()
      .slice(0, 10)

  const serviceTypeMap: Record<string, string> = {
    DEEP: 'Deep Cleaning',
    MOVE_IN_OUT: 'Move in/out Cleaning',
    STANDARD: 'Standard Cleaning',
  }

  let y = height - margin
  let infoX = margin

  try {
    const logoPath = path.resolve(__dirname, '..', '..', 'client', 'public', 'logo.png')
    const logoBytes = fs.readFileSync(logoPath)
    const logoImg = await pdf.embedPng(logoBytes)
    const logoWidth = 50
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


  // Section 1 - company / invoice info
  const companyInfo = [
    '850 E Desert Inn Rd',
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

  const invoiceNumber =
    (inv.number as string | undefined) ||
    BigInt('0x' + inv.id.replace(/-/g, '')).toString().slice(-20)
  page.drawText('INVOICE', {
    x: width - margin - 120,
    y: y - 20,
    size: 26,
    font: bold,
    color: rgb(0.5, 0.7, 0.9),
  })
  page.drawText(`Date of issue: ${formatDateLocal(inv.createdAt)}`, {
    x: width - margin - 200,
    y: y - 50,
    size: 10,
    font,
  })
  page.drawText(`Invoice # ${invoiceNumber}`, {
    x: width - margin - 200,
    y: y - 62,
    size: 10,
    font,
  })
  page.drawText(`Service date: ${formatDate(inv.serviceDate)}`, {
    x: width - margin - 200,
    y: y - 74,
    size: 10,
    font,
  })

  y = infoY - 20

  // Section 2 - Bill to
  const billLines = [`Name: ${inv.billedTo}`, `Address: ${inv.address}`]
  if (inv.city) billLines.push(`City: ${inv.city}`)
  if (inv.state) billLines.push(`State: ${inv.state}`)
  if (inv.zip) billLines.push(`ZIP: ${inv.zip}`)
  const secHeader = 18
  const lineHeight = 12
  const secBody = lineHeight * billLines.length + 8
  page.drawRectangle({
    x: margin,
    y: y - secHeader - secBody,
    width: contentWidth,
    height: secHeader + secBody,
    color: rgb(1, 1, 1),
  })
  page.drawRectangle({ x: margin, y: y - secHeader, width: contentWidth, height: secHeader, color: darkBlue })
  page.drawText('Bill to', { x: margin + 6, y: y - 13, size: 12, font: bold, color: rgb(1, 1, 1) })
  let lineY = y - secHeader - 14
  billLines.forEach((l) => {
    page.drawText(l, { x: margin + 6, y: lineY, size: 11, font })
    lineY -= lineHeight
  })

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
  const mappedService = serviceTypeMap[inv.serviceType] || inv.serviceType
  services.push({ d: mappedService, a: Number(inv.price) })
  if (inv.carpetPrice != null) services.push({ d: 'Carpet Cleaning', a: Number(inv.carpetPrice) })

  const parsedOtherItems = Array.isArray(inv.otherItems)
    ? inv.otherItems
    : typeof inv.otherItems === 'string'
      ? JSON.parse(inv.otherItems)
      : []
  parsedOtherItems.forEach((o: any) => {
    services.push({ d: String(o.name), a: Number(o.price) || 0 })
  })

  services.forEach((s, idx) => {
    const ry = y - tableHeaderHeight - rowHeight * idx - rowHeight + 5
    page.drawText(s.d, { x: margin + 4, y: ry, font, size: 11 })
    page.drawText(`$${s.a.toFixed(2)}`, { x: margin + descWidth + taxWidth + 4, y: ry, font, size: 11 })
  })

  y = tableBottom - 20

  // Section 4 - totals and comments
  const otherSum = parsedOtherItems.reduce(
    (s: number, o: any) => s + (Number(o.price) || 0),
    0,
  )
  const sub = Number(inv.price) + (inv.carpetPrice ?? 0) + otherSum
  const taxable = inv.taxPercent ? sub * (inv.taxPercent / 100) : 0
  const discount = inv.discount ?? 0
  const texts: [string, string][] = [
    ['Subtotal:', `$${sub.toFixed(2)}`],
    ['Taxable:', `$${taxable.toFixed(2)}`],
    ['Discount:', `$${discount.toFixed(2)}`],
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

  const bytes = await pdf.save()
  return Buffer.from(bytes)
}

app.use(cors({
  allowedHeaders: [
    'Content-Type',
    'ngrok-skip-browser-warning',
    'x-user-name',
    'x-user-id',
  ],
}))
app.use(express.json())

// Enhanced request/response logging middleware
app.use((req: Request, res: Response, next) => {
  const startTime = Date.now()
  const timestamp = new Date().toISOString()
  
  // Build request log
  const requestLog: any = {
    timestamp,
    type: 'REQUEST',
    method: req.method,
    path: req.path,
    url: req.originalUrl,
  }
  
  // Add query params if present
  if (Object.keys(req.query).length > 0) {
    requestLog.query = req.query
  }
  
  // Add params if present (route parameters)
  if (Object.keys(req.params).length > 0) {
    requestLog.params = req.params
  }
  
  // Add request body if present
  if (Object.keys(req.body || {}).length > 0) {
    requestLog.body = req.body
  }
  
  // Add headers if needed (optional, can be verbose)
  // requestLog.headers = req.headers
  
  console.log('\n' + '='.repeat(80))
  console.log('📥 REQUEST:')
  console.log(JSON.stringify(requestLog, null, 2))
  console.log('='.repeat(80))
  
  // Capture response
  const originalJson = res.json.bind(res)
  const originalSend = res.send.bind(res)
  let responseBody: any
  let responseSent = false
  
  res.json = ((body: any) => {
    if (!responseSent) {
      responseBody = body
      responseSent = true
    }
    return originalJson(body)
  }) as any
  
  res.send = ((body: any) => {
    if (!responseSent) {
      responseBody = body
      responseSent = true
    }
    return originalSend(body)
  }) as any
  
  res.on('finish', () => {
    const duration = Date.now() - startTime
    const responseTimestamp = new Date().toISOString()
    
    // Build response log
    const responseLog: any = {
      timestamp: responseTimestamp,
      type: 'RESPONSE',
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      statusMessage: res.statusMessage,
      duration: `${duration}ms`,
    }
    
    // Add response body if present
    if (responseBody !== undefined) {
      try {
        // If responseBody is already a string (from res.send()), try to parse it
        let bodyToLog: any = responseBody
        if (typeof responseBody === 'string') {
          try {
            bodyToLog = JSON.parse(responseBody)
          } catch {
            // If parsing fails, it's just a plain string, log it as is
            bodyToLog = responseBody
          }
        }
        
        // Serialize to check size (use compact format for size check)
        const bodyStrCompact = JSON.stringify(bodyToLog)
        const bodyStrFormatted = JSON.stringify(bodyToLog, null, 2)
        
        // Truncate very large responses for readability (10KB formatted limit)
        if (bodyStrFormatted.length > 10000) {
          // For large responses, create a summary
          const bodyType = Array.isArray(bodyToLog) ? 'array' : typeof bodyToLog
          const itemCount = Array.isArray(bodyToLog) ? bodyToLog.length : 
                          typeof bodyToLog === 'object' && bodyToLog !== null ? Object.keys(bodyToLog).length : 1
          
          responseLog.bodySummary = {
            type: bodyType,
            itemCount: itemCount,
            size: bodyStrCompact.length,
            formattedSize: bodyStrFormatted.length,
          }
          
          // For arrays, show first few items; for objects, show structure
          if (Array.isArray(bodyToLog) && bodyToLog.length > 0) {
            responseLog.bodyPreview = bodyToLog.slice(0, 3)
            responseLog.bodyPreviewNote = `Showing first 3 of ${bodyToLog.length} items. Full body truncated.`
          } else if (typeof bodyToLog === 'object' && bodyToLog !== null) {
            // Show a preview with just the keys/values of first level
            const preview: any = {}
            const keys = Object.keys(bodyToLog).slice(0, 5)
            keys.forEach(key => {
              const value = bodyToLog[key]
              if (Array.isArray(value)) {
                preview[key] = `[Array(${value.length})]`
              } else if (typeof value === 'object' && value !== null) {
                preview[key] = `[Object(${Object.keys(value).length} keys)]`
              } else {
                preview[key] = value
              }
            })
            responseLog.bodyPreview = preview
            responseLog.bodyPreviewNote = `Showing preview of ${keys.length} of ${Object.keys(bodyToLog).length} properties. Full body truncated.`
          } else {
            responseLog.bodyPreview = bodyStrFormatted.substring(0, 5000) + '\n... [TRUNCATED]'
          }
          
          responseLog.truncated = true
        } else {
          responseLog.body = bodyToLog
        }
      } catch (err) {
        // If there's any error processing the body, just log it as a string representation
        responseLog.bodyError = 'Unable to serialize response body'
        responseLog.bodyStringPreview = String(responseBody).substring(0, 1000)
      }
    }
    
    const statusEmoji = res.statusCode >= 200 && res.statusCode < 300 ? '✅' : 
                        res.statusCode >= 400 && res.statusCode < 500 ? '⚠️' : 
                        res.statusCode >= 500 ? '❌' : 'ℹ️'
    
    console.log('\n' + '='.repeat(80))
    console.log(`📤 RESPONSE ${statusEmoji}:`)
    console.log(JSON.stringify(responseLog, null, 2))
    if (responseLog.bodyPreviewNote) {
      console.log(`\nNote: ${responseLog.bodyPreviewNote}`)
    }
    console.log('='.repeat(80) + '\n')
  })
  
  next()
})

// Import all route files
import basicRoutes from './routes/basic'
import authRoutes from './routes/auth'
import calendarRoutes from './routes/calendar'
import calculatorsRoutes from './routes/calculators'
import clientsRoutes from './routes/clients'
import employeesRoutes from './routes/employees'
import employeeScheduleRoutes from './routes/employeeSchedule'
import testRoutes from './routes/test'
import templatesRoutes from './routes/templates'
import { setupScheduleCleanupJob } from './jobs/scheduleCleanup'
// import { setupScheduleReminderJob } from './jobs/scheduleReminder'
import { setupAppointmentReminderJob } from './jobs/appointmentReminder'
import appointmentsRoutes from './routes/appointments'
import recurringRoutes from './routes/recurring'
import invoicesRoutes from './routes/invoices'
import payrollRoutes from './routes/payroll'
import aiAppointmentRoutes from './routes/aiAppointments'

// Use all route files
app.use('/', basicRoutes)
app.use('/', authRoutes)
app.use('/', calendarRoutes)
app.use('/', calculatorsRoutes)
app.use('/', clientsRoutes)
app.use('/', employeesRoutes)
app.use('/', employeeScheduleRoutes)
app.use('/', testRoutes)
app.use('/', templatesRoutes)
app.use('/', appointmentsRoutes)
app.use('/', recurringRoutes)
app.use('/', invoicesRoutes)
app.use('/', payrollRoutes)
app.use('/', aiAppointmentRoutes)

// Initialize cron jobs
setupScheduleCleanupJob()
// setupScheduleReminderJob() // COMMENTED OUT: Schedule reminder cron job disabled
setupAppointmentReminderJob()

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

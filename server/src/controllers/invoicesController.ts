import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { PDFDocument, StandardFonts, rgb, PDFFont, degrees } from 'pdf-lib'
import nodemailer from 'nodemailer'
import fs from 'fs'
import path from 'path'
import { uploadInvoiceToDrive } from '../drive'

const prisma = new PrismaClient()

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

  // Comments section: size box so it always fits above the footer
  const footerGap = 30
  const footerLinesHeight = 42
  const minFooterY = margin + footerLinesHeight
  const maxCommentBodyHeight = Math.max(0, y - secHeader - footerGap - minFooterY)
  const commentBodyHeight = Math.max(24, Math.min(120, maxCommentBodyHeight))
  const commentBoxHeight = secHeader + commentBodyHeight

  page.drawRectangle({ x: margin, y: y - commentBoxHeight, width: contentWidth, height: commentBoxHeight, color: rgb(1, 1, 1) })
  page.drawRectangle({ x: margin, y: y - secHeader, width: contentWidth, height: secHeader, color: darkBlue })
  page.drawText('Other comments', { x: margin + 6, y: y - 13, font: bold, size: 12, color: rgb(1, 1, 1) })

  if (inv.comment) {
    const commentStr = String(inv.comment)
    const commentPadding = 12
    const commentLineHeight = 13
    const maxCommentWidth = contentWidth - commentPadding
    const wrapLine = (text: string, size: number): string[] => {
      const words = text.split(/\s+/).filter(Boolean)
      const lines: string[] = []
      let line = ''
      const fit = (s: string) => font.widthOfTextAtSize(s, size) <= maxCommentWidth
      const pushWord = (w: string) => {
        if (!w) return
        if (fit(line ? line + ' ' + w : w)) {
          line = line ? line + ' ' + w : w
          return
        }
        if (line) {
          lines.push(line)
          line = ''
        }
        if (fit(w)) {
          line = w
          return
        }
        for (let i = 1; i <= w.length; i++) {
          const chunk = w.slice(0, i)
          if (!fit(chunk) && chunk.length > 1) {
            lines.push(w.slice(0, i - 1))
            pushWord(w.slice(i - 1))
            return
          }
        }
        lines.push(w)
      }
      words.forEach(pushWord)
      if (line) lines.push(line)
      return lines
    }
    const maxLines = Math.floor((commentBodyHeight - 8) / commentLineHeight)
    let commentSize = 11
    let commentLines = wrapLine(commentStr, commentSize)
    if (commentLines.length > maxLines && maxLines > 0) {
      commentSize = 10
      commentLines = wrapLine(commentStr, commentSize)
      if (commentLines.length > maxLines) {
        commentLines = commentLines.slice(0, maxLines)
      }
    }
    let lineY = y - secHeader - 14
    for (let i = 0; i < commentLines.length && i < maxLines; i++) {
      page.drawText(commentLines[i], { x: margin + 6, y: lineY, font, size: commentSize })
      lineY -= commentLineHeight
    }
  }

  y = y - commentBoxHeight - footerGap

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

export async function createInvoice(req: Request, res: Response) {
  try {
    const {
      clientName,
      billedTo,
      address,
      city,
      state,
      zip,
      serviceDate,
      serviceTime,
      serviceType,
      price,
      carpetPrice,
      discount,
      taxPercent,
      comment,
      paid,
      otherItems,
    } = req.body as {
      clientName?: string
      billedTo?: string
      address?: string
      city?: string
      state?: string
      zip?: string
      serviceDate?: string
      serviceTime?: string
      serviceType?: string
      price?: number
      carpetPrice?: number
      discount?: number
      taxPercent?: number
      comment?: string
      paid?: boolean
      otherItems?: { name: string; price: number | string }[]
    }
    if (!clientName || !billedTo || !address || !serviceDate || !serviceTime || !serviceType || price === undefined) {
      return res.status(400).json({ error: 'Missing fields' })
    }
    const normalizedItems = (otherItems || []).map((i) => ({
      name: i.name,
      price: Number(i.price) || 0,
    }))
    const otherTotal = normalizedItems.reduce((sum, i) => sum + i.price, 0)
    const subtotal = price + (carpetPrice || 0) + otherTotal - (discount || 0)
    const total = subtotal + (taxPercent ? subtotal * (taxPercent / 100) : 0)
    const crypto = require('crypto')
    const uuid = crypto.randomUUID()
    const number = BigInt('0x' + uuid.replace(/-/g, '')).toString().slice(-20)
    const invoice = await prisma.invoice.create({
      data: {
        id: uuid,
        number,
        clientName,
        billedTo,
        address,
        city: city ?? null,
        state: state ?? null,
        zip: zip ?? null,
        serviceDate: new Date(serviceDate),
        serviceTime,
        serviceType,
        price,
        carpetPrice: carpetPrice ?? null,
        discount: discount ?? null,
        taxPercent: taxPercent ?? null,
        comment: comment ?? null,
        otherItems: normalizedItems.length ? normalizedItems : undefined,
        paid: paid ?? true,
        total,
      },
    })
    res.json({ id: invoice.id })
  } catch (err) {
    console.error('Failed to create invoice:', err)
    res.status(500).json({ error: 'Failed to create invoice' })
  }
}

export async function getInvoicePdf(req: Request, res: Response) {
  try {
    const { id } = req.params
    const inv = await prisma.invoice.findUnique({ where: { id } })
    if (!inv) return res.status(404).json({ error: 'Not found' })

    const tzOffset = Number(req.query.tzOffset) || 0
    const bytes = await generateInvoicePdf(inv, tzOffset)
    res.setHeader('Content-Type', 'application/pdf')
    res.send(bytes)
  } catch (err) {
    console.error('Failed to generate invoice PDF:', err)
    res.status(500).json({ error: 'Failed to generate PDF' })
  }
}

export async function sendInvoice(req: Request, res: Response) {
  try {
    const { id } = req.params
    const email = String((req.body as any).email || '').trim()
    if (!email) return res.status(400).json({ error: 'email required' })
    const inv = await prisma.invoice.findUnique({ where: { id } })
    if (!inv) return res.status(404).json({ error: 'Not found' })

    const tzOffset = Number((req.body as any).tzOffset) || 0
    const attachment = await generateInvoicePdf(inv, tzOffset)

    // Try Mailtrap API first, fallback to SMTP
    let emailSent = false
    
    try {
      console.log('Attempting to send via Mailtrap API...')
      const response = await fetch('https://send.api.mailtrap.io/api/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.MAILTRAP_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: { email: process.env.MAILTRAP_FROM || 'no-reply@worldwideevidence.com' },
          to: [{ email }],
          subject: 'Evidence Cleaning Invoice',
          text: 'Hello,\n\nthis is an automated message from Evidence Cleaning. Attached is you invoice.\n\nPlease feel free to text Cassia at 725-577-4524 if you have any questions.\nBest,\nEvidence Cleaning.',
          attachments: [
            {
              content: attachment.toString('base64'),
              filename: 'invoice.pdf',
              type: 'application/pdf',
              disposition: 'attachment'
            }
          ]
        })
      })
      
      if (response.ok) {
        console.log('✅ Email sent successfully via Mailtrap API')
        emailSent = true
      } else {
        console.log('❌ Mailtrap API failed, trying SMTP...')
        throw new Error('API failed')
      }
    } catch (apiError) {
      console.log('Mailtrap API failed, falling back to SMTP:', (apiError as Error).message)
      
      console.log('SMTP Configuration:', {
        host: process.env.MAILTRAP_HOST,
        port: process.env.MAILTRAP_PORT,
        user: process.env.MAILTRAP_USER,
        hasApiKey: !!process.env.MAILTRAP_API_KEY
      })

      let transport = nodemailer.createTransport({
        host: process.env.MAILTRAP_HOST,
        port: Number(process.env.MAILTRAP_PORT),
        secure: false, // true for 465, false for other ports
        auth: {
          user: process.env.MAILTRAP_USER,
          pass: process.env.MAILTRAP_API_KEY,
        },
        connectionTimeout: 30000, // 30 seconds
        greetingTimeout: 15000,   // 15 seconds
        socketTimeout: 30000,     // 30 seconds
        tls: {
          rejectUnauthorized: false,
          ciphers: 'SSLv3'
        },
        debug: true, // Enable debug logging
        logger: true // Enable logger
      })

      // Test the connection first
      console.log('Testing SMTP connection...')
      try {
        await transport.verify()
        console.log('SMTP connection verified successfully')
      } catch (verifyError) {
        console.error('SMTP verification failed, trying alternative configuration...', verifyError)
        
        // Try alternative configuration without TLS
        const altTransport = nodemailer.createTransport({
          host: process.env.MAILTRAP_HOST,
          port: Number(process.env.MAILTRAP_PORT),
          secure: false,
          auth: {
            user: process.env.MAILTRAP_USER,
            pass: process.env.MAILTRAP_API_KEY,
          },
          connectionTimeout: 15000,
          greetingTimeout: 10000,
          socketTimeout: 15000,
          ignoreTLS: true,
          debug: true,
          logger: true
        })
        
        console.log('Testing alternative SMTP connection...')
        await altTransport.verify()
        console.log('Alternative SMTP connection verified successfully')
        
        // Use the alternative transport
        transport = altTransport
      }

      await transport.sendMail({
        from: process.env.MAILTRAP_FROM || 'no-reply@example.com',
        to: email,
        subject: 'Evidence Cleaning Invoice',
        text:
          'Hello,\n\nthis is an automated message from Evidence Cleaning. Attached is you invoice.\n\nPlease feel free to text Cassia at 725-577-4524 if you have any questions.\nBest,\nEvidence Cleaning.',
        attachments: [
          { filename: 'invoice.pdf', content: attachment },
        ],
      })
      console.log('✅ Email sent successfully via SMTP')
      emailSent = true
    }

    // Send confirmation email to admin
    console.log('Sending confirmation email to admin...')
    try {
      const adminResponse = await fetch('https://send.api.mailtrap.io/api/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.MAILTRAP_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: { email: process.env.MAILTRAP_FROM || 'no-reply@worldwideevidence.com' },
          to: [{ email: 'admin@worldwideevidence.com' }],
          subject: `Invoice Sent Confirmation - ${inv.clientName}`,
          text: `Invoice has been sent to: ${email}\n\nClient: ${inv.clientName}\nService Date: ${new Date(inv.serviceDate).toLocaleDateString()}\nAmount: $${inv.price}\n\nInvoice details are attached.`,
          attachments: [
            {
              content: attachment.toString('base64'),
              filename: `invoice_${inv.clientName.replace(/[^a-z0-9]/gi, '_')}.pdf`,
              type: 'application/pdf',
              disposition: 'attachment'
            }
          ]
        })
      })
      
      if (adminResponse.ok) {
        console.log('✅ Admin confirmation email sent successfully via API')
      } else {
        console.log('❌ Admin email via API failed, trying SMTP...')
        // Fallback to SMTP for admin email
        const adminTransport = nodemailer.createTransport({
          host: process.env.MAILTRAP_HOST,
          port: Number(process.env.MAILTRAP_PORT),
          secure: false,
          auth: {
            user: process.env.MAILTRAP_USER,
            pass: process.env.MAILTRAP_API_KEY,
          },
          connectionTimeout: 15000,
          greetingTimeout: 10000,
          socketTimeout: 15000,
          ignoreTLS: true,
        })
        
        await adminTransport.sendMail({
          from: process.env.MAILTRAP_FROM || 'no-reply@example.com',
          to: 'admin@worldwideevidence.com',
          subject: `Invoice Sent Confirmation - ${inv.clientName}`,
          text: `Invoice has been sent to: ${email}\n\nClient: ${inv.clientName}\nService Date: ${new Date(inv.serviceDate).toLocaleDateString()}\nAmount: $${inv.price}\n\nInvoice details are attached.`,
          attachments: [
            { filename: `invoice_${inv.clientName.replace(/[^a-z0-9]/gi, '_')}.pdf`, content: attachment },
          ],
        })
        console.log('✅ Admin confirmation email sent successfully via SMTP')
      }
    } catch (adminError) {
      console.error('Failed to send admin confirmation email:', adminError)
    }

    await uploadInvoiceToDrive(inv, attachment)

    res.json({ ok: true })
  } catch (err) {
    console.error('Failed to send invoice email:', err)
    console.error('Error details:', {
      code: (err as any)?.code,
      command: (err as any)?.command,
      response: (err as any)?.response,
      responseCode: (err as any)?.responseCode
    })
    res.status(500).json({ error: 'Failed to send invoice' })
  }
}

export async function getRevenue(_req: Request, res: Response) {
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
}

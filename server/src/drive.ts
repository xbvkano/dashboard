import { google } from 'googleapis'
import { Readable } from 'stream'
import type { Invoice } from '@prisma/client'

async function ensureFolder(drive: any, name: string, parentId?: string): Promise<string> {
  const parent = parentId || 'root'
  const q = `name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and '${parent}' in parents and trashed = false`
  const res = await drive.files.list({ q, fields: 'files(id)' })
  const existing = res.data.files?.[0]
  if (existing?.id) return existing.id
  const folder = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : ['root'],
    },
    fields: 'id',
  })
  return folder.data.id!
}

export async function uploadInvoiceToDrive(inv: Invoice, pdf: Buffer) {
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN
  if (!refreshToken) throw new Error('GOOGLE_REFRESH_TOKEN not set')

  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5173',
  )
  auth.setCredentials({ refresh_token: refreshToken })

  const drive = google.drive({ version: 'v3', auth })

  const serviceDate = new Date(inv.serviceDate)
  const year = String(serviceDate.getFullYear())
  const month = String(serviceDate.getMonth() + 1).padStart(2, '0')

  const invoicesFolder = await ensureFolder(drive, 'invoices')
  const yearFolder = await ensureFolder(drive, year, invoicesFolder)
  const monthFolder = await ensureFolder(drive, month, yearFolder)

  const safeName = inv.clientName.replace(/[^a-z0-9]+/gi, '_').toLowerCase()
  const invoiceNumber =
    (inv.number as string | undefined) ||
    BigInt('0x' + inv.id.replace(/-/g, '')).toString().slice(-20)
  const fileName = `${safeName}_${invoiceNumber}.pdf`

  await drive.files.create({
    requestBody: { name: fileName, parents: [monthFolder] },
    media: { mimeType: 'application/pdf', body: Readable.from(pdf) },
    fields: 'id',
  })
}

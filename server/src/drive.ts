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
  const credentials = process.env.GOOGLE_DRIVE_API_KEY
  if (!credentials) throw new Error('GOOGLE_DRIVE_API_KEY not set')
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(credentials),
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  })
  const drive = google.drive({ version: 'v3', auth })

  const serviceDate = new Date(inv.serviceDate)
  const year = String(serviceDate.getFullYear())
  const month = String(serviceDate.getMonth() + 1).padStart(2, '0')

  const driveFolder = await ensureFolder(drive, 'drive')
  const invoicesFolder = await ensureFolder(drive, 'invoices', driveFolder)
  const yearFolder = await ensureFolder(drive, year, invoicesFolder)
  const monthFolder = await ensureFolder(drive, month, yearFolder)

  const safeName = inv.clientName.replace(/[^a-z0-9]+/gi, '_').toLowerCase()
  const fileName = `${safeName}_${inv.id}.pdf`

  await drive.files.create({
    requestBody: { name: fileName, parents: [monthFolder] },
    media: { mimeType: 'application/pdf', body: Readable.from(pdf) },
    fields: 'id',
  })
}

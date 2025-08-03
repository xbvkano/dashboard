import { google } from 'googleapis'
import { Readable } from 'stream'
import { readFileSync, existsSync } from 'fs'
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

function loadCreds(value: string) {
  try {
    return JSON.parse(value)
  } catch {}

  try {
    const normalized = value.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/')
    const pad = normalized.length % 4
    const padded = pad ? normalized + '='.repeat(4 - pad) : normalized
    const decoded = Buffer.from(padded, 'base64').toString('utf8')
    return JSON.parse(decoded)
  } catch {}

  if (existsSync(value)) {
    const file = readFileSync(value, 'utf8')
    return JSON.parse(file)
  }

  return null
}

export async function uploadInvoiceToDrive(inv: Invoice, pdf: Buffer) {
  const key = process.env.GOOGLE_DRIVE_API_KEY
  if (!key) throw new Error('GOOGLE_DRIVE_API_KEY not set')

  // Environments like Railway cannot store multi-line secrets. Allow the key to
  // be provided as raw JSON, base64-encoded JSON or a path to the JSON file.
  // If none of these formats parse, treat it as a plain API key string.
  const parsedCreds = loadCreds(key)

  const auth = parsedCreds
    ? new google.auth.GoogleAuth({
        credentials: parsedCreds,
        scopes: ['https://www.googleapis.com/auth/drive.file'],
      })
    : key
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

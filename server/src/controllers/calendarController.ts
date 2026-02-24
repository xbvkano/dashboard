import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export function getMonthInfo(req: Request, res: Response) {
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
}

export async function getMonthCounts(req: Request, res: Response) {
  const year = parseInt(String(req.query.year))
  const month = parseInt(String(req.query.month))

  if (Number.isNaN(year) || Number.isNaN(month)) {
    return res.status(400).json({ error: 'Invalid year or month' })
  }

  // Use UTC dates for consistent querying
  const start = new Date(Date.UTC(year, month - 1, 1))
  const end = new Date(Date.UTC(year, month, 1))
  try {
    const appts = await prisma.appointment.findMany({
      where: {
        date: { gte: start, lt: end },
        status: { notIn: ['DELETED', 'RESCHEDULE_OLD', 'CANCEL'] },
      },
      select: { date: true },
    })
    const counts: Record<string, number> = {}
    for (const a of appts) {
      // Format date as YYYY-MM-DD using UTC to match storage
      const year = a.date.getUTCFullYear()
      const month = String(a.date.getUTCMonth() + 1).padStart(2, '0')
      const day = String(a.date.getUTCDate()).padStart(2, '0')
      const key = `${year}-${month}-${day}`
      counts[key] = (counts[key] || 0) + 1
    }
    res.json(counts)
  } catch (err) {
    console.error('Failed to fetch month counts:', err)
    res.status(500).json({ error: 'Failed to fetch counts' })
  }
}

export async function getRangeCounts(req: Request, res: Response) {
  const startStr = String(req.query.start)
  const endStr = String(req.query.end)

  if (!startStr || !endStr) {
    return res.status(400).json({ error: 'start and end required' })
  }

  // Parse date strings (YYYY-MM-DD) as UTC midnight for consistent querying
  const parseDateUTC = (dateStr: string): Date | null => {
    const dateParts = dateStr.split('-')
    if (dateParts.length !== 3) return null
    const date = new Date(Date.UTC(
      parseInt(dateParts[0]),
      parseInt(dateParts[1]) - 1, // Month is 0-indexed
      parseInt(dateParts[2])
    ))
    return isNaN(date.getTime()) ? null : date
  }

  const start = parseDateUTC(startStr)
  const end = parseDateUTC(endStr)

  if (!start || !end) {
    return res.status(400).json({ error: 'Invalid start or end date format. Use YYYY-MM-DD' })
  }

  // Set end to the start of the next day in UTC to match getAppointments logic
  const endExclusive = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate() + 1))

  try {
    const appts = await prisma.appointment.findMany({
      where: {
        date: { gte: start, lt: endExclusive },
        status: { notIn: ['DELETED', 'RESCHEDULE_OLD', 'CANCEL'] },
      },
      select: { date: true },
    })
    const counts: Record<string, number> = {}
    for (const a of appts) {
      // Format date as YYYY-MM-DD using UTC to match storage
      const year = a.date.getUTCFullYear()
      const month = String(a.date.getUTCMonth() + 1).padStart(2, '0')
      const day = String(a.date.getUTCDate()).padStart(2, '0')
      const key = `${year}-${month}-${day}`
      counts[key] = (counts[key] || 0) + 1
    }
    res.json(counts)
  } catch (err) {
    console.error('Failed to fetch range counts:', err)
    res.status(500).json({ error: 'Failed to fetch counts' })
  }
}

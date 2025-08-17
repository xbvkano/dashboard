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

  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 1)
  try {
    const appts = await prisma.appointment.findMany({
      where: {
        date: { gte: start, lt: end },
        status: { notIn: ['DELETED', 'RESCHEDULE_OLD'] },
      },
      select: { date: true },
    })
    const counts: Record<string, number> = {}
    for (const a of appts) {
      const key = a.date.toISOString().slice(0, 10)
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

  const start = new Date(startStr)
  const end = new Date(endStr)

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return res.status(400).json({ error: 'Invalid start or end' })
  }

  try {
    const appts = await prisma.appointment.findMany({
      where: {
        date: { gte: start, lt: end },
        status: { notIn: ['DELETED', 'RESCHEDULE_OLD'] },
      },
      select: { date: true },
    })
    const counts: Record<string, number> = {}
    for (const a of appts) {
      const key = a.date.toISOString().slice(0, 10)
      counts[key] = (counts[key] || 0) + 1
    }
    res.json(counts)
  } catch (err) {
    console.error('Failed to fetch range counts:', err)
    res.status(500).json({ error: 'Failed to fetch counts' })
  }
}

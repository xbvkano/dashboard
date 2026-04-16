import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { DateTime } from 'luxon'
import {
  appointmentAnchorUtc,
  DEFAULT_APPOINTMENT_TIMEZONE,
  utcInstantToLocalDateString,
} from '../utils/appointmentTimezone'

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

  const zone = DEFAULT_APPOINTMENT_TIMEZONE
  const start = DateTime.fromObject({ year, month, day: 1 }, { zone }).startOf('day').toUTC()
  const end = DateTime.fromObject({ year, month, day: 1 }, { zone }).plus({ months: 1 }).startOf('day').toUTC()
  const legacyStart = new Date(Date.UTC(year, month - 1, 1))
  const legacyEnd = new Date(Date.UTC(year, month, 1))

  try {
    const appts = await prisma.appointment.findMany({
      where: {
        status: { notIn: ['DELETED', 'RESCHEDULE_OLD', 'CANCEL'] },
        OR: [
          { dateUtc: { gte: start.toJSDate(), lt: end.toJSDate() } },
          {
            AND: [{ dateUtc: null }, { date: { gte: legacyStart, lt: legacyEnd } }],
          },
        ],
      },
      select: { dateUtc: true, date: true },
    })
    const counts: Record<string, number> = {}
    for (const a of appts) {
      const inst = appointmentAnchorUtc({ dateUtc: a.dateUtc, date: a.date })
      const key = utcInstantToLocalDateString(inst, zone)
      const [ky, km] = key.split('-').map(Number)
      if (ky === year && km === month) {
        counts[key] = (counts[key] || 0) + 1
      }
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

  const zone = DEFAULT_APPOINTMENT_TIMEZONE
  const startLocal = DateTime.fromISO(startStr, { zone })
  const endLocal = DateTime.fromISO(endStr, { zone })
  if (!startLocal.isValid || !endLocal.isValid) {
    return res.status(400).json({ error: 'Invalid start or end date format. Use YYYY-MM-DD' })
  }

  const startU = startLocal.startOf('day').toUTC()
  const endExclusive = endLocal.plus({ days: 1 }).startOf('day').toUTC()

  try {
    const naiveLegacyStart = new Date(`${startStr}T00:00:00.000Z`)
    const naiveLegacyEnd = new Date(`${endStr}T00:00:00.000Z`)
    naiveLegacyEnd.setUTCDate(naiveLegacyEnd.getUTCDate() + 1)

    const appts = await prisma.appointment.findMany({
      where: {
        status: { notIn: ['DELETED', 'RESCHEDULE_OLD', 'CANCEL'] },
        OR: [
          { dateUtc: { gte: startU.toJSDate(), lt: endExclusive.toJSDate() } },
          {
            AND: [
              { dateUtc: null },
              { date: { gte: naiveLegacyStart, lt: naiveLegacyEnd } },
            ],
          },
        ],
      },
      select: { dateUtc: true, date: true },
    })
    const counts: Record<string, number> = {}
    const startMs = startU.toMillis()
    const endMs = endExclusive.toMillis()
    for (const a of appts) {
      const inst = appointmentAnchorUtc({ dateUtc: a.dateUtc, date: a.date })
      const key = utcInstantToLocalDateString(inst, zone)
      const t = inst.getTime()
      if (t >= startMs && t < endMs) {
        counts[key] = (counts[key] || 0) + 1
      }
    }
    res.json(counts)
  } catch (err) {
    console.error('Failed to fetch range counts:', err)
    res.status(500).json({ error: 'Failed to fetch counts' })
  }
}

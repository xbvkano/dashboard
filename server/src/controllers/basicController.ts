import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const getRoot = async (_req: Request, res: Response) => {
  res.json({ message: 'Hello from server' })
}

export const getUsers = async (_req: Request, res: Response) => {
  const users = await prisma.user.findMany()
  res.json(users)
}

export const getAdmins = async (_req: Request, res: Response) => {
  const admins = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'OWNER'] } },
    orderBy: { name: 'asc' },
  })
  res.json(admins)
}

export const getMonthInfo = (req: Request, res: Response) => {
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

import { Request, Response } from 'express'
import { staffOptionsData } from '../data/staffOptions'
import { parseSqft, calculatePayRate, calculateCarpetRate } from '../utils/appointmentUtils'

export function getStaffOptions(req: Request, res: Response) {
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
}

export function getPayRate(req: Request, res: Response) {
  const type = String(req.query.type || '')
  const size = String(req.query.size || '')
  const count = parseInt(String(req.query.count || '0'), 10)

  if (!type || !size || isNaN(count)) {
    return res.status(400).json({ error: 'type, size and count required' })
  }

  const sqft = parseSqft(size)
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
}

export function getCarpetRate(req: Request, res: Response) {
  const size = String(req.query.size || '')
  const rooms = parseInt(String(req.query.rooms || '0'), 10)

  if (!size || isNaN(rooms) || rooms <= 0) {
    return res.status(400).json({ error: 'size and rooms required' })
  }

  const sqft = parseSqft(size)
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
}

import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import {
  getCallerContext,
  getEmployeeByCode,
  getOnDutyCandidates,
} from '../services/callCenterService'

const prisma = new PrismaClient()

export async function callerContext(req: Request, res: Response) {
  try {
    const phone = typeof req.query.phone === 'string' ? req.query.phone : ''
    if (!phone.trim()) {
      return res.status(400).json({ error: 'phone query parameter is required' })
    }
    const result = await getCallerContext(prisma, phone)
    return res.json(result)
  } catch (err) {
    console.error('callerContext error', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

export async function employeeByCode(req: Request, res: Response) {
  try {
    const code = req.params.code ?? ''
    const result = await getEmployeeByCode(prisma, code)
    if (!result) {
      return res.status(404).json({ error: 'Employee not found' })
    }
    return res.json(result)
  } catch (err) {
    console.error('employeeByCode error', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

export async function onDuty(req: Request, res: Response) {
  try {
    const atRaw = typeof req.query.at === 'string' ? req.query.at : undefined
    let at = new Date()
    if (atRaw) {
      at = new Date(atRaw)
      if (Number.isNaN(at.getTime())) {
        return res.status(400).json({ error: 'at must be a valid ISO datetime' })
      }
    }
    const result = await getOnDutyCandidates(prisma, at)
    return res.json(result)
  } catch (err) {
    console.error('onDuty error', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

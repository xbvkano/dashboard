import type { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { parseUserIdHeader } from '../utils/httpUser'
import {
  createDevInboundUnread,
  markAllOpenConversationsRead,
} from '../services/messaging/actionCountsDev'
import { createUnvisitedLeads, resetUnvisitedLeads } from '../services/websiteLeadDev'
import type { MessagingInboxKind } from '../services/messaging/inboxLines'

const prisma = new PrismaClient()

function devActionCountTestsAllowed(): boolean {
  return process.env.NODE_ENV !== 'production'
}

function parseInboxes(raw: unknown): MessagingInboxKind[] {
  if (raw === 'employee') return ['employee']
  if (raw === 'both') return ['client', 'employee']
  if (raw === 'client' || raw == null || raw === '') return ['client']
  if (Array.isArray(raw)) {
    const out: MessagingInboxKind[] = []
    for (const v of raw) {
      if (v === 'client' || v === 'employee') out.push(v)
    }
    return out.length ? [...new Set(out)] : ['client']
  }
  return ['client']
}

export async function resetMessageNotifications(req: Request, res: Response): Promise<void> {
  if (!devActionCountTestsAllowed()) {
    res.status(403).json({ error: 'Not available in production' })
    return
  }
  const userId = parseUserIdHeader(req.headers['x-user-id'])
  if (userId == null) {
    res.status(400).json({ error: 'x-user-id header required' })
    return
  }
  try {
    const markedRead = await markAllOpenConversationsRead(prisma, userId)
    res.json({ ok: true, markedRead })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to reset message notifications' })
  }
}

export async function createMessageNotifications(req: Request, res: Response): Promise<void> {
  if (!devActionCountTestsAllowed()) {
    res.status(403).json({ error: 'Not available in production' })
    return
  }
  try {
    const created = await createDevInboundUnread({
      db: prisma,
      inboxes: parseInboxes(req.body?.inbox),
    })
    res.json({ ok: true, created })
  } catch (e) {
    console.error(e)
    const message = e instanceof Error ? e.message : 'Failed to create message notifications'
    res.status(400).json({ error: message })
  }
}

export async function resetLeadNotifications(_req: Request, res: Response): Promise<void> {
  if (!devActionCountTestsAllowed()) {
    res.status(403).json({ error: 'Not available in production' })
    return
  }
  try {
    const out = await resetUnvisitedLeads()
    res.json({ ok: true, ...out })
  } catch (e) {
    console.error(e)
    const message = e instanceof Error ? e.message : 'Failed to reset lead notifications'
    res.status(502).json({ error: message })
  }
}

export async function createLeadNotifications(req: Request, res: Response): Promise<void> {
  if (!devActionCountTestsAllowed()) {
    res.status(403).json({ error: 'Not available in production' })
    return
  }
  const forms = req.body?.forms !== false
  const calls = req.body?.calls !== false
  try {
    const out = await createUnvisitedLeads({ forms, calls })
    res.json({ ok: true, ...out })
  } catch (e) {
    console.error(e)
    const message = e instanceof Error ? e.message : 'Failed to create lead notifications'
    res.status(502).json({ error: message })
  }
}

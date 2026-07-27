import type { NextFunction, Request, Response } from 'express'

/**
 * Service-to-service auth for call-center → dashboard.
 * Accepts Authorization: Bearer <CALL_CENTER_API_KEY> or X-Call-Center-Key: <key>.
 */
export function requireCallCenterKey(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.CALL_CENTER_API_KEY?.trim()
  if (!expected) {
    res.status(503).json({ error: 'CALL_CENTER_API_KEY is not configured' })
    return
  }

  const headerKey = req.header('x-call-center-key')?.trim()
  const auth = req.headers.authorization
  const bearerKey =
    auth && auth.startsWith('Bearer ') ? auth.slice(7).trim() : undefined

  const provided = headerKey || bearerKey
  if (!provided || provided !== expected) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  next()
}

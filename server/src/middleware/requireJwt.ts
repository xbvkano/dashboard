import type { NextFunction, Request, Response } from 'express'
import { verifyBearerToken } from '../auth/jwtTokens'

function truthyEnv(v: string | undefined): boolean {
  return v === 'true' || v === '1'
}

/** Tier B: employee portal routes; admin or employee JWT allowed. */
export function isTierBPath(path: string): boolean {
  return path === '/employee' || path.startsWith('/employee/')
}

/**
 * Tier C — no JWT: health, login, Twilio SMS inbound webhook.
 */
export function isPublicApiRoute(method: string, path: string): boolean {
  if (method === 'GET' && path === '/') return true
  if (method === 'POST' && path === '/login') return true
  if (method === 'POST' && path === '/auth/refresh') return true
  if (method === 'POST' && path === '/messaging/inbound') return true
  return false
}

/**
 * When NO_AUTH=1 and not production, skip JWT (pairs with noAuthDefaults middleware).
 */
function shouldSkipJwtBecauseNoAuth(): boolean {
  if (process.env.NODE_ENV === 'production') return false
  return truthyEnv(process.env.NO_AUTH)
}

export function requireJwtMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (shouldSkipJwtBecauseNoAuth()) {
    next()
    return
  }
  if (isPublicApiRoute(req.method, req.path)) {
    next()
    return
  }

  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  const token = auth.slice(7).trim()
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const kind = verifyBearerToken(token)
  if (!kind) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const tierB = isTierBPath(req.path)
  if (tierB) {
    next()
    return
  }

  if (kind === 'admin') {
    next()
    return
  }
  res.status(403).json({ error: 'Forbidden' })
}

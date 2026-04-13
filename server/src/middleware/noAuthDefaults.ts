import type { NextFunction, Request, Response } from 'express'
import { parseUserIdHeader } from '../utils/httpUser'

function truthyEnv(v: string | undefined): boolean {
  return v === 'true' || v === '1'
}

/** Paths that must not get synthetic CRM user headers (e.g. Twilio webhooks). */
const SKIP_PATHS = new Set<string>(['/messaging/inbound'])

/**
 * When NO_AUTH=1 and NODE_ENV is not production, fill missing x-user-id / x-user-name
 * so dev matches prisma seed + client VITE_NO_AUTH (see client devNoAuth.ts).
 * Never active in production.
 */
export function noAuthUserDefaultsMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (process.env.NODE_ENV === 'production') {
    if (truthyEnv(process.env.NO_AUTH)) {
      console.warn('[NO_AUTH] Ignored in production; unset NO_AUTH on the server.')
    }
    return next()
  }

  if (!truthyEnv(process.env.NO_AUTH)) {
    return next()
  }

  if (SKIP_PATHS.has(req.path)) {
    return next()
  }

  const defaultId = (process.env.NO_AUTH_USER_ID ?? '1').trim()
  const defaultName = (process.env.NO_AUTH_USER_NAME ?? 'dev_seed_admin').trim()

  if (parseUserIdHeader(req.headers['x-user-id']) == null && defaultId !== '') {
    req.headers['x-user-id'] = defaultId
  }

  const rawName = req.headers['x-user-name']
  const nameStr = typeof rawName === 'string' ? rawName : Array.isArray(rawName) ? rawName[0] : ''
  if ((!nameStr || !nameStr.trim()) && defaultName !== '') {
    req.headers['x-user-name'] = defaultName
  }

  next()
}

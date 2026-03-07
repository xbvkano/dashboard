/**
 * Proxy to the Coupons API on the website server (WEBSITE_SERVER_URL).
 * Forwards /api/coupons and /api/coupons/:id and /api/coupons/validate to the external API.
 */

import { Router, Request, Response } from 'express'

const router = Router()

export function couponsUrl(req: Request, base: string): string {
  const path = req.path.startsWith('/') ? req.path : `/${req.path}`
  const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''
  const suffix = path === '/coupons' ? '' : path.replace(/^\/coupons/, '')
  return `${(base || '').replace(/\/$/, '')}/api/coupons${suffix}${query}`
}

export async function proxy(req: Request, res: Response) {
  const BASE = process.env.WEBSITE_SERVER_URL || ''
  if (!BASE) {
    return res.status(503).json({ message: 'Coupons API URL not configured (WEBSITE_SERVER_URL).' })
  }
  const url = couponsUrl(req, BASE)
  const method = req.method
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(req.headers.authorization ? { Authorization: req.headers.authorization as string } : {}),
  }
  let body: string | undefined
  if (method !== 'GET' && method !== 'HEAD' && req.body != null) {
    body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
  }
  try {
    const response = await fetch(url, {
      method,
      headers,
      body,
    })
    const text = await response.text()
    if (response.status === 204 || !text) {
      return res.status(response.status).send()
    }
    try {
      const data = JSON.parse(text)
      res.status(response.status).json(data)
    } catch {
      res.status(response.status).send(text)
    }
  } catch (e) {
    console.error('Coupons proxy error:', e)
    res.status(502).json({ message: 'Failed to reach Coupons API.' })
  }
}

router.all('/coupons', proxy)
router.all('/coupons/validate', proxy)
router.all('/coupons/:id', proxy)

export default router

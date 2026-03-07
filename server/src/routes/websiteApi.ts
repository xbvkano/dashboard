/**
 * Proxy to the Evidence Cleaning website server (WEBSITE_SERVER_URL) for
 * quotes, calls, and stats. Used by the dashboard Home page.
 */

import { Router, Request, Response } from 'express'

const router = Router()

function buildUrl(req: Request, path: string): string {
  const base = (process.env.WEBSITE_SERVER_URL || '').replace(/\/$/, '')
  if (!base) return ''
  const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''
  return `${base}${path}${query}`
}

function proxy(path: string): (req: Request, res: Response) => Promise<void> {
  return async (req: Request, res: Response): Promise<void> => {
    const base = process.env.WEBSITE_SERVER_URL || ''
    if (!base) {
      res.status(503).json({ message: 'Website API URL not configured (WEBSITE_SERVER_URL).' })
      return
    }
    const url = buildUrl(req, path)
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      })
      const text = await response.text()
      if (response.status === 204 || !text) {
        res.status(response.status).send()
        return
      }
      try {
        const data = JSON.parse(text)
        res.status(response.status).json(data)
      } catch {
        res.status(response.status).send(text)
      }
    } catch (e) {
      console.error('Website API proxy error:', e)
      res.status(502).json({ message: 'Failed to reach website API.' })
    }
  }
}

router.get('/quotes', proxy('/api/quotes'))
router.get('/calls', proxy('/api/calls'))
router.get('/stats', proxy('/api/stats'))

export default router

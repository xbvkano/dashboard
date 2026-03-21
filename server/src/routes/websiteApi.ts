/**
 * Proxy to the Evidence Cleaning website server (WEBSITE_SERVER_URL) for
 * quotes, calls, and stats. Used by the dashboard Home page.
 */

import { Router, Request, Response } from 'express'

const router = Router()

function getWebsiteBase(): string {
  return (process.env.WEBSITE_SERVER_URL || '').replace(/\/$/, '')
}

function proxy(path: string, method: string = 'GET'): (req: Request, res: Response) => Promise<void> {
  return async (req: Request, res: Response): Promise<void> => {
    const base = getWebsiteBase()
    if (!base) {
      res.status(503).json({ message: 'Website API URL not configured (WEBSITE_SERVER_URL).' })
      return
    }
    const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''
    const url = `${base}${path}${query}`
    try {
      const init: RequestInit = {
        method,
        headers: { 'Content-Type': 'application/json' },
      }
      if (method !== 'GET' && req.body && Object.keys(req.body).length > 0) {
        init.body = JSON.stringify(req.body)
      }
      const response = await fetch(url, init)
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

// PATCH to mark quote/call as visited
router.patch('/quotes/:id', async (req: Request, res: Response) => {
  const base = getWebsiteBase()
  if (!base) {
    res.status(503).json({ message: 'Website API URL not configured (WEBSITE_SERVER_URL).' })
    return
  }
  const { id } = req.params
  const url = `${base}/api/quotes/${id}`
  try {
    const response = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body || { visited: true }),
    })
    const text = await response.text()
    if (response.status === 204 || !text) {
      res.status(response.status).send()
      return
    }
    try {
      res.status(response.status).json(JSON.parse(text))
    } catch {
      res.status(response.status).send(text)
    }
  } catch (e) {
    console.error('Website API proxy error:', e)
    res.status(502).json({ message: 'Failed to reach website API.' })
  }
})

router.patch('/calls/:id', async (req: Request, res: Response) => {
  const base = getWebsiteBase()
  if (!base) {
    res.status(503).json({ message: 'Website API URL not configured (WEBSITE_SERVER_URL).' })
    return
  }
  const { id } = req.params
  const url = `${base}/api/calls/${id}`
  try {
    const response = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body || { visited: true }),
    })
    const text = await response.text()
    if (response.status === 204 || !text) {
      res.status(response.status).send()
      return
    }
    try {
      res.status(response.status).json(JSON.parse(text))
    } catch {
      res.status(response.status).send(text)
    }
  } catch (e) {
    console.error('Website API proxy error:', e)
    res.status(502).json({ message: 'Failed to reach website API.' })
  }
})

export default router

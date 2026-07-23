import express from 'express'
import request from 'supertest'
import { requireCallCenterKey } from '../../src/middleware/requireCallCenterKey'
import { isPublicApiRoute, requireJwtMiddleware } from '../../src/middleware/requireJwt'

const API_KEY = 'test-call-center-key'

function makeKeyApp() {
  const app = express()
  app.use(express.json())
  app.use(requireCallCenterKey)
  app.get('/caller-context', (_req, res) => res.json({ ok: true }))
  return app
}

describe('requireCallCenterKey', () => {
  const prevKey = process.env.CALL_CENTER_API_KEY

  afterEach(() => {
    if (prevKey === undefined) delete process.env.CALL_CENTER_API_KEY
    else process.env.CALL_CENTER_API_KEY = prevKey
  })

  it('returns 503 when CALL_CENTER_API_KEY is not configured', async () => {
    delete process.env.CALL_CENTER_API_KEY
    const res = await request(makeKeyApp()).get('/caller-context')
    expect(res.status).toBe(503)
    expect(res.body.error).toMatch(/CALL_CENTER_API_KEY/)
  })

  it('returns 401 when key is missing', async () => {
    process.env.CALL_CENTER_API_KEY = API_KEY
    const res = await request(makeKeyApp()).get('/caller-context')
    expect(res.status).toBe(401)
  })

  it('returns 401 when key is wrong', async () => {
    process.env.CALL_CENTER_API_KEY = API_KEY
    const res = await request(makeKeyApp())
      .get('/caller-context')
      .set('X-Call-Center-Key', 'wrong')
    expect(res.status).toBe(401)
  })

  it('accepts X-Call-Center-Key', async () => {
    process.env.CALL_CENTER_API_KEY = API_KEY
    const res = await request(makeKeyApp())
      .get('/caller-context')
      .set('X-Call-Center-Key', API_KEY)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })
  })

  it('accepts Authorization Bearer with the service key', async () => {
    process.env.CALL_CENTER_API_KEY = API_KEY
    const res = await request(makeKeyApp())
      .get('/caller-context')
      .set('Authorization', `Bearer ${API_KEY}`)
    expect(res.status).toBe(200)
  })
})

describe('JWT public route for /api/call-center', () => {
  it('treats call-center paths as public (no JWT required)', () => {
    expect(isPublicApiRoute('GET', '/api/call-center/caller-context')).toBe(true)
    expect(isPublicApiRoute('GET', '/api/call-center/on-duty')).toBe(true)
    expect(isPublicApiRoute('GET', '/api/call-center/employees/by-code/001')).toBe(true)
  })

  it('allows GET /api/call-center without Bearer when JWT middleware runs', async () => {
    process.env.NO_AUTH = ''
    process.env.NODE_ENV = 'test'
    process.env.JWT_ADMIN_SECRET = 'admin-secret'
    process.env.JWT_EMPLOYEE_SECRET = 'emp-secret'

    const app = express()
    app.use(express.json())
    app.use(requireJwtMiddleware)
    app.get('/api/call-center/caller-context', (_req, res) => res.json({ public: true }))

    const res = await request(app).get('/api/call-center/caller-context')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ public: true })
  })
})

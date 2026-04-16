import express from 'express'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import { requireJwtMiddleware } from '../../src/middleware/requireJwt'

const ADMIN_SECRET = 'test-jwt-admin-secret'
const EMP_SECRET = 'test-jwt-employee-secret'

function makeTestApp() {
  const app = express()
  app.use(express.json())
  app.use(requireJwtMiddleware)
  app.get('/', (_req, res) => res.status(200).send('ok'))
  app.post('/login', (_req, res) => res.status(200).json({ ok: true }))
  app.post('/auth/refresh', (_req, res) => res.status(200).json({ ok: true }))
  app.post('/messaging/inbound', (_req, res) => res.status(200).json({ ok: true }))
  app.get('/users', (_req, res) => res.status(200).json([]))
  app.get('/employee/schedule-policy', (_req, res) => res.status(200).json({}))
  return app
}

function adminToken(): string {
  return jwt.sign({ role: 'ADMIN' }, ADMIN_SECRET, { subject: '1', expiresIn: '1h' })
}

function employeeToken(): string {
  return jwt.sign({ role: 'EMPLOYEE' }, EMP_SECRET, { subject: '2', expiresIn: '1h' })
}

describe('requireJwtMiddleware', () => {
  const prevAdmin = process.env.JWT_ADMIN_SECRET
  const prevEmp = process.env.JWT_EMPLOYEE_SECRET
  const prevNoAuth = process.env.NO_AUTH
  const prevNodeEnv = process.env.NODE_ENV

  beforeEach(() => {
    process.env.JWT_ADMIN_SECRET = ADMIN_SECRET
    process.env.JWT_EMPLOYEE_SECRET = EMP_SECRET
    process.env.NO_AUTH = ''
    process.env.NODE_ENV = 'test'
  })

  afterAll(() => {
    process.env.JWT_ADMIN_SECRET = prevAdmin
    process.env.JWT_EMPLOYEE_SECRET = prevEmp
    process.env.NO_AUTH = prevNoAuth
    process.env.NODE_ENV = prevNodeEnv
  })

  describe('public routes (no Bearer)', () => {
    it('GET / returns 200', async () => {
      const res = await request(makeTestApp()).get('/')
      expect(res.status).toBe(200)
    })

    it('POST /login returns 200', async () => {
      const res = await request(makeTestApp()).post('/login').send({})
      expect(res.status).toBe(200)
    })

    it('POST /messaging/inbound returns 200', async () => {
      const res = await request(makeTestApp()).post('/messaging/inbound').send({})
      expect(res.status).toBe(200)
    })

    it('POST /auth/refresh returns 200 without Bearer', async () => {
      const res = await request(makeTestApp()).post('/auth/refresh').send({})
      expect(res.status).toBe(200)
    })
  })

  describe('protected without token', () => {
    it('GET /users returns 401', async () => {
      const res = await request(makeTestApp()).get('/users')
      expect(res.status).toBe(401)
    })

    it('GET /employee/schedule-policy returns 401', async () => {
      const res = await request(makeTestApp()).get('/employee/schedule-policy')
      expect(res.status).toBe(401)
    })
  })

  describe('admin JWT', () => {
    it('GET /users with admin Bearer returns 200', async () => {
      const res = await request(makeTestApp())
        .get('/users')
        .set('Authorization', `Bearer ${adminToken()}`)
      expect(res.status).toBe(200)
    })

    it('GET /employee/schedule-policy with admin Bearer returns 200', async () => {
      const res = await request(makeTestApp())
        .get('/employee/schedule-policy')
        .set('Authorization', `Bearer ${adminToken()}`)
      expect(res.status).toBe(200)
    })
  })

  describe('employee JWT', () => {
    it('GET /employee/schedule-policy with employee Bearer returns 200', async () => {
      const res = await request(makeTestApp())
        .get('/employee/schedule-policy')
        .set('Authorization', `Bearer ${employeeToken()}`)
      expect(res.status).toBe(200)
    })

    it('GET /users with employee Bearer returns 403', async () => {
      const res = await request(makeTestApp())
        .get('/users')
        .set('Authorization', `Bearer ${employeeToken()}`)
      expect(res.status).toBe(403)
    })
  })

  describe('invalid tokens', () => {
    it('rejects wrong signature', async () => {
      const bad = jwt.sign({ role: 'ADMIN' }, 'wrong-secret', { subject: '1', expiresIn: '1h' })
      const res = await request(makeTestApp())
        .get('/users')
        .set('Authorization', `Bearer ${bad}`)
      expect(res.status).toBe(401)
    })

    it('rejects expired token', async () => {
      const expired = jwt.sign({ role: 'ADMIN' }, ADMIN_SECRET, {
        subject: '1',
        expiresIn: '-1h',
      })
      const res = await request(makeTestApp())
        .get('/users')
        .set('Authorization', `Bearer ${expired}`)
      expect(res.status).toBe(401)
    })

    it('rejects malformed token', async () => {
      const res = await request(makeTestApp())
        .get('/users')
        .set('Authorization', 'Bearer not-a-valid-jwt')
      expect(res.status).toBe(401)
    })

    it('rejects missing Bearer prefix', async () => {
      const res = await request(makeTestApp()).get('/users').set('Authorization', adminToken())
      expect(res.status).toBe(401)
    })
  })

  describe('NO_AUTH bypass (non-production)', () => {
    it('skips JWT when NO_AUTH=1', async () => {
      process.env.NO_AUTH = '1'
      process.env.NODE_ENV = 'test'
      const res = await request(makeTestApp()).get('/users')
      expect(res.status).toBe(200)
    })
  })
})

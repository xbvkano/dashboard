import jwt from 'jsonwebtoken'
import { verifyBearerTokenForRefresh } from '../../src/auth/jwtTokens'

const ADMIN_SECRET = 'test-jwt-admin-secret'
const EMP_SECRET = 'test-jwt-employee-secret'

describe('verifyBearerTokenForRefresh', () => {
  const prevAdmin = process.env.JWT_ADMIN_SECRET
  const prevEmp = process.env.JWT_EMPLOYEE_SECRET
  const prevMax = process.env.JWT_REFRESH_MAX_EXPIRED_SEC

  beforeEach(() => {
    process.env.JWT_ADMIN_SECRET = ADMIN_SECRET
    process.env.JWT_EMPLOYEE_SECRET = EMP_SECRET
    delete process.env.JWT_REFRESH_MAX_EXPIRED_SEC
  })

  afterAll(() => {
    process.env.JWT_ADMIN_SECRET = prevAdmin
    process.env.JWT_EMPLOYEE_SECRET = prevEmp
    process.env.JWT_REFRESH_MAX_EXPIRED_SEC = prevMax
  })

  it('returns payload for unexpired admin token', () => {
    const t = jwt.sign({ role: 'ADMIN' }, ADMIN_SECRET, { subject: '1', expiresIn: '1h' })
    const r = verifyBearerTokenForRefresh(t)
    expect(r).toEqual({ userId: 1, role: 'ADMIN', kind: 'admin' })
  })

  it('returns payload for recently expired token', () => {
    const t = jwt.sign({ role: 'ADMIN' }, ADMIN_SECRET, { subject: '1', expiresIn: '-1h' })
    const r = verifyBearerTokenForRefresh(t)
    expect(r).not.toBeNull()
    expect(r?.userId).toBe(1)
    expect(r?.kind).toBe('admin')
  })

  it('returns null for token expired beyond default grace', () => {
    const t = jwt.sign({ role: 'ADMIN' }, ADMIN_SECRET, { subject: '1', expiresIn: '-100d' })
    expect(verifyBearerTokenForRefresh(t)).toBeNull()
  })

  it('returns null for wrong signature', () => {
    const t = jwt.sign({ role: 'ADMIN' }, 'wrong-secret', { subject: '1', expiresIn: '1h' })
    expect(verifyBearerTokenForRefresh(t)).toBeNull()
  })

  it('returns employee kind for employee-signed token', () => {
    const t = jwt.sign({ role: 'EMPLOYEE' }, EMP_SECRET, { subject: '2', expiresIn: '1h' })
    const r = verifyBearerTokenForRefresh(t)
    expect(r).toEqual({ userId: 2, role: 'EMPLOYEE', kind: 'employee' })
  })
})

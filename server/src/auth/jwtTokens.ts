import jwt from 'jsonwebtoken'
import type { Role } from '@prisma/client'

const DEFAULT_EXPIRES = '24h'

/** Max seconds after access token `exp` before refresh is refused (limits stale leaked tokens). */
const DEFAULT_REFRESH_MAX_EXPIRED_SEC = 90 * 24 * 60 * 60

export type JwtAuthKind = 'admin' | 'employee'

function adminSecret(): string | undefined {
  return process.env.JWT_ADMIN_SECRET?.trim() || undefined
}

function employeeSecret(): string | undefined {
  return process.env.JWT_EMPLOYEE_SECRET?.trim() || undefined
}

export function isAdminRole(role: Role): boolean {
  return role !== 'EMPLOYEE'
}

/** Required in production; call from server startup. */
export function assertJwtSecretsConfiguredForProduction(): void {
  if (process.env.NODE_ENV !== 'production') return
  if (!adminSecret() || !employeeSecret()) {
    throw new Error('JWT_ADMIN_SECRET and JWT_EMPLOYEE_SECRET must be set in production')
  }
}

export function signAccessToken(userId: number, role: Role): string {
  const secret = isAdminRole(role) ? adminSecret() : employeeSecret()
  if (!secret) {
    throw new Error('JWT signing secret not configured')
  }
  const expiresIn = process.env.JWT_ACCESS_EXPIRES_IN?.trim() || DEFAULT_EXPIRES
  return jwt.sign(
    { role },
    secret,
    {
      subject: String(userId),
      expiresIn,
    } as jwt.SignOptions,
  )
}

/** Which signing key validates this token (admin first, then employee). Invalid → null. */
export function verifyBearerToken(token: string): JwtAuthKind | null {
  if (!token) return null
  const a = adminSecret()
  const e = employeeSecret()
  if (a) {
    try {
      jwt.verify(token, a)
      return 'admin'
    } catch {
      /* try employee */
    }
  }
  if (e) {
    try {
      jwt.verify(token, e)
      return 'employee'
    } catch {
      return null
    }
  }
  return null
}

export type RefreshableJwtPayload = {
  userId: number
  role: Role
  kind: JwtAuthKind
}

function parseRoleFromPayload(role: unknown): Role | null {
  if (role === 'ADMIN' || role === 'OWNER' || role === 'EMPLOYEE') return role
  return null
}

/**
 * Verifies JWT signature while ignoring expiration, then allows refresh only if
 * the token is still unexpired OR expired within JWT_REFRESH_MAX_EXPIRED_SEC (default 90d).
 */
export function verifyBearerTokenForRefresh(token: string): RefreshableJwtPayload | null {
  if (!token) return null
  const maxExpiredSec = Number(process.env.JWT_REFRESH_MAX_EXPIRED_SEC?.trim())
  const grace =
    Number.isFinite(maxExpiredSec) && maxExpiredSec > 0 ? maxExpiredSec : DEFAULT_REFRESH_MAX_EXPIRED_SEC

  const a = adminSecret()
  const e = employeeSecret()
  const trySecret = (secret: string, kind: JwtAuthKind): RefreshableJwtPayload | null => {
    let decoded: jwt.JwtPayload
    try {
      decoded = jwt.verify(token, secret, { ignoreExpiration: true }) as jwt.JwtPayload
    } catch {
      return null
    }
    const sub = decoded.sub
    const userId = sub != null ? Number(sub) : NaN
    if (!Number.isFinite(userId) || userId <= 0) return null
    const role = parseRoleFromPayload(decoded.role)
    if (!role) return null
    const exp = decoded.exp
    if (typeof exp !== 'number') return null
    const nowSec = Date.now() / 1000
    if (nowSec > exp) {
      if (nowSec - exp > grace) return null
    }
    return { userId, role, kind }
  }
  if (a) {
    const r = trySecret(a, 'admin')
    if (r) return r
  }
  if (e) {
    const r = trySecret(e, 'employee')
    if (r) return r
  }
  return null
}

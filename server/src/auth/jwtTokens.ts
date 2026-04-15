import jwt from 'jsonwebtoken'
import type { Role } from '@prisma/client'

const DEFAULT_EXPIRES = '8h'

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

import {
  isNgrokBrowserContext,
  loginRequestHeaders,
  persistLoginResponse,
  refreshAccessTokenFromApi,
  resolveApiBaseUrl,
  API_ACCESS_TOKEN_KEY,
} from './api'

export type DevNoAuthRole = 'ADMIN' | 'OWNER' | 'EMPLOYEE'

export type NoAuthLoginProfile = {
  id: string
  label: string
  userName: string
  password: string
  role: DevNoAuthRole
}

/** Seeded accounts for VITE_NO_AUTH auto-login (password users from prisma seed). */
export const NO_AUTH_LOGIN_PROFILES: NoAuthLoginProfile[] = [
  {
    id: 'owner-jwt',
    label: 'Owner — JWT test (7025550199)',
    userName: '7025550199',
    password: 'SeedAdmin!99',
    role: 'OWNER',
  },
  {
    id: 'owner-rita',
    label: 'Owner — Rita Kano',
    userName: '7255774524',
    password: 'password123',
    role: 'OWNER',
  },
  {
    id: 'admin-bob',
    label: 'Admin — Bob',
    userName: 'dev_seed_admin_2',
    password: 'devadmin2',
    role: 'ADMIN',
  },
  {
    id: 'employee-marcos',
    label: 'Employee — Marcos Kano',
    userName: '7255774523',
    password: 'password123',
    role: 'EMPLOYEE',
  },
]

export const DEFAULT_NO_AUTH_LOGIN_PROFILE_ID = 'owner-jwt'

const NO_AUTH_LOGIN_PROFILE_KEY = 'devNoAuthLoginProfile'

/** Default JWT test owner account from prisma seed. */
export const NO_AUTH_JWT_ADMIN =
  NO_AUTH_LOGIN_PROFILES.find((p) => p.id === DEFAULT_NO_AUTH_LOGIN_PROFILE_ID)!

/** Seeded dev admins for DevTools tab switching (no password on id 1). See prisma/seed.ts */
export const DEV_SEED_ADMIN_ACCOUNTS = [
  { id: 1, userName: 'dev_seed_admin', label: 'Alice', hint: 'id 1 · dev_seed_admin' },
  { id: 2, userName: 'dev_seed_admin_2', label: 'Bob', hint: 'id 2 · password devadmin2' },
] as const

const DEV_ADMIN_IDS = new Set(DEV_SEED_ADMIN_ACCOUNTS.map((a) => String(a.id)))

export function isViteNoAuth(): boolean {
  return (
    import.meta.env.VITE_NO_AUTH === 'true' || import.meta.env.VITE_NO_AUTH === '1'
  )
}

export function getNoAuthLoginProfileId(): string {
  const stored = localStorage.getItem(NO_AUTH_LOGIN_PROFILE_KEY)?.trim()
  if (stored && NO_AUTH_LOGIN_PROFILES.some((p) => p.id === stored)) {
    return stored
  }
  return DEFAULT_NO_AUTH_LOGIN_PROFILE_ID
}

export function getNoAuthLoginProfile(): NoAuthLoginProfile {
  const id = getNoAuthLoginProfileId()
  return NO_AUTH_LOGIN_PROFILES.find((p) => p.id === id) ?? NO_AUTH_JWT_ADMIN
}

/** DevTools-only fake session (x-user-id headers; server NO_AUTH may still fill defaults). */
function applyDevTabSwitchSession(): DevNoAuthRole {
  const uidStored = localStorage.getItem('userId')
  const raw = localStorage.getItem('role')
  const role: DevNoAuthRole =
    raw === 'OWNER' || raw === 'EMPLOYEE' || raw === 'ADMIN' ? raw : 'ADMIN'
  const acc = DEV_SEED_ADMIN_ACCOUNTS.find((a) => String(a.id) === uidStored)
  const userName =
    localStorage.getItem('userName')?.trim() || acc?.userName || 'dev_seed_admin'
  localStorage.setItem('role', role)
  localStorage.setItem('userId', uidStored ?? '1')
  localStorage.setItem('userName', userName)
  localStorage.setItem('loginMethod', 'dev')
  localStorage.removeItem(API_ACCESS_TOKEN_KEY)
  return role
}

/**
 * When VITE_NO_AUTH is on: POST /login as the seeded user so Bearer JWT + x-user-id work
 * on fresh origins (e.g. ngrok). DevTools "Use Alice/Bob" keeps header-only dev session.
 */
export async function ensureNoAuthDevSession(): Promise<DevNoAuthRole> {
  const lm = localStorage.getItem('loginMethod')
  const uidStored = localStorage.getItem('userId')
  if (lm === 'dev' && uidStored && DEV_ADMIN_IDS.has(uidStored)) {
    return applyDevTabSwitchSession()
  }

  const creds = getNoAuthLoginProfile()
  const token = localStorage.getItem(API_ACCESS_TOKEN_KEY)
  if (token && localStorage.getItem('userName') === creds.userName) {
    const ok = await refreshAccessTokenFromApi()
    if (ok) {
      const raw = localStorage.getItem('role')
      return raw === 'OWNER' || raw === 'EMPLOYEE' || raw === 'ADMIN' ? raw : creds.role
    }
  }

  let response: Response
  try {
    response = await fetch(`${resolveApiBaseUrl()}/login`, {
      method: 'POST',
      headers: loginRequestHeaders(),
      body: JSON.stringify({ userName: creds.userName, password: creds.password }),
    })
  } catch {
    throw new Error(
      'Cannot reach the API. If you use a tunnel (ngrok / trycloudflare.com), open the app via the tunnel URL (requests go to /api on the same host). Ensure the server is running on port 3000.',
    )
  }
  const text = await response.text()
  let data: { error?: string; role?: string }
  try {
    data = JSON.parse(text) as { error?: string; role?: string }
  } catch {
    throw new Error(
      response.ok
        ? 'NO_AUTH auto-login: invalid server response'
        : `NO_AUTH auto-login failed (${response.status}). ${isNgrokBrowserContext() ? 'Check Vite is running and the API proxy is enabled.' : text.slice(0, 120)}`,
    )
  }
  if (!response.ok) {
    throw new Error(
      typeof data?.error === 'string'
        ? data.error
        : `NO_AUTH auto-login failed (${response.status})`,
    )
  }
  const role = persistLoginResponse(data, 'password')
  if (!role) {
    throw new Error('NO_AUTH auto-login: server did not return a role')
  }
  return role
}

/** @deprecated Use ensureNoAuthDevSession — sync stub for legacy imports */
export function applyNoAuthDevSession(): DevNoAuthRole {
  if (localStorage.getItem('loginMethod') === 'dev') {
    const uid = localStorage.getItem('userId')
    if (uid && DEV_ADMIN_IDS.has(uid)) {
      return applyDevTabSwitchSession()
    }
  }
  const creds = getNoAuthLoginProfile()
  localStorage.setItem('role', creds.role)
  localStorage.setItem('userName', creds.userName)
  localStorage.setItem('loginMethod', 'password')
  return creds.role
}

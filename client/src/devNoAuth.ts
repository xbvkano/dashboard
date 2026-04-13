export type DevNoAuthRole = 'ADMIN' | 'OWNER' | 'EMPLOYEE'

/** Seeded dev admins (password: Alice via Google in seed; Bob uses devadmin2). See prisma/seed.ts */
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

/**
 * When VITE_NO_AUTH is on, mirror a seeded admin so APIs that need x-user-id work.
 * Preserves DevTools "switch dev account" (loginMethod dev + userId 1 or 2) across reloads.
 */
export function applyNoAuthDevSession(): DevNoAuthRole {
  const uidStored = localStorage.getItem('userId')
  const lm = localStorage.getItem('loginMethod')
  if (lm === 'dev' && uidStored && DEV_ADMIN_IDS.has(uidStored)) {
    const raw = localStorage.getItem('role')
    const role: DevNoAuthRole =
      raw === 'OWNER' || raw === 'EMPLOYEE' || raw === 'ADMIN' ? raw : 'ADMIN'
    const acc = DEV_SEED_ADMIN_ACCOUNTS.find((a) => String(a.id) === uidStored)
    const userName =
      localStorage.getItem('userName')?.trim() || acc?.userName || 'dev_seed_admin'
    localStorage.setItem('role', role)
    localStorage.setItem('userId', uidStored)
    localStorage.setItem('userName', userName)
    localStorage.setItem('loginMethod', 'dev')
    return role
  }

  const uid = import.meta.env.VITE_DEV_SEED_ADMIN_USER_ID?.trim() || '1'
  const userName =
    import.meta.env.VITE_DEV_SEED_ADMIN_USER_NAME?.trim() || 'dev_seed_admin'
  const raw = import.meta.env.VITE_DEV_SEED_ADMIN_ROLE?.trim() || 'ADMIN'
  const role: DevNoAuthRole =
    raw === 'OWNER' || raw === 'EMPLOYEE' || raw === 'ADMIN' ? raw : 'ADMIN'

  localStorage.setItem('role', role)
  localStorage.setItem('userId', uid)
  localStorage.setItem('userName', userName)
  localStorage.setItem('loginMethod', 'dev')
  return role
}

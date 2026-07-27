import { Request, Response } from 'express'
import { PrismaClient, Role } from '@prisma/client'
import { parseUserIdHeader } from '../utils/httpUser'
import { ensureEmployeeForDutyUser, isDutyRole } from '../services/ensureEmployeeForDutyUser'

const prisma = new PrismaClient()

const ADMIN_ROLES: Role[] = ['OWNER', 'ADMIN', 'SUPERVISOR']

async function requireOwner(req: Request): Promise<{ id: number; role: Role } | null> {
  const id = parseUserIdHeader(req.headers['x-user-id'])
  if (id == null) return null
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, disabled: true },
  })
  if (!user || user.disabled || user.role !== 'OWNER') return null
  return user
}

function publicAdminUser(u: {
  id: number
  name: string | null
  email: string | null
  userName: string | null
  role: Role
  type: string
  disabled: boolean
  employee: { id: number; disabled: boolean } | null
}) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    userName: u.userName,
    role: u.role,
    type: u.type,
    disabled: u.disabled,
    employeeId: u.employee?.id ?? null,
  }
}

/** GET /admin-accounts — OWNER only. Users with OWNER | ADMIN | SUPERVISOR. */
export async function listAdminAccounts(req: Request, res: Response) {
  try {
    const owner = await requireOwner(req)
    if (!owner) return res.status(403).json({ error: 'Only OWNER can manage admin accounts' })

    const includeDisabled = String(req.query.all) === 'true'
    const users = await prisma.user.findMany({
      where: {
        role: { in: ADMIN_ROLES },
        ...(includeDisabled ? {} : { disabled: false }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        userName: true,
        role: true,
        type: true,
        disabled: true,
        employee: { select: { id: true, disabled: true } },
      },
      orderBy: [{ disabled: 'asc' }, { name: 'asc' }],
    })
    return res.json({ users: users.map(publicAdminUser) })
  } catch (err) {
    console.error('listAdminAccounts', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

/** PATCH /admin-accounts/:id — OWNER only. Update role and/or disabled. */
export async function updateAdminAccount(req: Request, res: Response) {
  try {
    const owner = await requireOwner(req)
    if (!owner) return res.status(403).json({ error: 'Only OWNER can manage admin accounts' })

    const id = parseInt(req.params.id, 10)
    if (!Number.isFinite(id) || id < 1) {
      return res.status(400).json({ error: 'Invalid id' })
    }

    const target = await prisma.user.findUnique({
      where: { id },
      include: { employee: true },
    })
    if (!target) return res.status(404).json({ error: 'User not found' })
    if (!isDutyRole(target.role) && target.role !== 'EMPLOYEE') {
      return res.status(400).json({ error: 'User is not an admin-capable account' })
    }

    const body = req.body as { role?: string; disabled?: boolean }
    const data: { role?: Role; disabled?: boolean } = {}

    if (body.role !== undefined) {
      const role = String(body.role).toUpperCase() as Role
      if (!ADMIN_ROLES.includes(role)) {
        return res.status(400).json({
          error: 'role must be OWNER, ADMIN, or SUPERVISOR',
        })
      }
      data.role = role
    }

    if (body.disabled !== undefined) {
      if (typeof body.disabled !== 'boolean') {
        return res.status(400).json({ error: 'disabled must be boolean' })
      }
      if (body.disabled === true && id === owner.id) {
        return res.status(400).json({ error: 'You cannot disable your own account' })
      }
      data.disabled = body.disabled
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No changes provided' })
    }

    // Prevent removing the last enabled OWNER
    const nextRole = data.role ?? target.role
    const nextDisabled = data.disabled ?? target.disabled
    if (target.role === 'OWNER' && (nextRole !== 'OWNER' || nextDisabled)) {
      const otherOwners = await prisma.user.count({
        where: {
          role: 'OWNER',
          disabled: false,
          id: { not: id },
        },
      })
      if (otherOwners === 0) {
        return res.status(400).json({
          error: 'Cannot demote or disable the last enabled OWNER',
        })
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        userName: true,
        role: true,
        type: true,
        disabled: true,
        employee: { select: { id: true, disabled: true } },
      },
    })

    // Keep a linked Employee enabled/disabled in sync when present; create one when promoting
    if (isDutyRole(updated.role) && !updated.disabled) {
      try {
        await ensureEmployeeForDutyUser(prisma, updated.id)
      } catch (e) {
        console.warn('ensureEmployeeForDutyUser after admin update', e)
      }
    } else if (updated.employee && data.disabled === true) {
      await prisma.employee.update({
        where: { id: updated.employee.id },
        data: { disabled: true },
      })
    }

    const refreshed = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        userName: true,
        role: true,
        type: true,
        disabled: true,
        employee: { select: { id: true, disabled: true } },
      },
    })

    return res.json({ user: publicAdminUser(refreshed!) })
  } catch (err) {
    console.error('updateAdminAccount', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

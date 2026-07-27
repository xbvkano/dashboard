/**
 * Ensure privileged users (OWNER/ADMIN/SUPERVISOR) have an Employee row so
 * on-duty / call-center features that key off Employee.id can include them.
 */
import type { PrismaClient, User, Employee, Role } from '@prisma/client'
import { normalizePhone } from '../utils/phoneUtils'

const DUTY_ROLES: Role[] = ['OWNER', 'ADMIN', 'SUPERVISOR']

export function isDutyRole(role: Role): boolean {
  return DUTY_ROLES.includes(role)
}

function phoneForUser(user: Pick<User, 'id' | 'userName'>): string {
  const fromUserName = user.userName ? normalizePhone(user.userName) : null
  if (fromUserName) return fromUserName
  // Synthetic E.164-ish placeholder unique per user (not a real SMS target)
  return `+1999${String(user.id).padStart(7, '0')}`
}

async function uniqueEmployeeName(
  prisma: PrismaClient,
  baseName: string,
  userId: number,
  excludeEmployeeId?: number,
): Promise<string> {
  const base = (baseName || `Admin ${userId}`).trim() || `Admin ${userId}`
  let candidate = base
  for (let i = 0; i < 20; i++) {
    const existing = await prisma.employee.findUnique({ where: { name: candidate } })
    if (!existing || existing.userId === userId || existing.id === excludeEmployeeId) {
      return candidate
    }
    candidate = `${base} (${userId}${i > 0 ? `-${i}` : ''})`
  }
  return `${base} #${userId}`
}

export async function ensureEmployeeForDutyUser(
  prisma: PrismaClient,
  userId: number,
): Promise<Employee> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { employee: true },
  })
  if (!user) throw new Error('User not found')
  if (!isDutyRole(user.role)) {
    throw new Error('User role is not eligible for on-duty')
  }
  if (user.disabled) {
    throw new Error('User is disabled')
  }
  if (user.employee) {
    if (user.employee.disabled) {
      return prisma.employee.update({
        where: { id: user.employee.id },
        data: { disabled: false },
      })
    }
    return user.employee
  }

  const name = await uniqueEmployeeName(prisma, user.name || `Admin ${user.id}`, user.id)
  const number = phoneForUser(user)

  try {
    return await prisma.employee.create({
      data: {
        name,
        number,
        userId: user.id,
        disabled: false,
        supervisorId: null,
      },
    })
  } catch {
    // Race: employee created concurrently
    const again = await prisma.user.findUnique({
      where: { id: userId },
      include: { employee: true },
    })
    if (again?.employee) return again.employee
    throw new Error('Failed to create employee row for admin user')
  }
}

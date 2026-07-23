import type { PrismaClient, Role } from '@prisma/client'
import { normalizePhone, phoneLookupVariants } from '../utils/phoneUtils'

export const PRIVILEGED_ROLES: Role[] = ['OWNER', 'ADMIN', 'SUPERVISOR']

export type CallerContextResponse =
  | { privileged: true; employeeId: number; name: string; role: Role }
  | { privileged: false }

export type EmployeeByCodeResponse = {
  id: number
  name: string
  phoneNumber: string
  role: Role | null
}

export type OnDutyCandidate = {
  employeeId: number
  name: string
  phoneNumber: string
  role: Role | null
  priority: number
}

export type OnDutyResponse = {
  candidates: OnDutyCandidate[]
}

/** Parse keypad code "001" / "34" → employee id. */
export function parseEmployeeCode(code: string): number | null {
  const trimmed = code.trim()
  if (!/^\d{1,6}$/.test(trimmed)) return null
  const id = parseInt(trimmed, 10)
  if (!Number.isFinite(id) || id < 1) return null
  return id
}

export async function getCallerContext(
  prisma: PrismaClient,
  phoneRaw: string
): Promise<CallerContextResponse> {
  const e164 = normalizePhone(phoneRaw)
  if (!e164) return { privileged: false }

  const variants = phoneLookupVariants(e164)
  const employee = await prisma.employee.findFirst({
    where: {
      disabled: false,
      number: { in: variants },
      user: { role: { in: PRIVILEGED_ROLES } },
    },
    include: { user: { select: { role: true } } },
  })

  if (!employee?.user) return { privileged: false }

  return {
    privileged: true,
    employeeId: employee.id,
    name: employee.name,
    role: employee.user.role,
  }
}

export async function getEmployeeByCode(
  prisma: PrismaClient,
  code: string
): Promise<EmployeeByCodeResponse | null> {
  const id = parseEmployeeCode(code)
  if (id == null) return null

  const employee = await prisma.employee.findFirst({
    where: { id, disabled: false },
    include: { user: { select: { role: true } } },
  })
  if (!employee) return null

  return {
    id: employee.id,
    name: employee.name,
    phoneNumber: employee.number,
    role: employee.user?.role ?? null,
  }
}

export async function getOnDutyCandidates(
  prisma: PrismaClient,
  at: Date
): Promise<OnDutyResponse> {
  const rows = await prisma.onDutySchedule.findMany({
    where: {
      active: true,
      startAt: { lte: at },
      endAt: { gt: at },
      employee: { disabled: false },
    },
    include: {
      employee: {
        include: { user: { select: { role: true } } },
      },
    },
    orderBy: [{ priority: 'asc' }, { id: 'asc' }],
  })

  return {
    candidates: rows.map((row) => ({
      employeeId: row.employeeId,
      name: row.employee.name,
      phoneNumber: row.employee.number,
      role: row.employee.user?.role ?? null,
      priority: row.priority,
    })),
  }
}

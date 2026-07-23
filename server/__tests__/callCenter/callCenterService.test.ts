import type { PrismaClient, Role } from '@prisma/client'
import {
  getCallerContext,
  getEmployeeByCode,
  getOnDutyCandidates,
  parseEmployeeCode,
} from '../../src/services/callCenterService'

function mockPrisma(overrides: {
  findFirstEmployee?: jest.Mock
  findManyOnDuty?: jest.Mock
}): PrismaClient {
  return {
    employee: {
      findFirst: overrides.findFirstEmployee ?? jest.fn(),
    },
    onDutySchedule: {
      findMany: overrides.findManyOnDuty ?? jest.fn(),
    },
  } as unknown as PrismaClient
}

describe('parseEmployeeCode', () => {
  it('parses zero-padded codes', () => {
    expect(parseEmployeeCode('001')).toBe(1)
    expect(parseEmployeeCode('034')).toBe(34)
    expect(parseEmployeeCode('100')).toBe(100)
  })

  it('rejects empty and non-numeric', () => {
    expect(parseEmployeeCode('')).toBeNull()
    expect(parseEmployeeCode('abc')).toBeNull()
    expect(parseEmployeeCode('0')).toBeNull()
  })
})

describe('getCallerContext', () => {
  it('returns privileged false for invalid phone', async () => {
    const prisma = mockPrisma({})
    await expect(getCallerContext(prisma, 'nope')).resolves.toEqual({ privileged: false })
  })

  it('returns privileged false when no matching employee', async () => {
    const findFirst = jest.fn().mockResolvedValue(null)
    const prisma = mockPrisma({ findFirstEmployee: findFirst })
    await expect(getCallerContext(prisma, '+17025551212')).resolves.toEqual({
      privileged: false,
    })
    expect(findFirst).toHaveBeenCalled()
  })

  it('returns privileged true for OWNER linked employee', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: 2,
      name: 'Alex',
      user: { role: 'OWNER' as Role },
    })
    const prisma = mockPrisma({ findFirstEmployee: findFirst })
    await expect(getCallerContext(prisma, '7025551212')).resolves.toEqual({
      privileged: true,
      employeeId: 2,
      name: 'Alex',
      role: 'OWNER',
    })
  })

  it('ignores employees without privileged user role via query filter', async () => {
    const findFirst = jest.fn().mockResolvedValue(null)
    const prisma = mockPrisma({ findFirstEmployee: findFirst })
    await getCallerContext(prisma, '+17025551212')
    const where = findFirst.mock.calls[0][0].where
    expect(where.user.role.in).toEqual(
      expect.arrayContaining(['OWNER', 'ADMIN', 'SUPERVISOR'])
    )
    expect(where.disabled).toBe(false)
  })
})

describe('getEmployeeByCode', () => {
  it('returns null for bad code', async () => {
    const prisma = mockPrisma({})
    await expect(getEmployeeByCode(prisma, 'xx')).resolves.toBeNull()
  })

  it('returns null when employee missing or disabled', async () => {
    const findFirst = jest.fn().mockResolvedValue(null)
    const prisma = mockPrisma({ findFirstEmployee: findFirst })
    await expect(getEmployeeByCode(prisma, '001')).resolves.toBeNull()
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1, disabled: false },
      })
    )
  })

  it('returns employee payload for valid code', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: 34,
      name: 'Maria',
      number: '+17025559999',
      user: { role: 'EMPLOYEE' as Role },
    })
    const prisma = mockPrisma({ findFirstEmployee: findFirst })
    await expect(getEmployeeByCode(prisma, '034')).resolves.toEqual({
      id: 34,
      name: 'Maria',
      phoneNumber: '+17025559999',
      role: 'EMPLOYEE',
    })
  })
})

describe('getOnDutyCandidates', () => {
  it('returns empty candidates when none on duty', async () => {
    const findMany = jest.fn().mockResolvedValue([])
    const prisma = mockPrisma({ findManyOnDuty: findMany })
    const at = new Date('2026-07-22T18:00:00.000Z')
    await expect(getOnDutyCandidates(prisma, at)).resolves.toEqual({ candidates: [] })
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          active: true,
          startAt: { lte: at },
          endAt: { gt: at },
          employee: { disabled: false },
        }),
        orderBy: [{ priority: 'asc' }, { id: 'asc' }],
      })
    )
  })

  it('maps schedule rows to candidates in priority order', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        employeeId: 2,
        priority: 0,
        employee: {
          name: 'Alex',
          number: '+17025550001',
          user: { role: 'OWNER' },
        },
      },
      {
        employeeId: 5,
        priority: 1,
        employee: {
          name: 'Sam',
          number: '+17025550002',
          user: { role: 'ADMIN' },
        },
      },
    ])
    const prisma = mockPrisma({ findManyOnDuty: findMany })
    await expect(
      getOnDutyCandidates(prisma, new Date('2026-07-22T18:00:00.000Z'))
    ).resolves.toEqual({
      candidates: [
        {
          employeeId: 2,
          name: 'Alex',
          phoneNumber: '+17025550001',
          role: 'OWNER',
          priority: 0,
        },
        {
          employeeId: 5,
          name: 'Sam',
          phoneNumber: '+17025550002',
          role: 'ADMIN',
          priority: 1,
        },
      ],
    })
  })
})

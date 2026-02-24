/**
 * Tests for schedule policy features: getSchedule returns nextScheduleUpdateDueAt,
 * saveSchedule sets nextScheduleUpdateDueAt, getSchedulePolicy.
 * Uses test user Marcos Kano (x-user-name: 7255774523).
 */

const mockUserFindUnique = jest.fn()
const mockScheduleFindUnique = jest.fn()
const mockScheduleCreate = jest.fn()
const mockScheduleUpdate = jest.fn()
const mockSchedulePolicyFindUnique = jest.fn()

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    user: {
      findUnique: mockUserFindUnique,
    },
    schedule: {
      findUnique: mockScheduleFindUnique,
      create: mockScheduleCreate,
      update: mockScheduleUpdate,
    },
    schedulePolicy: {
      findUnique: mockSchedulePolicyFindUnique,
    },
  })),
}))

import { Request, Response } from 'express'
import { getSchedule, saveSchedule } from '../src/controllers/employeeScheduleController'
import { getSchedulePolicy } from '../src/controllers/employeesController'

function mockRequest(overrides: Partial<Request> = {}): Request {
  return {
    headers: { 'x-user-name': '7255774523' },
    body: {},
    ...overrides,
  } as Request
}

function mockResponse(): Response {
  const res = {} as Response
  res.status = jest.fn().mockReturnThis()
  res.json = jest.fn().mockReturnThis()
  return res
}

describe('Schedule policy and nextScheduleUpdateDueAt', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUserFindUnique.mockResolvedValue({
      employee: { id: 10, disabled: false },
    })
    mockSchedulePolicyFindUnique.mockResolvedValue({
      id: 1,
      updateDayOfWeek: 0,
      supervisorNotifyAfterDays: 4,
      stopRemindingAfterDays: 7,
    })
  })

  describe('getSchedule', () => {
    it('returns nextScheduleUpdateDueAt as date-only string (YYYY-MM-DD) when schedule exists', async () => {
      const dueDate = new Date(2026, 1, 22, 0, 0, 0, 0) // Sunday Feb 22, 2026
      mockScheduleFindUnique.mockResolvedValue({
        employeeId: 10,
        futureSchedule: [],
        pastSchedule: [],
        employeeUpdate: new Date(2026, 1, 15),
        nextScheduleUpdateDueAt: dueDate,
      })
      const req = mockRequest()
      const res = mockResponse()
      await getSchedule(req, res)
      expect(res.status).not.toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledTimes(1)
      const payload = (res.json as jest.Mock).mock.calls[0][0]
      expect(payload.nextScheduleUpdateDueAt).toBe('2026-02-22')
      expect(payload.futureSchedule).toEqual([])
      expect(payload.employeeUpdate).toBeDefined()
    })

    it('creates schedule with nextScheduleUpdateDueAt when none exists', async () => {
      mockScheduleFindUnique.mockResolvedValue(null)
      mockScheduleCreate.mockImplementation((args: { data: unknown }) =>
        Promise.resolve({
          employeeId: 10,
          futureSchedule: [],
          pastSchedule: [],
          employeeUpdate: args.data && typeof args.data === 'object' && (args.data as any).employeeUpdate,
          nextScheduleUpdateDueAt: args.data && typeof args.data === 'object' && (args.data as any).nextScheduleUpdateDueAt,
        })
      )
      const req = mockRequest()
      const res = mockResponse()
      await getSchedule(req, res)
      expect(mockSchedulePolicyFindUnique).toHaveBeenCalledWith({ where: { id: 1 } })
      expect(mockScheduleCreate).toHaveBeenCalled()
      const createData = mockScheduleCreate.mock.calls[0][0].data
      expect(createData.nextScheduleUpdateDueAt).toBeInstanceOf(Date)
      expect(createData.employeeId).toBe(10)
      const payload = (res.json as jest.Mock).mock.calls[0][0]
      expect(payload.nextScheduleUpdateDueAt).toBeDefined()
    })

    it('updates schedule to set nextScheduleUpdateDueAt when it is null', async () => {
      mockScheduleFindUnique.mockResolvedValue({
        employeeId: 10,
        id: 1,
        futureSchedule: [],
        pastSchedule: [],
        employeeUpdate: new Date(),
        nextScheduleUpdateDueAt: null,
      })
      mockScheduleUpdate.mockImplementation((args: { data: unknown }) =>
        Promise.resolve({
          employeeId: 10,
          futureSchedule: [],
          pastSchedule: [],
          employeeUpdate: new Date(),
          nextScheduleUpdateDueAt: args.data && typeof args.data === 'object' && (args.data as any).nextScheduleUpdateDueAt,
        })
      )
      const req = mockRequest()
      const res = mockResponse()
      await getSchedule(req, res)
      expect(mockScheduleUpdate).toHaveBeenCalledWith({
        where: { employeeId: 10 },
        data: { nextScheduleUpdateDueAt: expect.any(Date) },
      })
      const payload = (res.json as jest.Mock).mock.calls[0][0]
      expect(payload.nextScheduleUpdateDueAt).toBeDefined()
    })
  })

  describe('saveSchedule', () => {
    it('updates nextScheduleUpdateDueAt to next policy day when saving', async () => {
      const existingDue = new Date(2026, 1, 15, 0, 0, 0, 0)
      mockScheduleFindUnique.mockResolvedValue({
        employeeId: 10,
        id: 1,
        futureSchedule: ['2026-03-01-M-F'],
        pastSchedule: [],
        employeeUpdate: new Date(),
        nextScheduleUpdateDueAt: existingDue,
      })
      mockScheduleUpdate.mockImplementation((args: { where: unknown; data: Record<string, unknown> }) =>
        Promise.resolve({
          employeeId: 10,
          futureSchedule: args.data?.futureSchedule ?? [],
          pastSchedule: args.data?.pastSchedule ?? [],
          employeeUpdate: args.data?.employeeUpdate,
          nextScheduleUpdateDueAt: args.data?.nextScheduleUpdateDueAt,
        })
      )
      const req = mockRequest({
        body: { futureSchedule: ['2026-03-05-M-F', '2026-03-05-A-F'] },
      }) as Request
      const res = mockResponse()
      await saveSchedule(req, res)
      expect(mockSchedulePolicyFindUnique).toHaveBeenCalledWith({ where: { id: 1 } })
      expect(mockScheduleUpdate).toHaveBeenCalled()
      const updateData = mockScheduleUpdate.mock.calls[0][0].data
      expect(updateData.nextScheduleUpdateDueAt).toBeInstanceOf(Date)
      expect(updateData.employeeUpdate).toBeInstanceOf(Date)
    })
  })

  describe('getSchedulePolicy', () => {
    it('returns policy with updateDayOfWeek, supervisorNotifyAfterDays, stopRemindingAfterDays', async () => {
      const req = mockRequest() as Request
      const res = mockResponse()
      await getSchedulePolicy(req, res)
      expect(mockSchedulePolicyFindUnique).toHaveBeenCalledWith({ where: { id: 1 } })
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          updateDayOfWeek: 0,
          supervisorNotifyAfterDays: 4,
          stopRemindingAfterDays: 7,
        })
      )
    })
  })
})

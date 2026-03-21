/**
 * Tests for admin PUT /employees/:id/schedule – update employee schedule (e.g. remove availability slots).
 * Used when viewing an employee's schedule and deleting selected availability blocks.
 */

const mockScheduleFindUnique = jest.fn()
const mockScheduleUpdate = jest.fn()
const mockScheduleCreate = jest.fn()
const mockSchedulePolicyFindUnique = jest.fn()

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    schedule: {
      findUnique: mockScheduleFindUnique,
      update: mockScheduleUpdate,
      create: mockScheduleCreate,
    },
    schedulePolicy: {
      findUnique: mockSchedulePolicyFindUnique,
    },
  })),
}))

import { Request, Response } from 'express'
import { updateEmployeeSchedule } from '../src/controllers/employeesController'

function mockRequest(overrides: Partial<Request> = {}): Request {
  return {
    params: { id: '1' },
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

describe('updateEmployeeSchedule (PUT /employees/:id/schedule)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSchedulePolicyFindUnique.mockResolvedValue({
      id: 1,
      updateDayOfWeek: 0,
      supervisorNotifyAfterDays: 4,
      stopRemindingAfterDays: 7,
    })
  })

  describe('validation', () => {
    it('returns 400 when id is invalid (NaN)', async () => {
      const req = mockRequest({ params: { id: 'abc' } })
      const res = mockResponse()
      await updateEmployeeSchedule(req, res)
      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid id' })
      expect(mockScheduleFindUnique).not.toHaveBeenCalled()
    })

    it('returns 400 when body.futureSchedule is not an array', async () => {
      const req = mockRequest({ params: { id: '5' }, body: { futureSchedule: 'not-array' } })
      const res = mockResponse()
      await updateEmployeeSchedule(req, res)
      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid schedule format' })
      expect(mockScheduleFindUnique).not.toHaveBeenCalled()
    })

    it('returns 400 when body.futureSchedule is missing', async () => {
      const req = mockRequest({ params: { id: '5' }, body: {} })
      const res = mockResponse()
      await updateEmployeeSchedule(req, res)
      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid schedule format' })
    })

    it('returns 400 when futureSchedule contains invalid entries (bad format)', async () => {
      const req = mockRequest({
        params: { id: '5' },
        body: { futureSchedule: ['2026-03-05-M-F', 'invalid-entry', '2026-03-06-A-F'] },
      })
      const res = mockResponse()
      await updateEmployeeSchedule(req, res)
      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Invalid schedule entries',
          invalidEntries: expect.any(Array),
        })
      )
      expect(mockScheduleFindUnique).not.toHaveBeenCalled()
    })

    it('returns 400 when futureSchedule has invalid type (not M or A)', async () => {
      const req = mockRequest({
        params: { id: '5' },
        body: { futureSchedule: ['2026-03-05-X-F'] },
      })
      const res = mockResponse()
      await updateEmployeeSchedule(req, res)
      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Invalid schedule entries' })
      )
    })

    it('returns 400 when futureSchedule has invalid status (not F or B)', async () => {
      const req = mockRequest({
        params: { id: '5' },
        body: { futureSchedule: ['2026-03-05-M-X'] },
      })
      const res = mockResponse()
      await updateEmployeeSchedule(req, res)
      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Invalid schedule entries' })
      )
    })
  })

  describe('updating existing schedule', () => {
    it('updates schedule and returns new futureSchedule when employee has schedule', async () => {
      const existingSchedule = {
        id: 1,
        employeeId: 5,
        futureSchedule: ['2026-03-10-M-F', '2026-03-10-A-F', '2026-03-11-M-F'],
        pastSchedule: [],
        employeeUpdate: new Date(),
        nextScheduleUpdateDueAt: new Date(),
      }
      mockScheduleFindUnique.mockResolvedValue(existingSchedule)
      mockScheduleUpdate.mockImplementation((args: { data: { futureSchedule: string[] } }) =>
        Promise.resolve({ ...existingSchedule, futureSchedule: args.data.futureSchedule })
      )

      const newFuture = ['2026-03-10-A-F', '2026-03-11-M-F']
      const req = mockRequest({
        params: { id: '5' },
        body: { futureSchedule: newFuture },
      })
      const res = mockResponse()
      await updateEmployeeSchedule(req, res)

      expect(mockScheduleFindUnique).toHaveBeenCalledWith({ where: { employeeId: 5 } })
      expect(mockScheduleUpdate).toHaveBeenCalledWith({
        where: { employeeId: 5 },
        data: expect.objectContaining({
          futureSchedule: expect.any(Array),
          pastSchedule: expect.any(Array),
        }),
      })
      expect(mockScheduleCreate).not.toHaveBeenCalled()
      expect(res.status).not.toHaveBeenCalledWith(400)
      expect(res.status).not.toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          futureSchedule: expect.any(Array),
        })
      )
    })

    it('accepts valid entries with F (free) and B (busy) status', async () => {
      mockScheduleFindUnique.mockResolvedValue({
        id: 1,
        employeeId: 6,
        futureSchedule: ['2026-03-10-M-F', '2026-03-10-A-B'],
        pastSchedule: [],
        employeeUpdate: new Date(),
        nextScheduleUpdateDueAt: new Date(),
      })
      mockScheduleUpdate.mockResolvedValue({})

      // Use dates far in the future so they stay in futureSchedule (not moved to past)
      const req = mockRequest({
        params: { id: '6' },
        body: {
          futureSchedule: [
            '2030-03-15-M-F',
            '2030-03-15-A-F',
            '2030-03-16-M-B',
            '2030-03-16-A-B',
          ],
        },
      })
      const res = mockResponse()
      await updateEmployeeSchedule(req, res)

      expect(res.status).not.toHaveBeenCalledWith(400)
      expect(mockScheduleUpdate).toHaveBeenCalled()
      const updateData = mockScheduleUpdate.mock.calls[0][0].data
      expect(updateData.futureSchedule).toHaveLength(4)
    })

    it('allows empty futureSchedule (removing all availability)', async () => {
      mockScheduleFindUnique.mockResolvedValue({
        id: 1,
        employeeId: 7,
        futureSchedule: ['2026-03-12-M-F'],
        pastSchedule: [],
        employeeUpdate: new Date(),
        nextScheduleUpdateDueAt: new Date(),
      })
      mockScheduleUpdate.mockResolvedValue({
        employeeId: 7,
        futureSchedule: [],
        pastSchedule: [],
      })

      const req = mockRequest({
        params: { id: '7' },
        body: { futureSchedule: [] },
      })
      const res = mockResponse()
      await updateEmployeeSchedule(req, res)

      expect(mockScheduleUpdate).toHaveBeenCalledWith({
        where: { employeeId: 7 },
        data: expect.objectContaining({
          futureSchedule: [],
        }),
      })
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          futureSchedule: [],
        })
      )
    })
  })

  describe('creating schedule when none exists', () => {
    it('creates schedule and sets nextScheduleUpdateDueAt when employee has no schedule', async () => {
      mockScheduleFindUnique.mockResolvedValue(null)
      mockScheduleCreate.mockImplementation((args: { data: unknown }) => {
        const data = args.data as { employeeId: number; futureSchedule: string[]; nextScheduleUpdateDueAt: Date }
        return Promise.resolve({
          employeeId: data.employeeId,
          futureSchedule: data.futureSchedule,
          pastSchedule: [],
          nextScheduleUpdateDueAt: data.nextScheduleUpdateDueAt,
        })
      })

      const req = mockRequest({
        params: { id: '99' },
        body: { futureSchedule: ['2026-04-01-M-F', '2026-04-01-A-F'] },
      })
      const res = mockResponse()
      await updateEmployeeSchedule(req, res)

      expect(mockScheduleFindUnique).toHaveBeenCalledWith({ where: { employeeId: 99 } })
      expect(mockScheduleUpdate).not.toHaveBeenCalled()
      expect(mockSchedulePolicyFindUnique).toHaveBeenCalledWith({ where: { id: 1 } })
      expect(mockScheduleCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          employeeId: 99,
          futureSchedule: expect.any(Array),
          pastSchedule: expect.any(Array),
          nextScheduleUpdateDueAt: expect.any(Date),
        }),
      })
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          futureSchedule: expect.any(Array),
        })
      )
    })
  })

  describe('move past dates', () => {
    it('moves past-dated entries to pastSchedule when updating', async () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const pastStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}-M-F`
      const futureStr = '2026-12-01-M-F'

      mockScheduleFindUnique.mockResolvedValue({
        id: 1,
        employeeId: 3,
        futureSchedule: [],
        pastSchedule: [],
        employeeUpdate: new Date(),
        nextScheduleUpdateDueAt: new Date(),
      })
      mockScheduleUpdate.mockImplementation((args: { data: { futureSchedule: string[]; pastSchedule: string[] } }) =>
        Promise.resolve({ futureSchedule: args.data.futureSchedule, pastSchedule: args.data.pastSchedule })
      )

      const req = mockRequest({
        params: { id: '3' },
        body: { futureSchedule: [pastStr, futureStr] },
      })
      const res = mockResponse()
      await updateEmployeeSchedule(req, res)

      const updateCall = mockScheduleUpdate.mock.calls[0][0]
      expect(updateCall.data.futureSchedule).toContain(futureStr)
      expect(updateCall.data.futureSchedule).not.toContain(pastStr)
      expect(updateCall.data.pastSchedule).toContain(pastStr)
    })
  })

  describe('error handling', () => {
    it('returns 500 when database throws', async () => {
      mockScheduleFindUnique.mockRejectedValue(new Error('DB error'))
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

      const req = mockRequest({
        params: { id: '5' },
        body: { futureSchedule: ['2026-03-05-M-F'] },
      })
      const res = mockResponse()
      await updateEmployeeSchedule(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to update schedule' })
      consoleSpy.mockRestore()
    })
  })
})

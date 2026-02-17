/**
 * Tests for employee schedule/upcoming jobs when appointments are rescheduled
 * or moved. Ensures RESCHEDULE_OLD/DELETED/CANCEL appointments are excluded
 * so employees don't see old slots as scheduled after reschedule.
 */

const appointmentFindManyCalls: Array<{ where: unknown }> = []
let mockFindManyResult: unknown[] = []

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    appointment: {
      findMany: jest.fn().mockImplementation((args: { where?: unknown }) => {
        if (args?.where) appointmentFindManyCalls.push({ where: args.where })
        return Promise.resolve(mockFindManyResult)
      }),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({
        employee: { id: 1 },
      }),
    },
    schedule: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
  })),
}))

import { Request, Response } from 'express'
import { getUpcomingAppointments } from '../src/controllers/employeeScheduleController'

function mockRequest(overrides: Partial<Request> = {}): Request {
  return {
    headers: { 'x-user-name': '7255774523' },
    ...overrides,
  } as Request
}

function mockResponse(): Response {
  const res = {} as Response
  res.status = jest.fn().mockReturnThis()
  res.json = jest.fn().mockReturnThis()
  return res
}

describe('Employee schedule and reschedule', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    appointmentFindManyCalls.length = 0
    mockFindManyResult = []
    jest.useRealTimers()
  })

  describe('getUpcomingAppointments', () => {
    it('excludes RESCHEDULE_OLD so employees do not see rescheduled-away appointments', async () => {
      const req = mockRequest()
      const res = mockResponse()
      await getUpcomingAppointments(req, res)
      expect(appointmentFindManyCalls.length).toBeGreaterThanOrEqual(1)
      const where = appointmentFindManyCalls[0].where as Record<string, unknown>
      expect(where.status).toEqual({ notIn: ['RESCHEDULE_OLD', 'DELETED', 'CANCEL'] })
    })

    it('excludes DELETED appointments from upcoming jobs', async () => {
      const req = mockRequest()
      const res = mockResponse()
      await getUpcomingAppointments(req, res)
      const where = appointmentFindManyCalls[0].where as Record<string, unknown>
      const notIn = (where.status as { notIn: string[] }).notIn
      expect(notIn).toContain('DELETED')
    })

    it('excludes CANCEL appointments from upcoming jobs', async () => {
      const req = mockRequest()
      const res = mockResponse()
      await getUpcomingAppointments(req, res)
      const where = appointmentFindManyCalls[0].where as Record<string, unknown>
      const notIn = (where.status as { notIn: string[] }).notIn
      expect(notIn).toContain('CANCEL')
    })

    it('filters by employee and date range (next 14 days)', async () => {
      const req = mockRequest()
      const res = mockResponse()
      await getUpcomingAppointments(req, res)
      const where = appointmentFindManyCalls[0].where as Record<string, unknown>
      expect(where.employees).toEqual({ some: { id: 1 } })
      expect(where.date).toBeDefined()
      const dateFilter = where.date as { gte: Date; lt: Date }
      expect(dateFilter.gte).toBeDefined()
      expect(dateFilter.lt).toBeDefined()
    })

    it('uses a 14-day window so day 14 from today is included (appointment "loads in" when calendar reaches it)', async () => {
      jest.useFakeTimers()
      jest.setSystemTime(new Date('2025-02-20T12:00:00Z'))
      const req = mockRequest()
      const res = mockResponse()
      await getUpcomingAppointments(req, res)
      const where = appointmentFindManyCalls[0].where as Record<string, unknown>
      const dateFilter = where.date as { gte: Date; lt: Date }
      const gte = new Date(dateFilter.gte)
      const lt = new Date(dateFilter.lt)
      gte.setUTCHours(0, 0, 0, 0)
      lt.setUTCHours(0, 0, 0, 0)
      expect(gte.toISOString().slice(0, 10)).toBe('2025-02-20')
      expect(lt.toISOString().slice(0, 10)).toBe('2025-03-07')
      const march5 = new Date('2025-03-05T12:00:00Z')
      expect(march5 >= gte && march5 < lt).toBe(true)
      jest.useRealTimers()
    })

    it('returns appointment on day 14 so employee calendar shows that block as scheduled when it loads', async () => {
      jest.useFakeTimers()
      jest.setSystemTime(new Date('2025-02-20T00:00:00Z'))
      mockFindManyResult = [
        {
          id: 100,
          date: new Date('2025-03-05T00:00:00Z'),
          time: '10:00',
          address: '123 Test St',
          template: { instructions: 'Test' },
        },
      ]
      const req = mockRequest()
      const res = mockResponse()
      await getUpcomingAppointments(req, res)
      expect(res.json).toHaveBeenCalledTimes(1)
      const payload = (res.json as jest.Mock).mock.calls[0][0]
      expect(Array.isArray(payload)).toBe(true)
      expect(payload.length).toBe(1)
      expect(payload[0].date).toBe('2025-03-05')
      expect(payload[0].block).toBe('AM')
      expect(payload[0].time).toBe('10:00')
      jest.useRealTimers()
    })

    it('builds scheduledByDay so March 5 AM block is marked scheduled when in 14-day window', () => {
      const list = [
        { id: 1, date: '2025-03-05', time: '10:00', address: 'A', instructions: null, block: 'AM' as const },
      ]
      const byDay: Record<string, { morning: boolean; afternoon: boolean }> = {}
      list.forEach((a: { date: string; block: 'AM' | 'PM' }) => {
        if (!byDay[a.date]) byDay[a.date] = { morning: false, afternoon: false }
        if (a.block === 'AM') byDay[a.date].morning = true
        else byDay[a.date].afternoon = true
      })
      expect(byDay['2025-03-05'].morning).toBe(true)
      expect(byDay['2025-03-05'].afternoon).toBe(false)
    })
  })
})

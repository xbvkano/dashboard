/**
 * Tests for employee schedule/upcoming jobs when appointments are rescheduled
 * or moved. Ensures RESCHEDULE_OLD/DELETED/CANCEL appointments are excluded
 * so employees don't see old slots as scheduled after reschedule.
 */

const appointmentFindManyCalls: Array<{ where: unknown }> = []
let mockFindManyResult: unknown[] = []
const payrollItemFindFirst = jest.fn()
const payrollItemUpdate = jest.fn()
const mockMessagesCreate = jest.fn().mockResolvedValue({ sid: 'SM123' })

jest.mock('twilio', () =>
  jest.fn().mockReturnValue({
    messages: { create: (...args: unknown[]) => mockMessagesCreate(...args) },
  })
)

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
    payrollItem: {
      findFirst: payrollItemFindFirst,
      update: payrollItemUpdate,
    },
  })),
}))

import { Request, Response } from 'express'
import { getUpcomingAppointments, confirmJob } from '../src/controllers/employeeScheduleController'

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
          payrollItems: [],
          employees: [{ id: 1 }],
          type: 'STANDARD',
          size: '2000',
          carpetRooms: null,
          carpetEmployees: [],
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

    it('returns confirmed: true when payroll item has confirmed true', async () => {
      jest.useFakeTimers()
      jest.setSystemTime(new Date('2025-02-20T00:00:00Z'))
      mockFindManyResult = [
        {
          id: 101,
          date: new Date('2025-03-06T00:00:00Z'),
          time: '14:00',
          address: '456 Test Ave',
          template: { instructions: null },
          payrollItems: [{ employeeId: 1, amount: 80, confirmed: true, extras: [] }],
          employees: [{ id: 1 }],
          type: 'STANDARD',
          size: '2000',
          carpetRooms: null,
          carpetEmployees: [],
        },
      ]
      const req = mockRequest()
      const res = mockResponse()
      await getUpcomingAppointments(req, res)
      const payload = (res.json as jest.Mock).mock.calls[0][0]
      expect(payload[0].confirmed).toBe(true)
      jest.useRealTimers()
    })

    it('returns confirmed: false when payroll item has confirmed false', async () => {
      jest.useFakeTimers()
      jest.setSystemTime(new Date('2025-02-20T00:00:00Z'))
      mockFindManyResult = [
        {
          id: 102,
          date: new Date('2025-03-07T00:00:00Z'),
          time: '09:00',
          address: '789 Unconfirmed St',
          template: { instructions: null },
          payrollItems: [{ employeeId: 1, amount: 80, confirmed: false, extras: [] }],
          employees: [{ id: 1 }],
          type: 'STANDARD',
          size: '2000',
          carpetRooms: null,
          carpetEmployees: [],
        },
      ]
      const req = mockRequest()
      const res = mockResponse()
      await getUpcomingAppointments(req, res)
      const payload = (res.json as jest.Mock).mock.calls[0][0]
      expect(payload[0].confirmed).toBe(false)
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

  describe('confirmJob', () => {
    beforeEach(() => {
      payrollItemFindFirst.mockReset()
      payrollItemUpdate.mockReset()
    })

    it('returns 400 when appointmentId is missing', async () => {
      const req = mockRequest({ body: {} }) as Request
      const res = mockResponse()
      await confirmJob(req, res)
      expect(res.status).toHaveBeenCalledWith(400)
      expect(payrollItemFindFirst).not.toHaveBeenCalled()
    })

    it('returns 404 when job is not assigned to employee', async () => {
      payrollItemFindFirst.mockResolvedValue(null)
      const req = mockRequest({ body: { appointmentId: 999 } }) as Request
      const res = mockResponse()
      await confirmJob(req, res)
      expect(payrollItemFindFirst).toHaveBeenCalledWith({
        where: { appointmentId: 999, employeeId: 1 },
        include: {
          appointment: { include: { client: true } },
          employee: { include: { supervisor: { include: { employee: true } } } },
        },
      })
      expect(res.status).toHaveBeenCalledWith(404)
      expect(payrollItemUpdate).not.toHaveBeenCalled()
    })

    it('sets confirmed to true and returns success when job is assigned to employee', async () => {
      payrollItemFindFirst.mockResolvedValue({ id: 50, appointmentId: 100, employeeId: 1 })
      payrollItemUpdate.mockResolvedValue({})
      const req = mockRequest({ body: { appointmentId: 100 } }) as Request
      const res = mockResponse()
      await confirmJob(req, res)
      expect(payrollItemFindFirst).toHaveBeenCalledWith({
        where: { appointmentId: 100, employeeId: 1 },
        include: {
          appointment: { include: { client: true } },
          employee: { include: { supervisor: { include: { employee: true } } } },
        },
      })
      expect(payrollItemUpdate).toHaveBeenCalledWith({
        where: { id: 50 },
        data: { confirmed: true },
      })
      expect(res.json).toHaveBeenCalledWith({ success: true, confirmed: true })
    })

    it('sends SMS to supervisor when employee has supervisor with phone and TWILIO_FROM_NUMBER is set', async () => {
      const fromNumber = '+15551234567'
      const originalFrom = process.env.TWILIO_FROM_NUMBER
      process.env.TWILIO_FROM_NUMBER = fromNumber
      mockMessagesCreate.mockClear()

      payrollItemFindFirst.mockResolvedValue({
        id: 50,
        appointmentId: 100,
        employeeId: 1,
        appointment: {
          id: 100,
          date: new Date('2025-03-15'),
          time: '10:00',
          client: { id: 1, name: 'Test Client' },
        },
        employee: {
          id: 1,
          name: 'Jane Doe',
          supervisorId: 5,
          supervisor: {
            id: 5,
            userName: '7255774524',
            employee: { number: '7255774524' },
          },
        },
      })
      payrollItemUpdate.mockResolvedValue({})

      const req = mockRequest({ body: { appointmentId: 100 } }) as Request
      const res = mockResponse()
      await confirmJob(req, res)

      expect(mockMessagesCreate).toHaveBeenCalledTimes(1)
      expect(mockMessagesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          from: fromNumber,
          to: expect.stringMatching(/^\+1\d{10}$/),
          body: expect.stringContaining('Evidence Cleaning: Job confirmed.'),
        })
      )
      const body = mockMessagesCreate.mock.calls[0][0].body
      expect(body).toContain('Jane Doe')
      expect(body).toContain('Test Client')
      expect(body).toContain('10:00')

      process.env.TWILIO_FROM_NUMBER = originalFrom
    })
  })
})

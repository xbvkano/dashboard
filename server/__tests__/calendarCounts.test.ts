/**
 * Tests for calendar day-count endpoints (month-counts, range-counts).
 * Counts must exclude canceled appointments so the bubble shows only active appointments.
 */

const findManyCalls: Array<{ where: unknown }> = []
let findManyResult: Array<{ date: Date }> = []

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    appointment: {
      findMany: jest.fn().mockImplementation((args: { where?: unknown }) => {
        if (args?.where) findManyCalls.push({ where: args.where })
        return Promise.resolve(findManyResult)
      }),
    },
  })),
}))

import { Request, Response } from 'express'
import { getMonthCounts, getRangeCounts } from '../src/controllers/calendarController'

function mockRequest(query: Record<string, string> = {}): Request {
  return { query } as Request
}

function mockResponse(): Response {
  const res = {} as Response
  res.status = jest.fn().mockReturnThis()
  res.json = jest.fn().mockReturnThis()
  return res
}

describe('Calendar counts (day bubbles)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    findManyCalls.length = 0
    findManyResult = []
  })

  describe('getMonthCounts', () => {
    it('excludes CANCEL so bubble shows only non-canceled appointments', async () => {
      const req = mockRequest({ year: '2026', month: '2' })
      const res = mockResponse()
      // Simulate: 5 appointments on the 15th, 1 would be canceled — we only count 4 because query excludes CANCEL
      findManyResult = [
        { date: new Date(Date.UTC(2026, 1, 15)) },
        { date: new Date(Date.UTC(2026, 1, 15)) },
        { date: new Date(Date.UTC(2026, 1, 15)) },
        { date: new Date(Date.UTC(2026, 1, 15)) },
      ]

      await getMonthCounts(req, res)

      expect(findManyCalls.length).toBe(1)
      const where = findManyCalls[0].where as { status?: { notIn: string[] } }
      expect(where.status?.notIn).toContain('DELETED')
      expect(where.status?.notIn).toContain('RESCHEDULE_OLD')
      expect(where.status?.notIn).toContain('CANCEL')

      expect(res.status).not.toHaveBeenCalled()
      expect(res.json).toHaveBeenCalledWith({ '2026-02-15': 4 })
    })

    it('returns correct counts per day for multiple days', async () => {
      findManyResult = [
        { date: new Date(Date.UTC(2026, 1, 10)) },
        { date: new Date(Date.UTC(2026, 1, 10)) },
        { date: new Date(Date.UTC(2026, 1, 11)) },
      ]
      const req = mockRequest({ year: '2026', month: '2' })
      const res = mockResponse()

      await getMonthCounts(req, res)

      expect(res.json).toHaveBeenCalledWith({
        '2026-02-10': 2,
        '2026-02-11': 1,
      })
    })

    it('returns 400 for invalid year or month', async () => {
      const res = mockResponse()
      await getMonthCounts(mockRequest({ year: 'invalid', month: '2' }), res)
      expect(res.status).toHaveBeenCalledWith(400)
    })
  })

  describe('getRangeCounts', () => {
    it('excludes CANCEL so bubble shows only non-canceled appointments', async () => {
      findManyResult = [
        { date: new Date(Date.UTC(2026, 1, 15)) },
        { date: new Date(Date.UTC(2026, 1, 15)) },
        { date: new Date(Date.UTC(2026, 1, 15)) },
        { date: new Date(Date.UTC(2026, 1, 15)) },
      ]
      const req = mockRequest({ start: '2026-02-14', end: '2026-02-16' })
      const res = mockResponse()

      await getRangeCounts(req, res)

      expect(findManyCalls.length).toBe(1)
      const where = findManyCalls[0].where as { status?: { notIn: string[] } }
      expect(where.status?.notIn).toContain('CANCEL')
      expect(where.status?.notIn).toContain('DELETED')
      expect(where.status?.notIn).toContain('RESCHEDULE_OLD')

      expect(res.json).toHaveBeenCalledWith({ '2026-02-15': 4 })
    })

    it('returns correct counts for date range', async () => {
      findManyResult = [
        { date: new Date(Date.UTC(2026, 1, 10)) },
        { date: new Date(Date.UTC(2026, 1, 10)) },
        { date: new Date(Date.UTC(2026, 1, 11)) },
      ]
      const req = mockRequest({ start: '2026-02-09', end: '2026-02-12' })
      const res = mockResponse()

      await getRangeCounts(req, res)

      expect(res.json).toHaveBeenCalledWith({
        '2026-02-10': 2,
        '2026-02-11': 1,
      })
    })

    it('returns 400 when start or end missing', async () => {
      const res = mockResponse()
      await getRangeCounts(mockRequest({ start: '2026-02-01' }), res)
      expect(res.status).toHaveBeenCalledWith(400)
    })
  })
})

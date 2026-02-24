/**
 * Tests that createAppointment and updateAppointment reject double-booking:
 * the same employee cannot be in two appointments in the same date+time slot (AM/PM).
 */

const appointmentFindManyCalls: Array<{ where: unknown }> = []
let mockAppointmentFindManyResult: unknown[] = []
let mockAppointmentFindUniqueResult: unknown = null
let mockAppointmentCreateResult: unknown = null
const mockTemplate = {
  id: 1,
  type: 'STANDARD',
  address: '123 Test St',
  instructions: null,
  size: '2000',
  teamSize: 2,
  price: 150,
  notes: null,
  carpetRooms: null,
  carpetPrice: null,
}

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    appointment: {
      findMany: jest.fn().mockImplementation((args: { where?: unknown }) => {
        if (args?.where) appointmentFindManyCalls.push({ where: args.where })
        return Promise.resolve(mockAppointmentFindManyResult)
      }),
      findUnique: jest.fn().mockImplementation(() => Promise.resolve(mockAppointmentFindUniqueResult)),
      create: jest.fn().mockImplementation(() => Promise.resolve(mockAppointmentCreateResult)),
      update: jest.fn().mockImplementation(() => Promise.resolve(mockAppointmentCreateResult)),
    },
    appointmentTemplate: {
      findUnique: jest.fn().mockResolvedValue(mockTemplate),
    },
    payrollItem: {
      findMany: jest.fn().mockResolvedValue([]),
      createMany: jest.fn().mockResolvedValue(undefined),
      deleteMany: jest.fn().mockResolvedValue(undefined),
    },
  })),
}))

// Avoid actual Twilio and job calls (twilio is called as twilio(...) in controller)
jest.mock('twilio', () => ({ __esModule: true, default: jest.fn(() => ({})) }))
jest.mock('../src/jobs/unconfirmedCheck', () => ({ sendEmployeeRemindersForAppointmentIds: jest.fn().mockResolvedValue(undefined) }))

import { Request, Response } from 'express'
import { createAppointment, updateAppointment } from '../src/controllers/appointmentsController'

function mockRequest(body: Record<string, unknown> = {}, params: Record<string, string> = {}): Request {
  return { body, params, query: {} } as Request
}

function mockResponse(): Response {
  const res = {} as Response
  res.status = jest.fn().mockReturnThis()
  res.json = jest.fn().mockReturnThis()
  return res
}

describe('Appointments double-booking prevention', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    appointmentFindManyCalls.length = 0
    mockAppointmentFindManyResult = []
    mockAppointmentFindUniqueResult = null
    mockAppointmentCreateResult = { id: 1, date: new Date('2026-03-01'), time: '10:00', employees: [] }
  })

  describe('createAppointment', () => {
    const validBody = {
      clientId: 1,
      templateId: 1,
      date: '2026-03-01',
      time: '10:00',
      adminId: 1,
      employeeIds: [10, 20],
    }

    it('returns 409 when one or more employees are already scheduled in the same slot', async () => {
      mockAppointmentFindManyResult = [
        { id: 99, time: '09:00', employees: [{ id: 10 }] }, // same AM slot, employee 10
      ]
      const req = mockRequest(validBody)
      const res = mockResponse()
      await createAppointment(req, res)
      expect(res.status).toHaveBeenCalledWith(409)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'One or more employees are already scheduled in this time block',
          employeeIds: [10],
        })
      )
    })

    it('returns 409 when multiple employees are already in that slot', async () => {
      mockAppointmentFindManyResult = [
        { id: 99, time: '09:00', employees: [{ id: 10 }, { id: 20 }] },
      ]
      const req = mockRequest(validBody)
      const res = mockResponse()
      await createAppointment(req, res)
      expect(res.status).toHaveBeenCalledWith(409)
      expect((res.json as jest.Mock).mock.calls[0][0].employeeIds).toContain(10)
      expect((res.json as jest.Mock).mock.calls[0][0].employeeIds).toContain(20)
    })

    it('allows create when employees are in a different slot (PM vs AM)', async () => {
      mockAppointmentFindManyResult = [
        { id: 99, time: '14:00', employees: [{ id: 10 }] }, // PM slot
      ]
      const req = mockRequest(validBody)
      const res = mockResponse()
      await createAppointment(req, res)
      expect(res.status).not.toHaveBeenCalledWith(409)
    })

    it('allows create when no employees are in that slot', async () => {
      mockAppointmentFindManyResult = []
      const req = mockRequest(validBody)
      const res = mockResponse()
      await createAppointment(req, res)
      expect(res.status).not.toHaveBeenCalledWith(409)
    })
  })

  describe('updateAppointment', () => {
    it('returns 409 when assigning an employee already in another appointment in same slot', async () => {
      mockAppointmentFindUniqueResult = {
        id: 1,
        date: new Date('2026-03-01'),
        time: '10:00',
        employees: [],
        client: {},
        admin: {},
        family: null,
      }
      mockAppointmentFindManyResult = [
        { id: 2, time: '09:00', employees: [{ id: 15 }] }, // other appt in AM with employee 15
      ]
      const req = mockRequest(
        { employeeIds: [15] },
        { id: '1' }
      )
      const res = mockResponse()
      await updateAppointment(req, res)
      expect(res.status).toHaveBeenCalledWith(409)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'One or more employees are already scheduled in this time block',
          employeeIds: [15],
        })
      )
    })

    it('allows update when the only appointment in that slot is the current one (same id excluded)', async () => {
      mockAppointmentFindUniqueResult = {
        id: 1,
        date: new Date('2026-03-01'),
        time: '10:00',
        employees: [{ id: 15 }],
        client: {},
        admin: {},
        family: null,
      }
      // findMany is called with id: { not: 1 }, so no other appointments in slot → empty
      mockAppointmentFindManyResult = []
      const req = mockRequest(
        { employeeIds: [15, 16] },
        { id: '1' }
      )
      const res = mockResponse()
      await updateAppointment(req, res)
      expect(res.status).not.toHaveBeenCalledWith(409)
    })
  })
})

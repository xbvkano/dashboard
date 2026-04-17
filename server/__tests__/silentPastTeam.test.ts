/**
 * Past appointments should be “silent”: no employee SMS and no confirm-required state.
 */

let mockAppointmentFindUniqueResult: any = null
let mockAppointmentUpdateResult: any = null
const mockPayrollItemUpdateMany = jest.fn().mockResolvedValue({ count: 0 })

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    appointment: {
      findUnique: jest.fn().mockImplementation(() => Promise.resolve(mockAppointmentFindUniqueResult)),
      update: jest.fn().mockImplementation(() => Promise.resolve(mockAppointmentUpdateResult)),
      findMany: jest.fn().mockResolvedValue([]),
    },
    payrollItem: {
      findMany: jest.fn().mockResolvedValue([]),
      createMany: jest.fn().mockResolvedValue(undefined),
      deleteMany: jest.fn().mockResolvedValue(undefined),
      updateMany: (...args: unknown[]) => mockPayrollItemUpdateMany(...args),
      update: jest.fn().mockResolvedValue(undefined),
    },
    appointmentTemplate: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
  })),
}))

jest.mock('twilio', () => ({ __esModule: true, default: jest.fn(() => ({ messages: { create: jest.fn() } })) }))

const sendEmployeeRemindersForAppointmentIdsMock = jest.fn().mockResolvedValue(undefined)
jest.mock('../src/jobs/unconfirmedCheck', () => ({
  sendEmployeeRemindersForAppointmentIds: (...args: unknown[]) => sendEmployeeRemindersForAppointmentIdsMock(...args),
}))

import type { Request, Response } from 'express'
import { updateAppointment, sendAppointmentInfo } from '../src/controllers/appointmentsController'

function mockRequest(body: Record<string, unknown> = {}, params: Record<string, string> = {}, query: Record<string, unknown> = {}): Request {
  return { body, params, query, headers: {} } as Request
}

function mockResponse(): Response {
  const res = {} as Response
  res.status = jest.fn().mockReturnThis()
  res.json = jest.fn().mockReturnThis()
  return res
}

describe('silent past appointment team assignment', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // 11:00 LA on 2026-04-14
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-04-14T18:00:00.000Z'))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('when updating team for a past appointment, marks payroll items confirmed and does not send reminders', async () => {
    mockAppointmentFindUniqueResult = {
      id: 1,
      dateUtc: new Date('2026-04-14T07:00:00.000Z'),
      date: new Date('2026-04-14T07:00:00.000Z'),
      time: '09:00', // 9am LA, in the past relative to 11am LA
      employees: [],
      client: {},
      admin: {},
      family: null,
      status: 'APPOINTED',
      noTeam: false,
    }
    mockAppointmentUpdateResult = {
      ...mockAppointmentFindUniqueResult,
      employees: [{ id: 10 }, { id: 20 }],
    }

    const req = mockRequest({ employeeIds: [10, 20] }, { id: '1' })
    const res = mockResponse()
    await updateAppointment(req, res)

    expect(sendEmployeeRemindersForAppointmentIdsMock).not.toHaveBeenCalled()
    expect(mockPayrollItemUpdateMany).toHaveBeenCalledWith({
      where: { appointmentId: 1, employeeId: { in: [10, 20] } },
      data: expect.objectContaining({ confirmed: true }),
    })
  })

  it('blocks sendAppointmentInfo for a past appointment', async () => {
    mockAppointmentFindUniqueResult = {
      id: 2,
      dateUtc: new Date('2026-04-14T07:00:00.000Z'),
      date: new Date('2026-04-14T07:00:00.000Z'),
      time: '09:00',
      employees: [{ id: 1, number: '+15551234567' }],
      payrollItems: [],
      client: { name: 'Client' },
      admin: {},
      family: null,
      address: '123',
      type: 'STANDARD',
      size: null,
      carpetRooms: null,
      carpetEmployees: [],
      cityStateZip: null,
      noTeam: false,
    }

    const req = mockRequest({ note: '' }, { id: '2' })
    const res = mockResponse()
    await sendAppointmentInfo(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('past') }))
  })
})


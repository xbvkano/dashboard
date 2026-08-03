/**
 * Edit-notice SMS: notify team of field changes without resetting payroll confirmation
 * or sending unconfirmed-job reminders. Allowed for today and future (not prior calendar days).
 */

let mockAppointmentFindUniqueResult: any = null
let mockAppointmentUpdateResult: any = null
const mockPayrollItemUpdateMany = jest.fn().mockResolvedValue({ count: 0 })
const mockPayrollItemFindMany = jest.fn().mockResolvedValue([])
const mockSmsCreate = jest.fn().mockResolvedValue({ sid: 'SM123' })

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    appointment: {
      findUnique: jest.fn().mockImplementation(() => Promise.resolve(mockAppointmentFindUniqueResult)),
      update: jest.fn().mockImplementation(() => Promise.resolve(mockAppointmentUpdateResult)),
      findMany: jest.fn().mockResolvedValue([]),
    },
    payrollItem: {
      findMany: (...args: unknown[]) => mockPayrollItemFindMany(...args),
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

jest.mock('twilio', () => ({
  __esModule: true,
  default: jest.fn(() => ({ messages: { create: (...args: unknown[]) => mockSmsCreate(...args) } })),
}))

const sendEmployeeRemindersForAppointmentIdsMock = jest.fn().mockResolvedValue(undefined)
jest.mock('../src/jobs/unconfirmedCheck', () => ({
  sendEmployeeRemindersForAppointmentIds: (...args: unknown[]) =>
    sendEmployeeRemindersForAppointmentIdsMock(...args),
}))

jest.mock('../src/utils/twilioSms', () => ({
  twilioMessageCreateParams: (to: string, body: string) => ({ to, body, from: '+15550001111' }),
}))

import type { Request, Response } from 'express'
import { sendAppointmentEditNotice } from '../src/controllers/appointmentsController'

function mockRequest(body: Record<string, unknown> = {}, params: Record<string, string> = {}): Request {
  return { body, params, query: {}, headers: {} } as Request
}

function mockResponse(): Response {
  const res = {} as Response
  res.status = jest.fn().mockReturnThis()
  res.json = jest.fn().mockReturnThis()
  return res
}

function todayAppt(overrides: Record<string, unknown> = {}) {
  return {
    id: 5,
    dateUtc: new Date('2026-08-03T07:00:00.000Z'),
    date: new Date('2026-08-03T07:00:00.000Z'),
    time: '09:00',
    address: '200 Oak Ave',
    cityStateZip: 'Gate 9999',
    type: 'STANDARD',
    size: '1500-2000',
    price: 250,
    notes: null,
    noTeam: false,
    employees: [
      { id: 10, number: '+15551234567' },
      { id: 11, number: '+15557654321' },
    ],
    payrollItems: [
      { employeeId: 10, amount: 80, confirmed: true, reminderSentAt: new Date('2026-08-01'), extras: [] },
      { employeeId: 11, amount: 80, confirmed: true, reminderSentAt: new Date('2026-08-01'), extras: [] },
    ],
    client: { name: 'Jane' },
    admin: {},
    family: null,
    ...overrides,
  }
}

describe('sendAppointmentEditNotice', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    // Afternoon LA on 2026-08-03 — earlier-today appointments must still be notifiable
    jest.setSystemTime(new Date('2026-08-03T21:00:00.000Z'))
    process.env.TWILIO_FROM_NUMBER = '+15550001111'
    process.env.TWILIO_ACCOUNT_SID = 'ACtest'
    process.env.TWILIO_AUTH_TOKEN = 'token'
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('sends edit-notice SMS for an earlier-today appointment and does not reset confirmation', async () => {
    mockAppointmentFindUniqueResult = todayAppt({ time: '08:00' })
    mockAppointmentUpdateResult = todayAppt({ time: '08:00', infoSent: true })

    const req = mockRequest(
      {
        previous: {
          address: '100 Main St',
          instructions: 'Old gate',
          date: '2026-08-03',
          time: '08:00',
          type: 'STANDARD',
          size: '1500-2000',
          price: 200,
          notes: null,
        },
      },
      { id: '5' },
    )
    const res = mockResponse()
    await sendAppointmentEditNotice(req, res)

    expect(res.status).not.toHaveBeenCalledWith(400)
    expect(mockSmsCreate).toHaveBeenCalledTimes(2)
    const firstBody = (mockSmsCreate.mock.calls[0][0] as { body: string }).body
    expect(firstBody).toContain('Appointment Edit Notice')
    expect(firstBody).toContain('Address: 100 Main St')
    expect(firstBody).toContain('Address updated: 200 Oak Ave')
    expect(firstBody).toContain('Instructions updated: Gate 9999')

    expect(sendEmployeeRemindersForAppointmentIdsMock).not.toHaveBeenCalled()
    expect(mockPayrollItemUpdateMany).not.toHaveBeenCalled()
  })

  it('rejects appointments on a prior calendar day', async () => {
    mockAppointmentFindUniqueResult = todayAppt({
      dateUtc: new Date('2026-08-02T07:00:00.000Z'),
      date: new Date('2026-08-02T07:00:00.000Z'),
    })

    const req = mockRequest(
      {
        previous: {
          address: '100 Main St',
          date: '2026-08-02',
          time: '09:00',
        },
      },
      { id: '5' },
    )
    const res = mockResponse()
    await sendAppointmentEditNotice(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(mockSmsCreate).not.toHaveBeenCalled()
  })

  it('requires a team', async () => {
    mockAppointmentFindUniqueResult = todayAppt({ employees: [], noTeam: true })
    const req = mockRequest({ previous: { address: '100 Main St', date: '2026-08-03', time: '09:00' } }, { id: '5' })
    const res = mockResponse()
    await sendAppointmentEditNotice(req, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(mockSmsCreate).not.toHaveBeenCalled()
  })

  it('does not send when only admin-only fields changed (price/notes/type/size)', async () => {
    mockAppointmentFindUniqueResult = todayAppt({
      address: '100 Main St',
      cityStateZip: 'Gate 1111',
      time: '09:00',
      price: 999,
      notes: 'Zelle',
      type: 'DEEP',
      size: '2000-2500',
    })
    const req = mockRequest(
      {
        previous: {
          address: '100 Main St',
          instructions: 'Gate 1111',
          date: '2026-08-03',
          time: '09:00',
          type: 'STANDARD',
          size: '1500-2000',
          price: 200,
          notes: 'Cash',
        },
      },
      { id: '5' },
    )
    const res = mockResponse()
    await sendAppointmentEditNotice(req, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(mockSmsCreate).not.toHaveBeenCalled()
  })
})

/**
 * Tests for employee active-job + service-status posting rules (SMS / Pushover / dedupe).
 */

const sendPushoverMessageMock = jest.fn()
const sendOutboundSmsMock = jest.fn()
const isPushoverConfiguredMock = jest.fn(() => true)

jest.mock('../src/services/pushover', () => ({
  isPushoverConfigured: () => isPushoverConfiguredMock(),
  sendPushoverMessage: (...args: unknown[]) => sendPushoverMessageMock(...args),
}))

jest.mock('../src/services/messaging', () => ({
  sendOutboundSms: (...args: unknown[]) => sendOutboundSmsMock(...args),
}))

const userFindUnique = jest.fn()
const appointmentFindMany = jest.fn()
const appointmentFindFirst = jest.fn()
const eventFindMany = jest.fn()
const eventFindFirst = jest.fn()
const eventCreate = jest.fn()
const eventUpdate = jest.fn()
const messageUpdate = jest.fn()
const conversationFindFirst = jest.fn()

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    user: { findUnique: userFindUnique },
    appointment: {
      findMany: appointmentFindMany,
      findFirst: appointmentFindFirst,
    },
    appointmentServiceStatusEvent: {
      findMany: eventFindMany,
      findFirst: eventFindFirst,
      create: eventCreate,
      update: eventUpdate,
    },
    message: { update: messageUpdate },
    conversation: { findFirst: conversationFindFirst },
  })),
  PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {
    code: string
    constructor(message: string, { code }: { code: string }) {
      super(message)
      this.code = code
    }
  },
}))

import { Request, Response } from 'express'
import {
  getActiveJob,
  postAppointmentServiceStatus,
} from '../src/controllers/employeeScheduleController'
import { PUSHOVER_SERVICE_STATUS_SOUND } from '../src/utils/pushoverNotificationCopy'
import { SERVICE_STATUS_BUBBLE_COLOR, SERVICE_STATUS_SMS_BODIES } from '../src/constants/serviceStatus'

function mockRequest(overrides: Partial<Request> = {}): Request {
  return {
    headers: { 'x-user-name': '7255774523' },
    params: {},
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

const activeApptBase = {
  id: 42,
  dateUtc: new Date('2026-04-14T07:00:00.000Z'),
  date: new Date('2026-04-14T07:00:00.000Z'),
  time: '09:00',
  hours: 4,
  size: '1500-2000',
  type: 'STANDARD',
  status: 'APPOINTED',
  address: '123 Main St',
  clientId: 7,
  conversationSessionId: 99,
  conversationSession: { conversationId: 55 },
  client: { id: 7, name: 'Jane', number: '+15551112222' },
  employees: [{ id: 1, name: 'Maria' }],
}

describe('employee service status API', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-04-14T17:00:00.000Z')) // 10:00 LA — mid window
    userFindUnique.mockResolvedValue({ employee: { id: 1, name: 'Maria', disabled: false } })
    sendOutboundSmsMock.mockResolvedValue({ messageId: 900, sessionId: 1, transport: { messageSid: 'SM1', status: 'sent' } })
    messageUpdate.mockResolvedValue({})
    eventCreate.mockResolvedValue({ id: 1 })
    eventUpdate.mockResolvedValue({})
    isPushoverConfiguredMock.mockReturnValue(true)
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('getActiveJob', () => {
    it('returns 401 when unauthenticated', async () => {
      userFindUnique.mockResolvedValue(null)
      const res = mockResponse()
      await getActiveJob(mockRequest({ headers: {} }), res)
      expect(res.status).toHaveBeenCalledWith(401)
    })

    it('returns null job when none in window', async () => {
      appointmentFindMany.mockResolvedValue([])
      const res = mockResponse()
      await getActiveJob(mockRequest(), res)
      expect(res.json).toHaveBeenCalledWith({ activeJob: null, activeJobs: [] })
    })

    it('returns active job with click/sms flags', async () => {
      appointmentFindMany.mockResolvedValue([activeApptBase])
      eventFindMany.mockResolvedValue([
        { appointmentId: 42, kind: 'ON_THE_WAY', employeeId: 1, smsMessageId: 10 },
        { appointmentId: 42, kind: 'ON_THE_WAY', employeeId: 2, smsMessageId: null },
      ])
      const res = mockResponse()
      await getActiveJob(mockRequest(), res)
      expect(res.json).toHaveBeenCalledWith({
        activeJob: expect.objectContaining({
          id: 42,
          address: '123 Main St',
          time: '09:00',
          clicked: expect.objectContaining({
            ON_THE_WAY: true,
            ARRIVED: false,
            THIRTY_MINUTES_LEFT: false,
          }),
          smsSent: expect.objectContaining({
            ON_THE_WAY: true,
            THIRTY_MINUTES_LEFT: false,
          }),
          thirtyMinDone: false,
        }),
        activeJobs: [
          expect.objectContaining({
            id: 42,
            address: '123 Main St',
          }),
        ],
      })
    })

    it('returns multiple overlapping active jobs with addresses', async () => {
      appointmentFindMany.mockResolvedValue([
        { ...activeApptBase, id: 42, time: '09:00', hours: 4, address: '123 Main St' },
        { ...activeApptBase, id: 43, time: '10:00', hours: 3, address: '456 Oak Ave' },
      ])
      eventFindMany.mockResolvedValue([])
      const res = mockResponse()
      await getActiveJob(mockRequest(), res)
      const body = (res.json as jest.Mock).mock.calls[0][0] as {
        activeJobs: Array<{ id: number; address: string }>
      }
      expect(body.activeJobs.map((j) => j.id)).toEqual([42, 43])
      expect(body.activeJobs.map((j) => j.address)).toEqual(['123 Main St', '456 Oak Ave'])
    })
  })

  describe('postAppointmentServiceStatus', () => {
    function setupAssignedAppt(overrides: Record<string, unknown> = {}) {
      appointmentFindFirst.mockResolvedValue({ ...activeApptBase, ...overrides })
      eventFindFirst.mockResolvedValue(null)
      eventFindMany.mockResolvedValue([])
    }

    it('rejects invalid kind', async () => {
      const res = mockResponse()
      await postAppointmentServiceStatus(
        mockRequest({ params: { id: '42' } as never, body: { kind: 'NOPE' } }),
        res,
      )
      expect(res.status).toHaveBeenCalledWith(400)
      expect(sendPushoverMessageMock).not.toHaveBeenCalled()
      expect(sendOutboundSmsMock).not.toHaveBeenCalled()
    })

    it('rejects when employee not on appointment', async () => {
      appointmentFindFirst.mockResolvedValue(null)
      const res = mockResponse()
      await postAppointmentServiceStatus(
        mockRequest({ params: { id: '42' } as never, body: { kind: 'ARRIVED' } }),
        res,
      )
      expect(res.status).toHaveBeenCalledWith(404)
    })

    it('rejects when more than one hour before start', async () => {
      jest.setSystemTime(new Date('2026-04-14T14:59:00.000Z')) // before early window
      setupAssignedAppt()
      const res = mockResponse()
      await postAppointmentServiceStatus(
        mockRequest({ params: { id: '42' } as never, body: { kind: 'ON_THE_WAY' } }),
        res,
      )
      expect(res.status).toHaveBeenCalledWith(409)
      expect(sendOutboundSmsMock).not.toHaveBeenCalled()
    })

    it('allows ON_THE_WAY within one hour before start', async () => {
      jest.setSystemTime(new Date('2026-04-14T15:00:00.000Z')) // exactly 1h early
      setupAssignedAppt()
      eventFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null)
      const res = mockResponse()
      await postAppointmentServiceStatus(
        mockRequest({ params: { id: '42' } as never, body: { kind: 'ON_THE_WAY' } }),
        res,
      )
      expect(sendOutboundSmsMock).toHaveBeenCalled()
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: 'ok', smsSent: true }),
      )
    })

    it('ON_THE_WAY first click: SMS with purple attribution + Pushover SERVICE_STATUS sound', async () => {
      setupAssignedAppt()
      // no prior SMS winner
      eventFindFirst
        .mockResolvedValueOnce(null) // already clicked by self
        .mockResolvedValueOnce(null) // team SMS already sent check
      const res = mockResponse()
      await postAppointmentServiceStatus(
        mockRequest({ params: { id: '42' } as never, body: { kind: 'ON_THE_WAY' } }),
        res,
      )
      expect(sendOutboundSmsMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          conversationId: 55,
          body: SERVICE_STATUS_SMS_BODIES.ON_THE_WAY,
          userId: null,
        }),
      )
      expect(messageUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            attributionLabel: 'Maria',
            bubbleColorOverride: SERVICE_STATUS_BUBBLE_COLOR,
            appointmentId: 42,
          }),
        }),
      )
      expect(sendPushoverMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          sound: PUSHOVER_SERVICE_STATUS_SOUND,
          priority: 1,
          title: 'On the way — Jane · Maria',
        }),
      )
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: 'ok', smsSent: true, pushoverSent: true }),
      )
    })

    it('ON_THE_WAY second teammate: no SMS, still Pushover', async () => {
      setupAssignedAppt()
      userFindUnique.mockResolvedValue({ employee: { id: 2, name: 'Ana', disabled: false } })
      eventFindFirst
        .mockResolvedValueOnce(null) // self not clicked
        .mockResolvedValueOnce({ id: 9, smsMessageId: 900 }) // team already sent SMS
      eventCreate.mockResolvedValue({ id: 2 })
      const res = mockResponse()
      await postAppointmentServiceStatus(
        mockRequest({ params: { id: '42' } as never, body: { kind: 'ON_THE_WAY' } }),
        res,
      )
      expect(sendOutboundSmsMock).not.toHaveBeenCalled()
      expect(sendPushoverMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'On the way — Jane · Ana', sound: 'pushover' }),
      )
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: 'ok', smsSent: false, pushoverSent: true }),
      )
    })

    it('ARRIVED never sends SMS; always Pushover per employee', async () => {
      setupAssignedAppt()
      eventFindFirst.mockResolvedValue(null)
      const res = mockResponse()
      await postAppointmentServiceStatus(
        mockRequest({ params: { id: '42' } as never, body: { kind: 'ARRIVED' } }),
        res,
      )
      expect(sendOutboundSmsMock).not.toHaveBeenCalled()
      expect(sendPushoverMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Arrived — Jane · Maria', sound: 'pushover', priority: 1 }),
      )
    })

    it('THIRTY_MINUTES_LEFT second click is ignored (no SMS, no Pushover)', async () => {
      setupAssignedAppt()
      eventFindFirst.mockResolvedValue({ id: 3, employeeId: 9 }) // any prior
      const res = mockResponse()
      await postAppointmentServiceStatus(
        mockRequest({ params: { id: '42' } as never, body: { kind: 'THIRTY_MINUTES_LEFT' } }),
        res,
      )
      expect(sendOutboundSmsMock).not.toHaveBeenCalled()
      expect(sendPushoverMessageMock).not.toHaveBeenCalled()
      expect(eventCreate).not.toHaveBeenCalled()
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'ignored' }))
    })

    it('THIRTY_MINUTES_LEFT first click: SMS + single Pushover', async () => {
      setupAssignedAppt()
      eventFindFirst.mockResolvedValue(null)
      const res = mockResponse()
      await postAppointmentServiceStatus(
        mockRequest({ params: { id: '42' } as never, body: { kind: 'THIRTY_MINUTES_LEFT' } }),
        res,
      )
      expect(sendOutboundSmsMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          body: SERVICE_STATUS_SMS_BODIES.THIRTY_MINUTES_LEFT,
        }),
      )
      expect(sendPushoverMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '30 min left — Jane · Maria',
          sound: 'pushover',
          priority: 1,
        }),
      )
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: 'ok', smsSent: true, pushoverSent: true }),
      )
    })

    it('duplicate ON_THE_WAY by same employee is already_handled', async () => {
      setupAssignedAppt()
      eventFindFirst.mockResolvedValue({ id: 1, employeeId: 1 })
      const res = mockResponse()
      await postAppointmentServiceStatus(
        mockRequest({ params: { id: '42' } as never, body: { kind: 'ON_THE_WAY' } }),
        res,
      )
      expect(sendOutboundSmsMock).not.toHaveBeenCalled()
      expect(sendPushoverMessageMock).not.toHaveBeenCalled()
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'already_handled' }))
    })
  })
})

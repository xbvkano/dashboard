/**
 * Tests for the 7pm unconfirmed check job: tomorrow's appointments,
 * unconfirmed payroll items, and texting supervisors.
 */

let mockFindManyResult: unknown[] = []
const mockFindMany = jest.fn().mockImplementation(() => Promise.resolve(mockFindManyResult))
const mockPayrollItemCreate = jest.fn().mockResolvedValue({ id: 1, appointmentId: 1, employeeId: 1, confirmed: false })
const mockPayrollItemFindMany = jest.fn().mockResolvedValue([]) // 14-day employee reminders: none by default
const mockPayrollItemUpdate = jest.fn().mockResolvedValue({})
const mockMessagesCreate = jest.fn()

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    appointment: { findMany: mockFindMany },
    payrollItem: {
      create: mockPayrollItemCreate,
      findMany: mockPayrollItemFindMany,
      update: mockPayrollItemUpdate,
    },
  })),
}))

jest.mock('twilio', () =>
  jest.fn().mockReturnValue({
    messages: {
      create: (...args: unknown[]) => mockMessagesCreate(...args),
    },
  })
)

import { runUnconfirmedCheck, runNoonEmployeeReminders } from '../src/jobs/unconfirmedCheck'

// Tomorrow from 2025-02-20
const AS_OF = new Date('2025-02-20T19:00:00Z')
const TOMORROW_START = new Date('2025-02-21T00:00:00Z')

function appointmentWithUnconfirmed(
  overrides: {
    id?: number
    time?: string
    client?: { id: number; name: string }
    payrollItems?: Array<{
      id: number
      employeeId: number
      confirmed: boolean
      employee: {
        id: number
        name: string
        number: string
        supervisorId: number | null
        supervisor: {
          id: number
          name: string | null
          userName: string | null
          employee?: { number: string } | null
        } | null
      }
    }>
  } = {}
) {
  return {
    id: 1,
    date: TOMORROW_START,
    time: '10:00',
    client: { id: 1, name: 'Test Client' },
    payrollItems: [
      {
        id: 10,
        employeeId: 100,
        confirmed: false,
        employee: {
          id: 100,
          name: 'Emp Unconfirmed',
          number: '15551234567',
          supervisorId: 5,
          supervisor: {
            id: 5,
            name: 'Rita Kano',
            userName: '7255774524',
            employee: null,
          },
        },
      },
    ],
    ...overrides,
  }
}

describe('runUnconfirmedCheck', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    mockFindManyResult = []
    mockMessagesCreate.mockResolvedValue({ sid: 'SM123' })
    process.env.TWILIO_FROM_NUMBER = '+15551234567'
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('queries appointments for tomorrow only (7pm job notifies supervisors only; noon job does employee reminders)', async () => {
    mockFindManyResult = []
    await runUnconfirmedCheck(AS_OF)
    expect(mockFindMany).toHaveBeenCalledTimes(1)
    const tomorrowCall = mockFindMany.mock.calls[0][0]
    const gte = new Date(tomorrowCall.where.date.gte)
    const lt = new Date(tomorrowCall.where.date.lt)
    expect(lt.getTime() - gte.getTime()).toBe(24 * 60 * 60 * 1000)
    expect(tomorrowCall.where.status.notIn).toContain('DELETED')
    expect(tomorrowCall.where.status.notIn).toContain('CANCEL')
  })

  it('includes client, payrollItems, and employees with supervisor', async () => {
    mockFindManyResult = []
    await runUnconfirmedCheck(AS_OF)
    const call = mockFindMany.mock.calls[0][0]
    expect(call.include.client).toBe(true)
    expect(call.include.payrollItems.include.employee.include.supervisor.include.employee).toBe(true)
    expect(call.include.employees.include.supervisor.include.employee).toBe(true)
  })

  it('sends SMS to supervisor when employee has unconfirmed job', async () => {
    mockFindManyResult = [appointmentWithUnconfirmed()]
    const result = await runUnconfirmedCheck(AS_OF)
    expect(result.sent).toHaveLength(1)
    expect(result.sent[0].employeeName).toBe('Emp Unconfirmed')
    expect(result.sent[0].employeeNumber).toBe('15551234567')
    expect(result.sent[0].supervisorName).toBe('Rita Kano')
    expect(result.sent[0].clientName).toBe('Test Client')
    expect(result.sent[0].appointmentTime).toBe('10:00')
    expect(result.sent[0].twilioSid).toBe('SM123')
    expect(mockMessagesCreate).toHaveBeenCalledTimes(1)
    const [args] = mockMessagesCreate.mock.calls
    expect(args[0].to).toBe('+17255774524')
    expect(args[0].body).toContain('Emp Unconfirmed')
    expect(args[0].body).toContain('15551234567')
    expect(args[0].body).toContain('Test Client')
    expect(args[0].body).toContain('10:00')
    expect(args[0].body).toContain('Unconfirmed job')
  })

  it('skips when employee has no supervisor', async () => {
    mockFindManyResult = [
      appointmentWithUnconfirmed({
        payrollItems: [
          {
            id: 10,
            employeeId: 100,
            confirmed: false,
            employee: {
              id: 100,
              name: 'Emp No Supervisor',
              number: '15559999999',
              supervisorId: null,
              supervisor: null,
            },
          },
        ],
      }),
    ]
    const result = await runUnconfirmedCheck(AS_OF)
    expect(result.sent).toHaveLength(0)
    expect(result.skipped).toHaveLength(1)
    expect(result.skipped[0].error).toBe('No supervisor assigned')
    expect(result.skipped[0].employeeName).toBe('Emp No Supervisor')
    expect(mockMessagesCreate).not.toHaveBeenCalled()
  })

  it('skips when supervisor has no phone', async () => {
    mockFindManyResult = [
      appointmentWithUnconfirmed({
        payrollItems: [
          {
            id: 10,
            employeeId: 100,
            confirmed: false,
            employee: {
              id: 100,
              name: 'Emp One',
              number: '15551111111',
              supervisorId: 9,
              supervisor: {
                id: 9,
                name: 'No Phone Supervisor',
                userName: 'email-only',
                employee: null,
              },
            },
          },
        ],
      }),
    ]
    const result = await runUnconfirmedCheck(AS_OF)
    expect(result.sent).toHaveLength(0)
    expect(result.skipped).toHaveLength(1)
    expect(result.skipped[0].error).toBe('Supervisor has no phone number')
    expect(mockMessagesCreate).not.toHaveBeenCalled()
  })

  it('does not notify when all payroll items are confirmed', async () => {
    mockFindManyResult = [
      { id: 2, date: TOMORROW_START, time: '14:00', client: { id: 1, name: 'Client' }, payrollItems: [], employees: [] },
    ]
    const result = await runUnconfirmedCheck(AS_OF)
    expect(result.sent).toHaveLength(0)
    expect(mockMessagesCreate).not.toHaveBeenCalled()
  })

  it('creates missing payroll items and notifies when appointment has employees but no payroll items', async () => {
    const apptWithEmployeesOnly = {
      id: 98,
      date: TOMORROW_START,
      time: '14:00',
      client: { id: 1, name: 'John Doe' },
      payrollItems: [] as any[],
      employees: [
        {
          id: 200,
          name: 'Jane Worker',
          number: '15559876543',
          supervisor: {
            id: 7,
            name: 'Supervisor Sue',
            userName: '7255774523',
            employee: null,
          },
        },
      ],
    }
    mockFindManyResult = [apptWithEmployeesOnly]
    const result = await runUnconfirmedCheck(AS_OF)
    expect(mockPayrollItemCreate).toHaveBeenCalledWith({
      data: { appointmentId: 98, employeeId: 200 },
    })
    expect(result.sent).toHaveLength(1)
    expect(result.sent[0].employeeName).toBe('Jane Worker')
    expect(result.sent[0].phone).toBe('+17255774523')
    expect(mockMessagesCreate).toHaveBeenCalledTimes(1)
    expect(mockMessagesCreate.mock.calls[0][0].to).toBe('+17255774523')
  })

  it('uses supervisor employee number when available', async () => {
    mockFindManyResult = [
      appointmentWithUnconfirmed({
        payrollItems: [
          {
            id: 10,
            employeeId: 100,
            confirmed: false,
            employee: {
              id: 100,
              name: 'Emp',
              number: '15553333333',
              supervisorId: 6,
              supervisor: {
                id: 6,
                name: 'Marcos',
                userName: 'other',
                employee: { number: '+17255774523' },
              },
            },
          },
        ],
      }),
    ]
    const result = await runUnconfirmedCheck(AS_OF)
    expect(result.sent).toHaveLength(1)
    expect(mockMessagesCreate).toHaveBeenCalledTimes(1)
    expect(mockMessagesCreate.mock.calls[0][0].to).toBe('+17255774523')
  })

  it('records failed when Twilio throws', async () => {
    process.env.TWILIO_FROM_NUMBER = '+15551234567'
    mockMessagesCreate.mockRejectedValueOnce(new Error('Twilio error'))
    mockFindManyResult = [appointmentWithUnconfirmed()]
    const result = await runUnconfirmedCheck(AS_OF)
    expect(result.sent).toHaveLength(0)
    expect(result.failed).toHaveLength(1)
    expect(result.failed[0].error).toBe('Twilio error')
  })
})

describe('runNoonEmployeeReminders', () => {
  const originalEnv = process.env
  const MARCH_8_UTC = new Date('2026-03-08T00:00:00.000Z')
  const mar8PayrollItem = {
    id: 50,
    confirmed: false,
    reminderSentAt: null,
    employeeId: 4,
    employee: {
      id: 4,
      name: 'Marcos Kano',
      number: '17255774523',
    },
    appointment: {
      id: 99,
      date: MARCH_8_UTC,
      time: '09:00',
      address: '456 Oak Ave',
      client: { name: 'Jane Smith' },
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockPayrollItemFindMany.mockResolvedValue([])
    mockMessagesCreate.mockResolvedValue({ sid: 'SM noon' })
    process.env.TWILIO_FROM_NUMBER = '+15551234567'
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('sends to employee when unconfirmed appointment (Mar 8) is in 14-day window (Feb 22 at noon)', async () => {
    // Feb 22 at noon local => window [Feb 22 UTC midnight, Mar 9 UTC midnight) => includes Mar 8
    mockPayrollItemFindMany.mockResolvedValueOnce([mar8PayrollItem])
    const asOf = new Date(2026, 1, 22, 12, 0, 0, 0) // Feb 22 12:00 local
    const result = await runNoonEmployeeReminders(asOf)
    expect(result.sent).toHaveLength(1)
    expect(result.sent[0].employeeName).toBe('Marcos Kano')
    expect(result.sent[0].phone).toBe('+17255774523')
    expect(result.sent[0].appointmentDate).toContain('Mar') // Mar 8 formatted
    expect(mockPayrollItemUpdate).toHaveBeenCalledWith({
      where: { id: 50 },
      data: { reminderSentAt: expect.any(Date) },
    })
    expect(mockMessagesCreate).toHaveBeenCalledTimes(1)
    expect(mockMessagesCreate.mock.calls[0][0].to).toBe('+17255774523')
  })

  it('does not send when appointment (Mar 9) is outside window (Feb 22 window ends Mar 8)', async () => {
    // Window Feb 22 is [Feb 22, Mar 9); Mar 9 is excluded. So no items in window.
    mockPayrollItemFindMany.mockResolvedValueOnce([])
    const asOf = new Date(2026, 1, 22, 12, 0, 0, 0)
    const result = await runNoonEmployeeReminders(asOf)
    expect(result.sent).toHaveLength(0)
    expect(mockMessagesCreate).not.toHaveBeenCalled()
  })

  it('does not send when unconfirmed on Mar 8 is not yet in window (Feb 21 at noon: window Feb 21–Mar 7)', async () => {
    // Feb 21 at noon => window [Feb 21, Mar 8) => Mar 8 is excluded (end is Mar 8 00:00 UTC)
    mockPayrollItemFindMany.mockResolvedValueOnce([])
    const asOf = new Date(2026, 1, 21, 12, 0, 0, 0)
    const result = await runNoonEmployeeReminders(asOf)
    expect(result.sent).toHaveLength(0)
    expect(mockMessagesCreate).not.toHaveBeenCalled()
  })

  it('uses UTC-based window for new day only (today+14): Feb 22 noon => only Mar 8', async () => {
    mockPayrollItemFindMany.mockImplementation((args: any) => {
      const gte = args?.where?.appointment?.date?.gte
      const lt = args?.where?.appointment?.date?.lt
      expect(gte).toBeDefined()
      expect(lt).toBeDefined()
      expect(new Date(gte).toISOString()).toBe('2026-03-08T00:00:00.000Z')
      expect(new Date(lt).toISOString()).toBe('2026-03-09T00:00:00.000Z')
      return Promise.resolve([mar8PayrollItem])
    })
    const asOf = new Date(2026, 1, 22, 12, 0, 0, 0)
    const result = await runNoonEmployeeReminders(asOf)
    expect(result.sent).toHaveLength(1)
  })
})

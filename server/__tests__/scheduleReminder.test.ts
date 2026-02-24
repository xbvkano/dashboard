/**
 * Tests for schedule reminder job: nextScheduleUpdateDueAt, employee and supervisor SMS.
 * Uses test user Marcos Kano (employee) and Marcos Kano2 (supervisor), number 7255774523.
 */

const mockScheduleFindMany = jest.fn()
const mockSchedulePolicyFindUnique = jest.fn()
const mockSchedulePolicyCreate = jest.fn()
const mockScheduleUpdate = jest.fn()
const mockMessagesCreate = jest.fn()

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    schedulePolicy: {
      findUnique: mockSchedulePolicyFindUnique,
      create: mockSchedulePolicyCreate,
    },
    schedule: {
      findMany: mockScheduleFindMany,
      update: mockScheduleUpdate,
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

import { sendScheduleReminders } from '../src/jobs/scheduleReminder'

const DAY_MS = 1000 * 60 * 60 * 24

function scheduleWithEmployee(
  overrides: {
    id?: number
    nextScheduleUpdateDueAt?: Date | null
    employeeUpdate?: Date | null
    employee?: {
      id: number
      name: string
      number: string
      supervisor?: { id: number; name: string | null; userName: string | null; employee?: { number: string } | null } | null
    }
  } = {}
) {
  return {
    id: 1,
    nextScheduleUpdateDueAt: null as Date | null,
    employeeUpdate: null as Date | null,
    employee: {
      id: 10,
      name: 'Marcos Kano',
      number: '7255774523',
      supervisor: {
        id: 2,
        name: 'Marcos Kano2',
        userName: '7255774523',
        employee: null,
      },
    },
    ...overrides,
  }
}

describe('sendScheduleReminders', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    mockMessagesCreate.mockResolvedValue({ sid: 'SM-schedule' })
    // Use TWILIO_FROM_NUMBER from .env (loaded in jest.setup.js); do not override so .env value is used
    if (!process.env.TWILIO_FROM_NUMBER) {
      process.env.TWILIO_FROM_NUMBER = '+15551234567'
    }
    mockSchedulePolicyFindUnique.mockResolvedValue({
      id: 1,
      updateDayOfWeek: 0,
      supervisorNotifyAfterDays: 4,
      stopRemindingAfterDays: 7,
    })
  })

  afterEach(() => {
    process.env = originalEnv
    jest.useRealTimers()
  })

  it('sends SMS to employee Marcos Kano when past due (2 days) and not yet supervisor day', async () => {
    const dueDate = new Date()
    dueDate.setHours(0, 0, 0, 0)
    dueDate.setDate(dueDate.getDate() - 2)
    mockScheduleFindMany.mockResolvedValue([
      scheduleWithEmployee({
        nextScheduleUpdateDueAt: dueDate,
        employeeUpdate: new Date(Date.now() - 10 * DAY_MS),
      }),
    ])
    jest.setSystemTime(new Date())
    await sendScheduleReminders()
    expect(mockMessagesCreate).toHaveBeenCalledTimes(1)
    const call = mockMessagesCreate.mock.calls[0][0]
    expect(call.to).toBe('+17255774523')
    expect(call.body).toContain('Marcos Kano')
    expect(call.body).toContain('Evidence Cleaning')
    expect(call.body).toContain('update your schedule')
  })

  it('sends SMS to employee and supervisor Marcos Kano2 when daysPastDue >= supervisorNotifyAfterDays', async () => {
    const dueDate = new Date()
    dueDate.setHours(0, 0, 0, 0)
    dueDate.setDate(dueDate.getDate() - 5) // 5 days past due; supervisorNotifyAfterDays = 4
    mockScheduleFindMany.mockResolvedValue([
      scheduleWithEmployee({
        nextScheduleUpdateDueAt: dueDate,
        employeeUpdate: new Date(Date.now() - 20 * DAY_MS),
      }),
    ])
    jest.setSystemTime(new Date())
    await sendScheduleReminders()
    expect(mockMessagesCreate).toHaveBeenCalledTimes(2)
    const toNumbers = mockMessagesCreate.mock.calls.map((c) => c[0].to)
    expect(toNumbers).toContain('+17255774523') // employee
    expect(toNumbers).toContain('+17255774523') // supervisor (same number for test)
    const bodies = mockMessagesCreate.mock.calls.map((c) => c[0].body)
    expect(bodies.some((b) => b.includes('Marcos Kano') && b.includes('update your schedule'))).toBe(true)
    expect(bodies.some((b) => b.includes('has not updated their schedule') && b.includes('days past due'))).toBe(true)
  })

  it('does not send when today is before or on due date', async () => {
    const dueDate = new Date()
    dueDate.setHours(0, 0, 0, 0)
    dueDate.setDate(dueDate.getDate() + 1) // tomorrow
    mockScheduleFindMany.mockResolvedValue([
      scheduleWithEmployee({ nextScheduleUpdateDueAt: dueDate }),
    ])
    jest.setSystemTime(new Date())
    await sendScheduleReminders()
    expect(mockMessagesCreate).not.toHaveBeenCalled()
  })

  it('does not send when days past due exceeds stopRemindingAfterDays', async () => {
    const dueDate = new Date()
    dueDate.setHours(0, 0, 0, 0)
    dueDate.setDate(dueDate.getDate() - 10) // 10 days past; stop = 7
    mockScheduleFindMany.mockResolvedValue([
      scheduleWithEmployee({
        nextScheduleUpdateDueAt: dueDate,
        employee: { id: 10, name: 'Marcos Kano', number: '7255774523', supervisor: null },
      }),
    ])
    jest.setSystemTime(new Date())
    await sendScheduleReminders()
    expect(mockMessagesCreate).not.toHaveBeenCalled()
  })

  it('backfills nextScheduleUpdateDueAt when null and then skips if still on or before due', async () => {
    mockScheduleFindMany.mockResolvedValue([
      scheduleWithEmployee({ nextScheduleUpdateDueAt: null }),
    ])
    jest.setSystemTime(new Date(2026, 1, 22, 12, 0, 0, 0)) // Sunday Feb 22, 2026
    await sendScheduleReminders()
    expect(mockScheduleUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { nextScheduleUpdateDueAt: expect.any(Date) },
    })
    const setDue = mockScheduleUpdate.mock.calls[0][0].data.nextScheduleUpdateDueAt as Date
    expect(setDue.getDay()).toBe(0)
    expect(setDue.getDate()).toBe(22)
    expect(setDue.getMonth()).toBe(1)
    expect(mockMessagesCreate).not.toHaveBeenCalled()
  })

  it('backfill sets due to Sunday week 2 when today is Monday week 1 (reminder uses update day)', async () => {
    mockScheduleFindMany.mockResolvedValue([
      scheduleWithEmployee({ nextScheduleUpdateDueAt: null }),
    ])
    jest.setSystemTime(new Date(2026, 1, 23, 9, 0, 0, 0)) // Mon Feb 23, 2026 (week 1)
    await sendScheduleReminders()
    expect(mockScheduleUpdate).toHaveBeenCalled()
    const setDue = mockScheduleUpdate.mock.calls[0][0].data.nextScheduleUpdateDueAt as Date
    expect(setDue.getDay()).toBe(0) // Sunday
    expect(setDue.getDate()).toBe(1) // Mar 1 = Sunday week 2
    expect(setDue.getMonth()).toBe(2) // March
    expect(mockMessagesCreate).not.toHaveBeenCalled()
  })

  it('sends reminder when due date is Sunday week 2 and today is Monday week 2 (1 day past due)', async () => {
    const dueDate = new Date(2026, 2, 1, 0, 0, 0, 0) // Sun Mar 1 (week 2)
    mockScheduleFindMany.mockResolvedValue([
      scheduleWithEmployee({
        nextScheduleUpdateDueAt: dueDate,
        employeeUpdate: new Date(2026, 1, 20),
      }),
    ])
    jest.setSystemTime(new Date(2026, 2, 2, 9, 0, 0, 0)) // Mon Mar 2 (week 2, 1 day past due)
    await sendScheduleReminders()
    expect(mockMessagesCreate).toHaveBeenCalledTimes(1)
    expect(mockMessagesCreate.mock.calls[0][0].body).toContain('update your schedule')
  })

  it('skips when TWILIO_FROM_NUMBER is not set', async () => {
    delete process.env.TWILIO_FROM_NUMBER
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() - 2)
    mockScheduleFindMany.mockResolvedValue([
      scheduleWithEmployee({ nextScheduleUpdateDueAt: dueDate }),
    ])
    await sendScheduleReminders()
    expect(mockMessagesCreate).not.toHaveBeenCalled()
  })
})

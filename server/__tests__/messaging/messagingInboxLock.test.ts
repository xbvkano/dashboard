import {
  CLIENT_INBOX_LOCK_KEY,
  EMPLOYEE_INBOX_LOCK_KEY,
} from '../../src/services/messaging/inboxLines'
import {
  acquireOrRenewInboxLock,
  releaseInboxLock,
} from '../../src/services/messagingInboxLock'

function makePrisma() {
  const store = new Map<
    string,
    {
      key: string
      holderUserId: number | null
      leaseUntil: Date | null
      tabId: string | null
    }
  >()

  return {
    messagingInboxLock: {
      findUnique: jest.fn(async ({ where: { key } }: { where: { key: string } }) => {
        return store.get(key) ?? null
      }),
      create: jest.fn(
        async ({
          data,
        }: {
          data: {
            key: string
            holderUserId: number
            leaseUntil: Date
            tabId?: string
          }
        }) => {
          const row = {
            key: data.key,
            holderUserId: data.holderUserId,
            leaseUntil: data.leaseUntil,
            tabId: data.tabId ?? null,
          }
          store.set(data.key, row)
          return row
        },
      ),
      update: jest.fn(
        async ({
          where: { key },
          data,
        }: {
          where: { key: string }
          data: Partial<{
            holderUserId: number | null
            leaseUntil: Date | null
            tabId: string | null
          }>
        }) => {
          const prev = store.get(key)
          if (!prev) throw new Error(`missing ${key}`)
          const next = { ...prev, ...data }
          store.set(key, next)
          return next
        },
      ),
    },
    _store: store,
  } as any
}

describe('messagingInboxLock', () => {
  it('uses independent keys for client and employee inboxes', async () => {
    const prisma = makePrisma()

    const client = await acquireOrRenewInboxLock(prisma, { userId: 1, inbox: 'client' })
    expect(client).toEqual({ ok: true })
    expect(prisma._store.has(CLIENT_INBOX_LOCK_KEY)).toBe(true)

    const employee = await acquireOrRenewInboxLock(prisma, { userId: 2, inbox: 'employee' })
    expect(employee).toEqual({ ok: true })
    expect(prisma._store.has(EMPLOYEE_INBOX_LOCK_KEY)).toBe(true)

    // Different holders on different locks — neither blocks the other
    expect(prisma._store.get(CLIENT_INBOX_LOCK_KEY)?.holderUserId).toBe(1)
    expect(prisma._store.get(EMPLOYEE_INBOX_LOCK_KEY)?.holderUserId).toBe(2)

    const clientBlocked = await acquireOrRenewInboxLock(prisma, { userId: 3, inbox: 'client' })
    expect(clientBlocked.ok).toBe(false)

    const employeeStillOk = await acquireOrRenewInboxLock(prisma, {
      userId: 2,
      inbox: 'employee',
    })
    expect(employeeStillOk).toEqual({ ok: true })

    await releaseInboxLock(prisma, { userId: 1, inbox: 'client' })
    expect(prisma._store.get(CLIENT_INBOX_LOCK_KEY)?.holderUserId).toBeNull()
    expect(prisma._store.get(EMPLOYEE_INBOX_LOCK_KEY)?.holderUserId).toBe(2)
  })
})

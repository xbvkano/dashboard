/**
 * Minimal Message Bank group tests (controller-level via Prisma).
 * Focus: group CRUD doesn't throw and templates can be assigned a groupId.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

describe('MessageBankGroups', () => {
  beforeAll(async () => {
    await prisma.messageBankTemplate.deleteMany()
    await prisma.messageBankGroup.deleteMany()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('creates a group and assigns templates', async () => {
    const group = await prisma.messageBankGroup.create({
      data: { name: 'Test Group', color: '#FFFFFF' },
    })

    const t = await prisma.messageBankTemplate.create({
      data: {
        name: 'Test Template',
        body: 'Hello {{Name}}',
        builtinVariables: ['NAME'],
        customVariables: [],
        groupId: group.id,
      },
    })

    expect(t.groupId).toBe(group.id)

    const fetched = await prisma.messageBankTemplate.findUnique({ where: { id: t.id } })
    expect(fetched?.groupId).toBe(group.id)
  })

  it('deleting a group nulls groupId (SetNull)', async () => {
    const group = await prisma.messageBankGroup.create({
      data: { name: 'Delete Group', color: '#FF0000' },
    })
    const t = await prisma.messageBankTemplate.create({
      data: {
        name: 'Delete Group Template',
        body: 'Hello',
        builtinVariables: [],
        customVariables: [],
        groupId: group.id,
      },
    })

    await prisma.messageBankGroup.delete({ where: { id: group.id } })
    const after = await prisma.messageBankTemplate.findUnique({ where: { id: t.id } })
    expect(after?.groupId).toBeNull()
  })
})


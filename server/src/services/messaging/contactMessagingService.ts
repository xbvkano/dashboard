import type { PrismaClient } from '@prisma/client'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library'
import { ContactPointType } from '@prisma/client'
import { normalizePhone, phoneLookupVariants } from '../../utils/phoneUtils'
import { findOrCreateConversation } from './messagingService'

function getInboxBusinessNumber(): string {
  const n = process.env.TWILIO_FROM_NUMBER?.trim()
  if (!n) {
    throw new Error('TWILIO_FROM_NUMBER is not configured (required as inbox business line)')
  }
  return n
}

/**
 * Start or open a conversation for a phone contact. Optionally create/link a Client when name is provided.
 * Client name and notes live on Client, not ContactPoint.
 */
export async function startConversationFromContact(
  prisma: PrismaClient,
  input: { phoneRaw: string; name?: string | null; notes?: string | null }
): Promise<{ conversationId: number; contactPointId: number; clientId: number | null }> {
  const name = input.name?.trim() || ''
  const notes = input.notes?.trim() || undefined
  if (notes && !name) {
    throw new Error('Notes can only be set when a name is provided')
  }

  const value = normalizePhone(input.phoneRaw)
  if (!value) {
    throw new Error('Invalid phone number')
  }

  const businessNumber = getInboxBusinessNumber()

  let cp =
    (await prisma.contactPoint.findUnique({
      where: { type_value: { type: ContactPointType.PHONE, value } },
    })) ??
    (await prisma.contactPoint.create({
      data: { type: ContactPointType.PHONE, value },
    }))

  if (name) {
    if (!cp.clientId) {
      const existingByPhone = await prisma.client.findFirst({
        where: { number: { in: phoneLookupVariants(value) } },
      })
      if (existingByPhone) {
        await prisma.contactPoint.update({
          where: { id: cp.id },
          data: { clientId: existingByPhone.id },
        })
        if (notes !== undefined) {
          await prisma.client.update({
            where: { id: existingByPhone.id },
            data: { notes },
          })
        }
      } else {
        const clash = await prisma.client.findFirst({
          where: { name: { equals: name, mode: 'insensitive' } },
        })
        if (clash) {
          throw new Error('A client with this name already exists')
        }
        const client = await prisma.client.create({
          data: {
            name,
            number: value,
            from: 'SMS',
            notes: notes ?? undefined,
          },
        })
        await prisma.contactPoint.update({
          where: { id: cp.id },
          data: { clientId: client.id },
        })
      }
    } else if (notes !== undefined) {
      await prisma.client.update({
        where: { id: cp.clientId },
        data: { notes },
      })
    }
  }

  cp = (await prisma.contactPoint.findUnique({
    where: { id: cp.id },
  }))!

  const conv = await findOrCreateConversation(prisma, {
    contactPointId: cp.id,
    businessNumber,
    clientId: cp.clientId,
  })

  return {
    conversationId: conv.id,
    contactPointId: cp.id,
    clientId: conv.clientId,
  }
}

/**
 * Update Client linked to this conversation (name + notes). Name lives on Client, not ContactPoint.
 * If no client yet, creates one when name is provided.
 */
export async function updateClientForConversation(
  prisma: PrismaClient,
  conversationId: number,
  input: { name?: string | null; notes?: string | null }
): Promise<{ clientId: number }> {
  const nameTrim = input.name?.trim() ?? ''
  const notesVal = input.notes

  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { contactPoint: true },
  })
  if (!conv) {
    throw new Error('Conversation not found')
  }

  const cp = conv.contactPoint

  if (notesVal !== undefined && notesVal !== null && String(notesVal).length > 0 && !nameTrim && !cp.clientId) {
    throw new Error('Notes require a name when no client is linked yet')
  }

  if (cp.clientId) {
    const clientId = cp.clientId
    const data: { name?: string; notes?: string | null } = {}
    if (nameTrim) {
      const clash = await prisma.client.findFirst({
        where: {
          name: { equals: nameTrim, mode: 'insensitive' },
          NOT: { id: clientId },
        },
      })
      if (clash) {
        throw new Error('A client with this name already exists')
      }
      data.name = nameTrim
    }
    if (notesVal !== undefined) {
      data.notes = notesVal === null || notesVal === '' ? null : String(notesVal)
    }
    if (Object.keys(data).length === 0) {
      return { clientId }
    }
    try {
      await prisma.client.update({ where: { id: clientId }, data })
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new Error('A client with this name already exists')
      }
      throw e
    }
    return { clientId }
  }

  if (!nameTrim) {
    throw new Error('Name is required to create and link a client for this contact')
  }

  const existingByPhone = await prisma.client.findFirst({
    where: { number: { in: phoneLookupVariants(cp.value) } },
  })
  if (existingByPhone) {
    const clash = await prisma.client.findFirst({
      where: {
        name: { equals: nameTrim, mode: 'insensitive' },
        NOT: { id: existingByPhone.id },
      },
    })
    if (clash) {
      throw new Error('A client with this name already exists')
    }
    await prisma.client.update({
      where: { id: existingByPhone.id },
      data: {
        name: nameTrim,
        notes:
          notesVal !== undefined
            ? notesVal === null || notesVal === ''
              ? null
              : String(notesVal)
            : undefined,
      },
    })
    await prisma.contactPoint.update({
      where: { id: cp.id },
      data: { clientId: existingByPhone.id },
    })
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { clientId: existingByPhone.id },
    })
    return { clientId: existingByPhone.id }
  }

  const clash = await prisma.client.findFirst({
    where: { name: { equals: nameTrim, mode: 'insensitive' } },
  })
  if (clash) {
    throw new Error('A client with this name already exists')
  }

  const client = await prisma.client.create({
    data: {
      name: nameTrim,
      number: cp.value,
      from: 'SMS',
      notes:
        notesVal !== undefined && notesVal !== null && String(notesVal).length > 0
          ? String(notesVal)
          : undefined,
    },
  })

  await prisma.contactPoint.update({
    where: { id: cp.id },
    data: { clientId: client.id },
  })
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { clientId: client.id },
  })

  return { clientId: client.id }
}

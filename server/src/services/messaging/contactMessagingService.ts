import type { PrismaClient } from '@prisma/client'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library'
import { ContactPointType } from '@prisma/client'
import { normalizePhone } from '../../utils/phoneUtils'
import { pickUniqueClientDisplayName } from '../../utils/clientDisplayName'
import { findFirstClientMatchingPhone, unlinkContactPointIfClientPhoneMismatch } from '../clientPhoneMatch'
import { findOrCreateConversation } from './messagingService'
import {
  type MessagingInboxKind,
  resolveInboxBusinessNumber,
} from './inboxLines'

/**
 * Start or open a conversation for a phone contact.
 * Client inbox: optionally create/link a Client when name is provided.
 * Employee inbox: uses TWILIO_ADMIN_FROM_NUMBER; optional name → ContactPoint.displayValue (no Client).
 */
export async function startConversationFromContact(
  prisma: PrismaClient,
  input: {
    phoneRaw: string
    name?: string | null
    notes?: string | null
    clientFrom?: string | null
    inbox?: MessagingInboxKind
  }
): Promise<{ conversationId: number; contactPointId: number; clientId: number | null }> {
  const inbox: MessagingInboxKind = input.inbox === 'employee' ? 'employee' : 'client'
  const name = input.name?.trim() || ''
  const notes = input.notes?.trim() || undefined
  const clientFromLabel = input.clientFrom?.trim() || 'SMS'

  if (inbox === 'employee' && notes) {
    throw new Error('Notes are only supported in the client inbox')
  }
  if (notes && !name) {
    throw new Error('Notes can only be set when a name is provided')
  }

  const value = normalizePhone(input.phoneRaw)
  if (!value) {
    throw new Error('Invalid phone number')
  }

  const businessNumber = resolveInboxBusinessNumber(inbox)

  let cp =
    (await prisma.contactPoint.findUnique({
      where: { type_value: { type: ContactPointType.PHONE, value } },
    })) ??
    (await prisma.contactPoint.create({
      data: {
        type: ContactPointType.PHONE,
        value,
        displayValue: inbox === 'employee' && name ? name : undefined,
      },
    }))

  if (inbox === 'employee') {
    if (name && cp.displayValue !== name) {
      cp = await prisma.contactPoint.update({
        where: { id: cp.id },
        data: { displayValue: name },
      })
    }

    // Prefer Employee.name when phone matches an employee account
    if (!name) {
      const emp = await prisma.employee.findFirst({
        where: { number: value, disabled: false },
        select: { name: true },
      })
      if (emp?.name && !cp.displayValue) {
        cp = await prisma.contactPoint.update({
          where: { id: cp.id },
          data: { displayValue: emp.name },
        })
      }
    }

    const conv = await findOrCreateConversation(prisma, {
      contactPointId: cp.id,
      businessNumber,
      clientId: null,
    })

    return {
      conversationId: conv.id,
      contactPointId: cp.id,
      clientId: null,
    }
  }

  await unlinkContactPointIfClientPhoneMismatch(prisma, cp.id, value, businessNumber)
  cp = (await prisma.contactPoint.findUnique({
    where: { id: cp.id },
  }))!

  if (name) {
    if (!cp.clientId) {
      const existingByPhone = await findFirstClientMatchingPhone(prisma, value)
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
        const nameToUse = await pickUniqueClientDisplayName(prisma, name, value)
        const client = await prisma.client.create({
          data: {
            name: nameToUse,
            number: value,
            from: clientFromLabel,
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

  await unlinkContactPointIfClientPhoneMismatch(prisma, cp.id, cp.value, conv.businessNumber)

  const convRefreshed = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { contactPoint: true },
  })
  if (!convRefreshed) {
    throw new Error('Conversation not found')
  }
  const cpRef = convRefreshed.contactPoint

  if (notesVal !== undefined && notesVal !== null && String(notesVal).length > 0 && !nameTrim && !cpRef.clientId) {
    throw new Error('Notes require a name when no client is linked yet')
  }

  if (cpRef.clientId) {
    const clientId = cpRef.clientId
    const data: { name?: string; notes?: string | null } = {}
    if (nameTrim) {
      const nameToUse = await pickUniqueClientDisplayName(prisma, nameTrim, cpRef.value, clientId)
      data.name = nameToUse
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

  const existingByPhone = await findFirstClientMatchingPhone(prisma, cpRef.value)
  if (existingByPhone) {
    const nameToUse = await pickUniqueClientDisplayName(prisma, nameTrim, cpRef.value, existingByPhone.id)
    await prisma.client.update({
      where: { id: existingByPhone.id },
      data: {
        name: nameToUse,
        notes:
          notesVal !== undefined
            ? notesVal === null || notesVal === ''
              ? null
              : String(notesVal)
            : undefined,
      },
    })
    await prisma.contactPoint.update({
      where: { id: cpRef.id },
      data: { clientId: existingByPhone.id },
    })
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { clientId: existingByPhone.id },
    })
    return { clientId: existingByPhone.id }
  }

  const nameToUse = await pickUniqueClientDisplayName(prisma, nameTrim, cpRef.value)

  const client = await prisma.client.create({
    data: {
      name: nameToUse,
      number: cpRef.value,
      from: 'SMS',
      notes:
        notesVal !== undefined && notesVal !== null && String(notesVal).length > 0
          ? String(notesVal)
          : undefined,
    },
  })

  await prisma.contactPoint.update({
    where: { id: cpRef.id },
    data: { clientId: client.id },
  })
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { clientId: client.id },
  })

  return { clientId: client.id }
}

import {
  resolveMessageBankVariables,
  resolvedToVariableValues,
} from '../../../client/src/Admin/pages/Messages/MessageBank/resolveMessageBankVariables'
import type { ConversationDetail } from '../../../client/src/Admin/pages/Messages/Inbox/messagingApi'
import type { ThreadContact } from '../../../client/src/Admin/pages/Messages/Inbox/types'

describe('resolveMessageBankVariables', () => {
  const threadContact: ThreadContact = {
    id: 1,
    businessNumber: '+17025550000',
    phoneE164: '+17025551234',
    contactName: 'Thread Name',
    clientNotes: null,
    clientId: 5,
    lastPreview: null,
    lastAt: null,
    unread: false,
  }

  const detail: ConversationDetail = {
    conversation: {
      id: 1,
      channel: 'SMS',
      status: 'OPEN',
      businessNumber: '+17025550000',
      lastMessageAt: null,
      openedAt: '2026-01-01T00:00:00Z',
      archivedAt: null,
      clientId: 5,
    },
    contactPoint: {
      id: 1,
      type: 'PHONE',
      value: '+17025551234',
      displayValue: null,
      clientId: 5,
    },
    client: { id: 5, name: 'CRM Client', number: '7025551234', notes: null },
    sessions: [{ id: 1, openedAt: '2026-01-01', closedAt: null, closeReason: null, summary: null, bookingIntent: 'DEEP', confidence: null, appointments: [] }],
    messages: [],
  }

  it('prefers booking draft over client name', () => {
    const resolved = resolveMessageBankVariables({
      detail,
      threadContact,
      bookingDraft: {
        clientName: 'Draft Name',
        price: '400',
        serviceType: 'STANDARD',
      },
      quotes: [],
      calls: [],
    })
    expect(resolved.name).toBe('Draft Name')
    expect(resolved.price).toBe('$400')
    expect(resolved.serviceType).toBe('Standard')
  })

  it('falls back to quote by phone', () => {
    const resolved = resolveMessageBankVariables({
      detail: null,
      threadContact: { ...threadContact, contactName: null },
      quotes: [
        {
          id: 1,
          name: 'Lead Name',
          number: '7025551234',
          address: '',
          size: '',
          date: '',
          service: 'Deep clean',
          baseboards: false,
          fridgeInside: false,
          ovenInside: false,
          done: false,
          price: 250,
          carpetShampooRooms: 0,
          blacklist: false,
          source: '',
          otherSource: null,
          dateCreated: new Date(),
        },
      ],
      calls: [],
    })
    expect(resolved.name).toBe('Lead Name')
    expect(resolved.price).toBe('$250')
    expect(resolved.serviceType).toBe('Deep clean')
  })

  it('maps to variable values record', () => {
    const values = resolvedToVariableValues({ name: 'A', price: '$1', serviceType: 'Deep' })
    expect(values).toEqual({ name: 'A', price: '$1', serviceType: 'Deep' })
  })
})

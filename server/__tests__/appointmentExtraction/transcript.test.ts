import { formatMessagesTranscript } from '../../src/services/appointmentExtraction/transcript'
import type { Message } from '@prisma/client'

describe('formatMessagesTranscript', () => {
  it('labels INBOUND as Customer and OUTBOUND as Staff', () => {
    const messages = [
      { direction: 'INBOUND', body: 'Hi there' },
      { direction: 'OUTBOUND', body: 'Hello' },
    ] as Message[]
    expect(formatMessagesTranscript(messages)).toBe('Customer: Hi there\n\nStaff: Hello')
  })

  it('skips empty bodies', () => {
    const messages = [
      { direction: 'INBOUND', body: '   ' },
      { direction: 'OUTBOUND', body: 'Only this' },
    ] as Message[]
    expect(formatMessagesTranscript(messages)).toBe('Staff: Only this')
  })
})

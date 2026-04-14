import type { Message, MessageDirection } from '@prisma/client'

/**
 * Build a linear transcript for LLM extraction. INBOUND = customer, OUTBOUND = staff.
 */
export function formatMessagesTranscript(messages: Message[]): string {
  const lines: string[] = []
  for (const m of messages) {
    const role = directionToLabel(m.direction)
    const text = (m.body ?? '').trim()
    if (!text) continue
    lines.push(`${role}: ${text}`)
  }
  return lines.join('\n\n')
}

function directionToLabel(direction: MessageDirection): 'Customer' | 'Staff' {
  return direction === 'INBOUND' ? 'Customer' : 'Staff'
}

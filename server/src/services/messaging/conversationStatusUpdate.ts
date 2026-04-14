import { ConversationStatus, type Prisma } from '@prisma/client'

/**
 * Centralize conversation status updates so we can unit-test side effects like
 * clearing Pushover throttle when restoring to OPEN.
 */
export function buildConversationStatusUpdateData(
  status: 'OPEN' | 'ARCHIVED',
  now: Date = new Date(),
): Prisma.ConversationUpdateInput {
  if (status === 'ARCHIVED') {
    return {
      status: ConversationStatus.ARCHIVED,
      archivedAt: now,
    }
  }

  // Restoring to inbox: clear archive timestamp and allow next inbound to notify immediately.
  return {
    status: ConversationStatus.OPEN,
    archivedAt: null,
    lastPushoverNotifiedAt: null,
  }
}


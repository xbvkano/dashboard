/**
 * After PATCH conversation status, the visible list must match the folder the thread moved to;
 * otherwise the row disappears while selection stays (empty chat).
 */
export type InboxListAfterStatusPatch = { fetchStatus: 'OPEN' | 'ARCHIVED'; setShowArchived: boolean }

export function inboxListAfterStatusPatch(
  nextStatus: 'OPEN' | 'ARCHIVED',
  currentlyShowingArchived: boolean,
): InboxListAfterStatusPatch | null {
  if (nextStatus === 'OPEN' && currentlyShowingArchived) {
    return { fetchStatus: 'OPEN', setShowArchived: false }
  }
  if (nextStatus === 'ARCHIVED' && !currentlyShowingArchived) {
    return { fetchStatus: 'ARCHIVED', setShowArchived: true }
  }
  return null
}

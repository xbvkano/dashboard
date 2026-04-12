/** Short time label for message bubbles */
export function formatMessageTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

/** Relative day + time for conversation list */
export function formatConversationTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startOfMsg = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const diffDays = Math.round((startOfToday - startOfMsg) / (24 * 60 * 60 * 1000))

  const t = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

  if (diffDays === 0) return t
  if (diffDays === 1) return `Yesterday`
  if (diffDays < 7) return d.toLocaleDateString(undefined, { weekday: 'short' })
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

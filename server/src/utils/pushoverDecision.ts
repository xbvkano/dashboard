const PUSHOVER_COOLDOWN_MS = 5 * 60 * 1000

export function shouldSendInboundPushover(args: {
  now: Date
  hasActivePresence: boolean
  lastPushoverNotifiedAt: Date | null
}): boolean {
  if (args.hasActivePresence) return false
  if (args.lastPushoverNotifiedAt == null) return true
  return args.now.getTime() - args.lastPushoverNotifiedAt.getTime() >= PUSHOVER_COOLDOWN_MS
}

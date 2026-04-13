/**
 * Pushover notifications (https://pushover.net/api)
 */

export interface PushoverInboundPayload {
  title: string
  message: string
  url?: string
  /** -2 … 2 — see https://pushover.net/api#priority */
  priority?: number
  /** Built-in sound name, e.g. `magic` — see https://pushover.net/api#sounds */
  sound?: string
}

export function isPushoverConfigured(): boolean {
  return Boolean(process.env.PUSHOVER_APP_TOKEN && process.env.PUSHOVER_USER_TOKEN)
}

export async function sendPushoverMessage(payload: PushoverInboundPayload): Promise<void> {
  const token = process.env.PUSHOVER_APP_TOKEN
  const user = process.env.PUSHOVER_USER_TOKEN
  if (!token || !user) return

  const body = new URLSearchParams()
  body.set('token', token)
  body.set('user', user)
  body.set('title', payload.title.slice(0, 250))
  body.set('message', payload.message.slice(0, 1024))
  if (payload.url) body.set('url', payload.url.slice(0, 512))
  if (payload.priority !== undefined && Number.isFinite(payload.priority)) {
    body.set('priority', String(Math.trunc(payload.priority)))
  }
  if (payload.sound && payload.sound.trim()) {
    body.set('sound', payload.sound.trim().slice(0, 64))
  }

  const res = await fetch('https://api.pushover.net/1/messages.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Pushover failed: ${res.status} ${t}`)
  }
}

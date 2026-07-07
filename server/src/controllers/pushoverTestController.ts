import { Request, Response } from 'express'
import { isPushoverConfigured, sendPushoverMessage } from '../services/pushover'
import {
  buildPushoverTestSample,
  isPushoverTestType,
  listPushoverTestSamples,
} from '../utils/pushoverNotificationCopy'

function devPushoverTestsAllowed(): boolean {
  return process.env.NODE_ENV !== 'production'
}

export function getPushoverTestSamples(_req: Request, res: Response): void {
  if (!devPushoverTestsAllowed()) {
    res.status(403).json({ error: 'Pushover test samples are not available in production' })
    return
  }
  res.json({ samples: listPushoverTestSamples() })
}

export async function sendPushoverTest(req: Request, res: Response): Promise<void> {
  if (!devPushoverTestsAllowed()) {
    res.status(403).json({ error: 'Pushover test send is not available in production' })
    return
  }

  const type = typeof req.body?.type === 'string' ? req.body.type.trim() : ''
  if (!isPushoverTestType(type)) {
    res.status(400).json({ error: 'type must be INBOUND_SMS, WEBSITE_FORM, or INBOUND_CALL' })
    return
  }

  if (!isPushoverConfigured()) {
    res.status(503).json({ error: 'Pushover is not configured (PUSHOVER_APP_TOKEN / PUSHOVER_USER_TOKEN)' })
    return
  }

  const sample = buildPushoverTestSample(type)
  try {
    await sendPushoverMessage(sample.payload)
    res.json({
      ok: true,
      type,
      label: sample.label,
      sent: sample.payload,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Pushover send failed'
    res.status(502).json({ error: message })
  }
}

import { Request, Response } from 'express'
import { PrismaClient, Role } from '@prisma/client'
import {
  getCallerContext,
  getEmployeeByCode,
  getOnDutyCandidates,
} from '../services/callCenterService'

const prisma = new PrismaClient()

const RITA_SEED_PHONE = '+17255774524'
const SAMPLE_CUSTOMER_PHONE = '+15551234567'

function devCallCenterTestsAllowed(): boolean {
  return process.env.NODE_ENV !== 'production'
}

function callCenterBaseUrl(): string | null {
  const raw = process.env.CALL_CENTER_URL?.trim()
  if (!raw) return null
  return raw.replace(/\/+$/, '')
}

/** Expected Twilio callerId when dialing an on-duty / target person. */
export function expectedDialCallerId(
  role: Role | string | null | undefined,
  originalCaller: string,
  twilioAdminNumber: string
): string {
  if (role === 'OWNER') return originalCaller
  return twilioAdminNumber
}

export function listCallCenterTestPresets() {
  return [
    {
      id: 'privileged-caller',
      label: 'Privileged caller (Rita)',
      description:
        'Seed OWNER Rita at +17255774524 → privileged:true (code-entry path on admin line).',
      kind: 'caller-context' as const,
      phone: RITA_SEED_PHONE,
    },
    {
      id: 'customer-caller',
      label: 'Non-privileged caller',
      description: 'Unknown customer number → privileged:false (on-duty dial path).',
      kind: 'caller-context' as const,
      phone: SAMPLE_CUSTOMER_PHONE,
    },
    {
      id: 'on-duty-now',
      label: 'Who is on duty now',
      description:
        'Materialized OnDutySchedule windows covering now. Annotates expected callerId per role.',
      kind: 'on-duty' as const,
    },
    {
      id: 'by-code',
      label: 'Employee by code',
      description: 'Lookup Employee.id as 3-digit keypad code (e.g. 001).',
      kind: 'by-code' as const,
      code: '001',
    },
    {
      id: 'voice-privileged',
      label: 'TwiML: admin-voice as Rita',
      description: 'Proxies POST /admin-voice to CALL_CENTER_URL (expects Gather for employee code).',
      kind: 'voice' as const,
      path: '/admin-voice',
      from: RITA_SEED_PHONE,
    },
    {
      id: 'voice-customer',
      label: 'TwiML: admin-voice as customer',
      description:
        'Proxies POST /admin-voice. Expect Dial with OWNER=original CID or ADMIN=Twilio admin CID, or text-us if empty.',
      kind: 'voice' as const,
      path: '/admin-voice',
      from: SAMPLE_CUSTOMER_PHONE,
    },
  ]
}

export function getCallCenterTestStatus(_req: Request, res: Response): void {
  if (!devCallCenterTestsAllowed()) {
    res.status(403).json({ error: 'Call center DevTools are not available in production' })
    return
  }

  const base = callCenterBaseUrl()
  res.json({
    callCenterUrl: base,
    callCenterUrlConfigured: Boolean(base),
    twilioWebhookNote:
      'Point TWILIO_ADMIN_PHONE_NUMBER voice webhook at the call center host: POST /admin-voice (no /api prefix). Dashboard /api/call-center/* is the service API the call center calls.',
    presets: listCallCenterTestPresets(),
  })
}

type ProbeBody = {
  kind?: string
  phone?: string
  code?: string
  at?: string
}

export async function probeCallCenterApi(req: Request, res: Response): Promise<void> {
  if (!devCallCenterTestsAllowed()) {
    res.status(403).json({ error: 'Call center DevTools are not available in production' })
    return
  }

  const body = (req.body ?? {}) as ProbeBody
  const kind = typeof body.kind === 'string' ? body.kind.trim() : ''

  try {
    if (kind === 'caller-context') {
      const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
      if (!phone) {
        res.status(400).json({ error: 'phone is required' })
        return
      }
      const result = await getCallerContext(prisma, phone)
      res.json({
        kind,
        phone,
        result,
        notes: result.privileged
          ? 'Admin line should prompt for a 3-digit employee code.'
          : 'Admin line should dial on-duty (or text-us if nobody is on duty).',
      })
      return
    }

    if (kind === 'by-code') {
      const code = typeof body.code === 'string' ? body.code.trim() : ''
      if (!code) {
        res.status(400).json({ error: 'code is required' })
        return
      }
      const result = await getEmployeeByCode(prisma, code)
      if (!result) {
        res.status(404).json({ kind, code, error: 'Employee not found' })
        return
      }
      res.json({
        kind,
        code,
        result,
        notes:
          'Code-route dials use TWILIO_ADMIN_PHONE_NUMBER as callerId (not the original caller).',
      })
      return
    }

    if (kind === 'on-duty') {
      let at = new Date()
      if (typeof body.at === 'string' && body.at.trim()) {
        at = new Date(body.at)
        if (Number.isNaN(at.getTime())) {
          res.status(400).json({ error: 'at must be a valid ISO datetime' })
          return
        }
      }
      const result = await getOnDutyCandidates(prisma, at)
      const sampleFrom = SAMPLE_CUSTOMER_PHONE
      const adminPlaceholder = 'TWILIO_ADMIN_PHONE_NUMBER'
      const annotated = result.candidates.map((c) => ({
        ...c,
        expectedCallerId: expectedDialCallerId(c.role, sampleFrom, adminPlaceholder),
        callerIdPolicy: c.role === 'OWNER' ? 'original-caller' : 'twilio-admin',
      }))
      res.json({
        kind,
        at: at.toISOString(),
        result: { candidates: annotated },
        notes:
          annotated.length === 0
            ? 'Empty list → admin-voice should Say “Please text us…” and Hangup.'
            : 'First candidate is dialed first; backups follow on no-answer/busy via /admin-dial-status.',
      })
      return
    }

    res.status(400).json({
      error: 'kind must be caller-context, by-code, or on-duty',
    })
  } catch (err) {
    console.error('probeCallCenterApi error', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

type VoiceBody = {
  path?: string
  From?: string
  To?: string
  Digits?: string
  DialCallStatus?: string
  CallSid?: string
}

const ALLOWED_VOICE_PATHS = new Set([
  '/admin-voice',
  '/admin-code',
  '/admin-code-retry',
  '/admin-dial-status',
  '/admin-whisper',
])

export async function proxyCallCenterVoice(req: Request, res: Response): Promise<void> {
  if (!devCallCenterTestsAllowed()) {
    res.status(403).json({ error: 'Call center DevTools are not available in production' })
    return
  }

  const base = callCenterBaseUrl()
  if (!base) {
    res.status(503).json({
      error:
        'CALL_CENTER_URL is not set. Add e.g. CALL_CENTER_URL=http://localhost:5000 to server/.env to proxy TwiML.',
    })
    return
  }

  const body = (req.body ?? {}) as VoiceBody
  const path = typeof body.path === 'string' ? body.path.trim() : ''
  if (!ALLOWED_VOICE_PATHS.has(path)) {
    res.status(400).json({
      error: `path must be one of: ${[...ALLOWED_VOICE_PATHS].join(', ')}`,
    })
    return
  }

  const from = typeof body.From === 'string' ? body.From.trim() : ''
  if (!from && path !== '/admin-whisper') {
    res.status(400).json({ error: 'From is required' })
    return
  }

  const callSid =
    (typeof body.CallSid === 'string' && body.CallSid.trim()) ||
    `CAdevtools${Date.now()}`
  const to =
    (typeof body.To === 'string' && body.To.trim()) ||
    process.env.TWILIO_ADMIN_PHONE_NUMBER?.trim() ||
    '+17025552222'

  const form = new URLSearchParams()
  form.set('CallSid', callSid)
  form.set('From', from || '+15550000000')
  form.set('To', to)
  if (typeof body.Digits === 'string' && body.Digits.trim()) {
    form.set('Digits', body.Digits.trim())
  }
  if (typeof body.DialCallStatus === 'string' && body.DialCallStatus.trim()) {
    form.set('DialCallStatus', body.DialCallStatus.trim())
  }

  const url = `${base}${path}`
  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    })
    const twiml = await upstream.text()
    res.status(upstream.ok ? 200 : upstream.status).json({
      ok: upstream.ok,
      status: upstream.status,
      url,
      request: {
        CallSid: callSid,
        From: from || '+15550000000',
        To: to,
        Digits: body.Digits ?? null,
        DialCallStatus: body.DialCallStatus ?? null,
      },
      twiml,
      notes: [
        'Twilio admin webhook is POST {CALL_CENTER_URL}/admin-voice — no /api prefix.',
        'callerId on <Dial> should be original From for OWNER recipients, else Twilio admin number.',
      ],
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Proxy failed'
    res.status(502).json({
      error: `Failed to reach call center at ${url}: ${message}`,
    })
  }
}

import OpenAI from 'openai'
import type { RawAiExtraction } from './types'

/** Built at request time so the model defaults to today's calendar year for ambiguous dates. */
export function buildAppointmentExtractionSystemPrompt(now: Date = new Date()): string {
  const year = now.getFullYear()
  const exampleMonth = '04'
  const exampleDay = '13'
  const exampleDate = `${year}-${exampleMonth}-${exampleDay}`
  return `You are extracting structured booking data from SMS-style cleaning conversations.
Return a single JSON object only (no markdown). Use these rules:

- serviceType must be one of: STANDARD, DEEP, MOVE_IN_OUT (move-in, move-out, move in/out → MOVE_IN_OUT).
- size: prefer a range matching the company's buckets: 0-1000, 1000-1500, 1500-2000, 2000-2500, 2500-3000, 3000-3500, 3500-4000, 4000-4500, 4500-5000, 5000-5500, 5500-6000, 6000+. If you only have approximate sqft, pick the closest bucket.
- date: YYYY-MM-DD. For year: use the current calendar year (${year}) whenever the message shows only month/day, relative phrasing ("next Tuesday", "March 5"), or no year. Use a different year only when the user or screenshot explicitly states it (e.g. "2027", "next year", a printed date including the year, or clear historical context).
- time: 24-hour HH:mm (e.g. 09:00 for 9am).
- price: number as agreed in the thread (final confirmed price if multiple).
- appointmentAddress: full street address if available.
- notes: gate codes, pets, payment method, discounts, special instructions, or anything not captured above.
- clientPhone: phone number visible in the screenshots if any (prefer E.164 like +17025551234, or US 10-digit). Omit or null if not visible.
- missingOrUncertain: array of short strings listing what you could not determine confidently.

Examples of expected JSON shape:
{"clientName":"Reem Witwit","clientPhone":"+17025551234","appointmentAddress":"11584 Ashy Storm Ave, Las Vegas, NV 89138","price":360,"date":"${exampleDate}","time":"09:00","notes":"Move-in cleaning, no gate code","size":"1500-2000","serviceType":"MOVE_IN_OUT","missingOrUncertain":[]}`
}

function getOpenAI(): OpenAI {
  const key = process.env.OPENAI_API_KEY?.trim()
  if (!key) {
    throw new Error('OPENAI_API_KEY is not configured')
  }
  return new OpenAI({ apiKey: key })
}

function parseJsonObject(raw: string): RawAiExtraction {
  let text = raw.trim()
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '')
  }
  const parsed = JSON.parse(text) as RawAiExtraction
  return parsed
}

export async function extractAppointmentFromTranscript(transcript: string): Promise<RawAiExtraction> {
  const model = process.env.OPENAI_EXTRACTION_MODEL?.trim() || 'gpt-4o-mini'
  const openai = getOpenAI()

  const res = await openai.chat.completions.create({
    model,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: buildAppointmentExtractionSystemPrompt() },
      {
        role: 'user',
        content: `Conversation transcript:\n\n${transcript}`,
      },
    ],
    temperature: 0.2,
  })

  const content = res.choices[0]?.message?.content
  if (!content) throw new Error('OpenAI returned empty content')
  return parseJsonObject(content)
}

type VisionContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'auto' | 'low' | 'high' } }

export async function extractAppointmentFromImageUrls(imageUrls: string[]): Promise<RawAiExtraction> {
  const model = process.env.OPENAI_VISION_MODEL?.trim() || 'gpt-4o'
  const openai = getOpenAI()

  const parts: VisionContentPart[] = [
    {
      type: 'text',
      text:
        'These are screenshots of SMS or chat text about booking a cleaning service. ' +
        'Extract the same JSON fields as described in the system message. Return JSON only.',
    },
  ]
  for (const url of imageUrls) {
    parts.push({ type: 'image_url', image_url: { url, detail: 'auto' } })
  }

  const res = await openai.chat.completions.create({
    model,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: buildAppointmentExtractionSystemPrompt() },
      { role: 'user', content: parts as any },
    ],
    temperature: 0.2,
  })

  const content = res.choices[0]?.message?.content
  if (!content) throw new Error('OpenAI returned empty content')
  return parseJsonObject(content)
}

type InlineImage = { mimeType: string; base64: string }

export async function extractAppointmentFromInlineImages(images: InlineImage[]): Promise<RawAiExtraction> {
  const model = process.env.OPENAI_VISION_MODEL?.trim() || 'gpt-4o'
  const openai = getOpenAI()

  const parts: VisionContentPart[] = [
    {
      type: 'text',
      text:
        'These are screenshots of SMS or chat text about booking a cleaning service. ' +
        'Extract the same JSON fields as described in the system message. Return JSON only.',
    },
  ]
  for (const img of images) {
    const url = `data:${img.mimeType};base64,${img.base64}`
    parts.push({ type: 'image_url', image_url: { url, detail: 'auto' } })
  }

  const res = await openai.chat.completions.create({
    model,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: buildAppointmentExtractionSystemPrompt() },
      { role: 'user', content: parts as any },
    ],
    temperature: 0.2,
  })

  const content = res.choices[0]?.message?.content
  if (!content) throw new Error('OpenAI returned empty content')
  return parseJsonObject(content)
}

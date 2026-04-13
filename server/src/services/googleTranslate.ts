/**
 * Google Cloud Translation API v2 (REST)
 * @see https://cloud.google.com/translate/docs/reference/rest/v2/translate
 */

function translationApiKey(): string | null {
  return process.env.GOOGLE_TRANSLATE_API_KEY || process.env.GOOGLE_API_KEY || null
}

export function isTranslationConfigured(): boolean {
  return Boolean(translationApiKey())
}

export async function translateEnToPt(text: string): Promise<string> {
  const key = translationApiKey()
  if (!key) {
    throw new Error('Translation is not configured (set GOOGLE_API_KEY or GOOGLE_TRANSLATE_API_KEY)')
  }
  const trimmed = text.trim()
  if (!trimmed) {
    throw new Error('Nothing to translate')
  }

  const url = `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(key)}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      q: trimmed,
      source: 'en',
      target: 'pt',
      format: 'text',
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Translation API error ${res.status}: ${errText.slice(0, 500)}`)
  }

  const data = (await res.json()) as {
    data?: { translations?: Array<{ translatedText?: string }> }
  }
  const out = data.data?.translations?.[0]?.translatedText
  if (typeof out !== 'string') {
    throw new Error('Invalid translation response')
  }
  return out
}

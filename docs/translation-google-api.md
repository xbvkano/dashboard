# Google Cloud Translation API usage (EN → PT)

This dashboard translates SMS message text **server-side** when a user chooses **Translate to Portuguese** on a message. The browser never receives your Google API key.

## Which Google product

- **Cloud Translation API**, **v2** REST endpoint:  
  `POST https://translation.googleapis.com/language/translate/v2?key=YOUR_API_KEY`
- Request JSON body includes `q` (source text), `source: "en"`, `target: "pt"`, `format: "text"`.
- Implementation: [`server/src/services/googleTranslate.ts`](../server/src/services/googleTranslate.ts).

## Environment variables

| Variable | Purpose |
|----------|---------|
| `GOOGLE_API_KEY` | Used for Translation **if** set and the key’s GCP project has **Cloud Translation API** enabled. |
| `GOOGLE_TRANSLATE_API_KEY` | Optional override. If set, it is used **instead of** `GOOGLE_API_KEY` for Translation only (least privilege). |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | **OAuth login only** — not used for Translation. |

## When Google bills you

- **One HTTP request** to the Translation API per successful **Translate to Portuguese** action (opening the message actions menu does **not** call Google).
- Billing is typically based on **characters** in the source text (`q`). See [Cloud Translation pricing](https://cloud.google.com/translate/pricing) for current rates and any free tier.

**Rough monthly estimate:**

```text
billable_characters ≈ (number of translate actions) × (average characters per message body)
```

If the UI caches a translation in-session and the user opens translate again without a new request, that would reduce repeat charges (implementation-dependent).

## GCP console (one-time)

In the same Google Cloud project as your API key:

1. Enable **Cloud Translation API** (APIs & Services → Library).
2. Ensure API key restrictions allow the Translation API (or use a dedicated key via `GOOGLE_TRANSLATE_API_KEY`).

## Security

The API key is **only** read on the server from environment variables and passed as the `key` query parameter to Google’s HTTPS endpoint. It is not exposed to the client bundle.

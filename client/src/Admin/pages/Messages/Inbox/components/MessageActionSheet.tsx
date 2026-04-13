import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { postTranslateMessage } from '../messagingApi'
import type { ThreadMessage } from '../types'

type Props = {
  message: ThreadMessage
  onClose: () => void
  /** When translation succeeds, bubble shows this in the thread */
  onTranslationApplied?: (text: string) => void
}

async function downloadMediaUrl(url: string, fileName: string): Promise<void> {
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) throw new Error('fetch failed')
    const blob = await res.blob()
    const u = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = u
    a.download = fileName || 'attachment'
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(u)
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

function IconTranslate({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
      />
    </svg>
  )
}

function IconCopy({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
      />
    </svg>
  )
}

function IconDownload({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
      />
    </svg>
  )
}

export default function MessageActionSheet({
  message,
  onClose,
  onTranslationApplied,
}: Props) {
  const [translateError, setTranslateError] = useState<string | null>(null)
  const [translating, setTranslating] = useState(false)
  const [copied, setCopied] = useState(false)

  const hasText = message.body.trim().length > 0
  const imgs = message.media?.filter((m) => m.publicUrl) ?? []

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const runTranslate = async () => {
    setTranslating(true)
    setTranslateError(null)
    try {
      const { translatedText } = await postTranslateMessage(message.body)
      onTranslationApplied?.(translatedText)
      onClose()
    } catch (e) {
      setTranslateError(e instanceof Error ? e.message : 'Translation failed')
    } finally {
      setTranslating(false)
    }
  }

  const copyOriginal = async () => {
    try {
      await navigator.clipboard.writeText(message.body)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  const sheet = (
    <div
      className="fixed inset-0 z-[300] flex items-end md:items-center justify-center md:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="message-actions-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/40 md:bg-black/30"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className="relative flex w-full max-w-lg flex-col max-h-[92dvh] md:max-h-[85vh] md:max-w-md rounded-t-2xl md:rounded-2xl bg-white shadow-2xl border border-slate-200/90 min-h-0"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      >
        <h2 id="message-actions-title" className="sr-only">
          Message actions
        </h2>
        <div className="flex justify-center pt-2 md:hidden shrink-0">
          <span className="w-10 h-1 rounded-full bg-slate-200" />
        </div>

        <div className="shrink-0 px-4 pt-3 pb-2 border-b border-slate-100 min-h-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Message</p>
          {hasText ? (
            <div
              className="max-h-[min(40vh,280px)] md:max-h-[min(48vh,400px)] overflow-y-auto overscroll-y-contain rounded-xl bg-slate-50 border border-slate-200/80 px-3 py-3 text-left [touch-action:pan-y]"
              tabIndex={0}
              role="region"
              aria-label="Message text"
            >
              <p className="text-[15px] text-slate-900 leading-snug whitespace-pre-wrap break-words">
                {message.body}
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-500 italic">No text in this message (photo only).</p>
          )}
        </div>

        <div className="shrink-0 p-4 space-y-2.5">
          {hasText && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={runTranslate}
                  disabled={translating}
                  className="inline-flex items-center justify-center gap-2 min-h-[48px] rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm px-4 shadow-sm"
                >
                  <IconTranslate className="w-5 h-5 shrink-0" />
                  {translating ? 'Translating…' : 'Translate to Portuguese'}
                </button>
                <button
                  type="button"
                  onClick={() => void copyOriginal()}
                  className="inline-flex items-center justify-center gap-2 min-h-[48px] rounded-xl border-2 border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-sm px-4 shadow-sm"
                >
                  <IconCopy className="w-5 h-5 shrink-0 text-slate-600" />
                  {copied ? 'Copied!' : 'Copy original'}
                </button>
              </div>
              {translateError && (
                <p className="text-sm text-red-600 rounded-lg bg-red-50 border border-red-100 px-3 py-2">
                  {translateError}
                </p>
              )}
            </>
          )}
          {imgs.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => downloadMediaUrl(m.publicUrl!, m.fileName ?? `image-${m.id}.jpg`)}
              className="w-full inline-flex items-center justify-center gap-2 min-h-[48px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm px-4 shadow-sm"
            >
              <IconDownload className="w-5 h-5 shrink-0" />
              Download image{m.fileName ? ` (${m.fileName})` : ''}
            </button>
          ))}
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[48px] rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 font-medium text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(sheet, document.body) : null
}

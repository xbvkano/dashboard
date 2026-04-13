import { useEffect, useState } from 'react'
import { formatMessageTime } from '../formatTime'
import { outboundBubbleStyle } from '../bubbleColor'
import type { ThreadMessage } from '../types'
import MessageActionSheet from './MessageActionSheet'

type Props = {
  message: ThreadMessage
  /** Called when an inline image finishes loading (height changes — parent should scroll if pinned) */
  onMediaLoad?: () => void
}

function isOutboundDirection(direction: string): boolean {
  return String(direction).toUpperCase() === 'OUTBOUND'
}

export default function MessageBubble({ message, onMediaLoad }: Props) {
  const outbound = isOutboundDirection(message.direction)
  const hasText = message.body.trim().length > 0
  const imgs = message.media ?? []
  const [imgFailed, setImgFailed] = useState<Record<number, boolean>>({})
  const [actionsOpen, setActionsOpen] = useState(false)
  const [translatedText, setTranslatedText] = useState<string | null>(null)
  const [viewingOriginal, setViewingOriginal] = useState(false)

  useEffect(() => {
    setTranslatedText(null)
    setViewingOriginal(false)
  }, [message.id])

  const displayBody =
    translatedText != null && !viewingOriginal ? translatedText : message.body

  const customOutbound =
    outbound &&
    message.senderBubbleColor &&
    /^#[0-9A-Fa-f]{6}$/.test(message.senderBubbleColor)
  const obStyle = outbound ? outboundBubbleStyle(message.senderBubbleColor) : null

  return (
    <div className={`flex ${outbound ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`flex max-w-[min(85%,20rem)] flex-col ${outbound ? 'items-end' : 'items-start'}`}
      >
        <button
          type="button"
          onClick={() => setActionsOpen(true)}
          className={`w-full rounded-2xl px-3 py-2 shadow-sm text-left cursor-pointer active:opacity-90 ${
            outbound
              ? customOutbound
                ? 'rounded-br-md'
                : 'bg-blue-500 text-white rounded-br-md'
              : 'bg-white text-slate-900 border border-slate-200/80 rounded-bl-md'
          }`}
          style={
            outbound && customOutbound && obStyle
              ? {
                  backgroundColor: obStyle.backgroundColor,
                  color: obStyle.color,
                }
              : undefined
          }
        >
          {imgs.length > 0 && (
            <div className="space-y-1.5 mb-1.5">
              {imgs.map((m) =>
                m.publicUrl ? (
                  <div
                    key={m.id}
                    className={`rounded-lg overflow-hidden border bg-black/10 ${
                      outbound ? 'border-white/20' : 'border-slate-200'
                    }`}
                  >
                    {imgFailed[m.id] ? (
                      <div className="px-2 py-3 text-xs text-center leading-snug">
                        <p
                          className={
                            outbound ? (customOutbound ? 'text-slate-700' : 'text-blue-100') : 'text-slate-600'
                          }
                        >
                          Image blocked or unavailable. Allow public read on your Supabase Storage bucket so
                          Twilio and this app can load the file.
                        </p>
                        <a
                          href={m.publicUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`mt-1 inline-block underline ${
                            outbound ? (customOutbound ? 'text-blue-700' : 'text-white') : 'text-blue-600'
                          }`}
                        >
                          Open link
                        </a>
                      </div>
                    ) : (
                      <span className="block">
                        <img
                          src={m.publicUrl}
                          alt={m.fileName ?? 'Attachment'}
                          className="max-h-48 w-full object-cover pointer-events-none"
                          loading="eager"
                          decoding="async"
                          referrerPolicy="no-referrer"
                          onLoad={() => onMediaLoad?.()}
                          onError={() => {
                            setImgFailed((prev) => ({ ...prev, [m.id]: true }))
                            onMediaLoad?.()
                          }}
                        />
                      </span>
                    )}
                  </div>
                ) : null
              )}
            </div>
          )}
          {hasText && (
            <p className="text-[15px] leading-snug whitespace-pre-wrap break-words">{displayBody}</p>
          )}
          {!hasText && imgs.length > 0 && <span className="sr-only">Photo message</span>}
          <p
            className={`text-[11px] mt-1 tabular-nums ${
              outbound
                ? customOutbound && obStyle
                  ? obStyle.timeClass
                  : 'text-blue-100'
                : 'text-slate-500'
            }`}
          >
            {formatMessageTime(message.createdAt)}
          </p>
        </button>
        {translatedText != null && hasText && (
          <button
            type="button"
            onClick={() => setViewingOriginal((v) => !v)}
            className={`mt-1 text-[11px] font-semibold underline underline-offset-2 ${
              outbound
                ? 'text-blue-700 hover:text-blue-800'
                : 'text-indigo-700 hover:text-indigo-900'
            }`}
          >
            {viewingOriginal ? 'Show translation' : 'Show original'}
          </button>
        )}
      </div>
      {actionsOpen && (
        <MessageActionSheet
          message={message}
          onClose={() => setActionsOpen(false)}
          onTranslationApplied={(text) => {
            setTranslatedText(text)
            setViewingOriginal(false)
          }}
        />
      )}
    </div>
  )
}

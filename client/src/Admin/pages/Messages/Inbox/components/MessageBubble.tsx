import { useState } from 'react'
import { formatMessageTime } from '../formatTime'
import type { ThreadMessage } from '../types'

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

  return (
    <div className={`flex ${outbound ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[min(85%,20rem)] rounded-2xl px-3 py-2 shadow-sm ${
          outbound
            ? 'bg-blue-500 text-white rounded-br-md'
            : 'bg-white text-slate-900 border border-slate-200/80 rounded-bl-md'
        }`}
      >
        {imgs.length > 0 && (
          <div className="space-y-1.5 mb-1.5">
            {imgs.map((m) =>
              m.publicUrl ? (
                <div key={m.id} className="rounded-lg overflow-hidden border border-white/20 bg-black/10">
                  {imgFailed[m.id] ? (
                    <div className="px-2 py-3 text-xs text-center leading-snug">
                      <p className={outbound ? 'text-blue-100' : 'text-slate-600'}>
                        Image blocked or unavailable. Allow public read on your Supabase Storage bucket so
                        Twilio and this app can load the file.
                      </p>
                      <a
                        href={m.publicUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`mt-1 inline-block underline ${outbound ? 'text-white' : 'text-blue-600'}`}
                      >
                        Open link
                      </a>
                    </div>
                  ) : (
                    <a href={m.publicUrl} target="_blank" rel="noopener noreferrer" className="block">
                      <img
                        src={m.publicUrl}
                        alt={m.fileName ?? 'Attachment'}
                        className="max-h-48 w-full object-cover"
                        loading="eager"
                        decoding="async"
                        referrerPolicy="no-referrer"
                        onLoad={() => onMediaLoad?.()}
                        onError={() => {
                          setImgFailed((prev) => ({ ...prev, [m.id]: true }))
                          onMediaLoad?.()
                        }}
                      />
                    </a>
                  )}
                </div>
              ) : null
            )}
          </div>
        )}
        {hasText && (
          <p className="text-[15px] leading-snug whitespace-pre-wrap break-words">{message.body}</p>
        )}
        {!hasText && imgs.length > 0 && (
          <span className="sr-only">Photo message</span>
        )}
        <p
          className={`text-[11px] mt-1 tabular-nums ${
            outbound ? 'text-blue-100' : 'text-slate-500'
          }`}
        >
          {formatMessageTime(message.createdAt)}
        </p>
      </div>
    </div>
  )
}

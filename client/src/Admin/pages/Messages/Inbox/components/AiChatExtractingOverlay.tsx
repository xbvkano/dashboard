import { useEffect } from 'react'

type Props = {
  open: boolean
}

/**
 * Full-screen overlay while AI reads the thread for booking extraction.
 * Covers the whole viewport (blocks clicks); body scroll + tab-close warning.
 * Note: useBlocker is not used — it requires a data router and throws with BrowserRouter.
 */
export default function AiChatExtractingOverlay({ open }: Props) {
  useEffect(() => {
    if (!open) return
    const prevHtml = document.documentElement.style.overflow
    const prevBody = document.body.style.overflow
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    return () => {
      document.documentElement.style.overflow = prevHtml
      document.body.style.overflow = prevBody
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[250] flex flex-col items-center justify-center p-6"
      role="alertdialog"
      aria-modal="true"
      aria-busy="true"
      aria-labelledby="ai-extract-title"
      aria-describedby="ai-extract-desc"
    >
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-md" aria-hidden />

      {/* Soft animated blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-violet-500/25 blur-3xl motion-safe:animate-[pulse_4s_ease-in-out_infinite]" />
        <div className="absolute -bottom-28 -right-20 h-80 w-80 rounded-full bg-fuchsia-500/20 blur-3xl motion-safe:animate-[pulse_4s_ease-in-out_infinite] [animation-delay:1.2s]" />
        <div className="absolute left-1/2 top-1/3 h-48 w-48 -translate-x-1/2 rounded-full bg-sky-400/15 blur-2xl motion-safe:animate-[pulse_3s_ease-in-out_infinite] [animation-delay:0.6s]" />
      </div>

      <div className="relative w-full max-w-[min(100%,20rem)]">
        {/* Spinning ring + sparkles */}
        <div className="relative mx-auto mb-6 flex h-28 w-28 items-center justify-center">
          <div
            className="absolute inset-0 rounded-full border-2 border-violet-300/40 border-t-violet-400 motion-safe:animate-spin"
            style={{ animationDuration: '1.1s' }}
          />
          <div
            className="absolute inset-2 rounded-full border border-fuchsia-300/30 border-b-fuchsia-400/80 motion-safe:animate-spin"
            style={{ animationDuration: '1.6s', animationDirection: 'reverse' }}
          />
          <span
            className="relative text-4xl motion-safe:animate-[bounce_2.2s_ease-in-out_infinite]"
            aria-hidden
          >
            ✨
          </span>
        </div>

        <div className="rounded-3xl bg-white/95 px-6 py-7 text-center shadow-2xl ring-1 ring-white/60">
          <h2
            id="ai-extract-title"
            className="text-lg font-semibold tracking-tight text-slate-900"
          >
            Reading the chat…
          </h2>
          <p id="ai-extract-desc" className="mt-2 text-sm leading-relaxed text-slate-600">
            Our assistant is going through the messages and pulling out booking details. This can take a few
            moments — hang tight!
          </p>

          {/* Typing-style dots */}
          <div className="mt-6 flex items-center justify-center gap-1.5" aria-hidden>
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className="h-2 w-2 rounded-full bg-violet-500 motion-safe:animate-[bounce_1s_ease-in-out_infinite]"
                style={{
                  animationDelay: `${i * 0.12}s`,
                  animationDuration: '0.9s',
                }}
              />
            ))}
          </div>

          <p className="mt-5 text-xs text-slate-400">Please don’t close or leave this page</p>
        </div>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

function useEscapeClose(onClose: () => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled, onClose])
}

interface LeadMessageModalProps {
  open: boolean
  onClose: () => void
  /** Shown when modal opens; edits are not persisted after close. */
  defaultText: string
  title?: string
}

export default function LeadMessageModal({ open, onClose, defaultText, title = 'Default message' }: LeadMessageModalProps) {
  const [text, setText] = useState(defaultText)
  useEscapeClose(onClose, open)

  useEffect(() => {
    if (open) setText(defaultText)
  }, [open, defaultText])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
  }

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-slate-900/60 backdrop-blur-sm md:items-center md:justify-center md:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lead-message-modal-title"
      onClick={onClose}
    >
      <div
        className="flex flex-col flex-1 min-h-0 w-full max-w-lg mx-auto bg-white rounded-t-2xl md:rounded-2xl md:shadow-xl md:flex-none md:max-h-[85vh] overflow-hidden pt-[max(0.75rem,env(safe-area-inset-top))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-4 pb-3 border-b border-slate-200 shrink-0">
          <h2 id="lead-message-modal-title" className="text-lg font-semibold text-slate-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 active:bg-slate-200 text-sm font-medium"
          >
            Close
          </button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col px-4 py-3">
          <label htmlFor="lead-message-textarea" className="sr-only">
            Message text
          </label>
          <textarea
            id="lead-message-textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="flex-1 min-h-[200px] w-full resize-y rounded-xl border border-slate-300 px-3 py-3 text-base leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 focus:outline-none"
            spellCheck
          />
        </div>

        <div className="px-4 pt-2 border-t border-slate-200 shrink-0 flex gap-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={handleCopy}
            className="flex-1 min-h-[48px] rounded-xl bg-blue-600 text-white text-base font-semibold active:bg-blue-700"
          >
            Copy
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

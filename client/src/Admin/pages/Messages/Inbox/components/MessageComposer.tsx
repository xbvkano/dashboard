import { useCallback, useEffect, useId, useRef, useState } from 'react'
import ComposerAttachmentPanel, { type AttachmentPanelView } from './ComposerAttachmentPanel'
import MessageBankToolPanel from '../../MessageBank/MessageBankToolPanel'
import MessageBankUseModal from '../../MessageBank/MessageBankUseModal'
import type { MessageBankTemplateDto } from '../../MessageBank/messageBankApi'

type Props = {
  onSend: (text: string, files?: File[]) => void | Promise<void>
  conversationId?: number | null
  messageBankInitialValues?: Record<string, string>
}

type PendingImage = { file: File; url: string }

type PanelState = 'closed' | AttachmentPanelView

/** Half of the visual viewport — stable on mobile URL bar show/hide when using dvh */
function maxComposerTextareaHeightPx(): number {
  if (typeof window === 'undefined') return 400
  const v = window.visualViewport
  const h = v?.height ?? window.innerHeight
  return Math.max(120, Math.floor(h * 0.5))
}

export default function MessageComposer({
  onSend,
  conversationId,
  messageBankInitialValues = {},
}: Props) {
  const [text, setText] = useState('')
  const [pending, setPending] = useState<PendingImage[]>([])
  const [sending, setSending] = useState(false)
  const [panelState, setPanelState] = useState<PanelState>('closed')
  const [messageBankTemplate, setMessageBankTemplate] = useState<MessageBankTemplateDto | null>(null)
  /** Sync guard — state updates are async, so rapid clicks can fire submit twice */
  const sendInFlightRef = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const selectionRef = useRef({ start: 0, end: 0 })
  const galleryId = useId()

  const syncTextareaHeight = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    const maxH = maxComposerTextareaHeightPx()
    const minH = 40
    el.style.height = 'auto'
    const contentH = el.scrollHeight
    const next = Math.min(Math.max(contentH, minH), maxH)
    el.style.height = `${next}px`
    el.style.overflowY = contentH > maxH ? 'auto' : 'hidden'
  }, [])

  const closePanel = useCallback(() => {
    setPanelState('closed')
  }, [])

  const togglePanel = useCallback(() => {
    setPanelState((prev) => (prev === 'closed' ? 'toolbox' : 'closed'))
  }, [])

  const updateSelection = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    selectionRef.current = { start: el.selectionStart ?? 0, end: el.selectionEnd ?? 0 }
  }, [])

  const insertAtCursor = useCallback(
    (insertion: string) => {
      const { start, end } = selectionRef.current
      setText((prev) => {
        const next = prev.slice(0, start) + insertion + prev.slice(end)
        const cursor = start + insertion.length
        selectionRef.current = { start: cursor, end: cursor }
        requestAnimationFrame(() => {
          const el = textareaRef.current
          if (!el) return
          el.focus()
          el.setSelectionRange(cursor, cursor)
          syncTextareaHeight()
        })
        return next
      })
    },
    [syncTextareaHeight],
  )

  useEffect(() => {
    syncTextareaHeight()
  }, [text, syncTextareaHeight])

  useEffect(() => {
    const onResize = () => syncTextareaHeight()
    window.addEventListener('resize', onResize)
    window.visualViewport?.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      window.visualViewport?.removeEventListener('resize', onResize)
    }
  }, [syncTextareaHeight])

  useEffect(() => {
    if (panelState === 'closed') return

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node
      if (panelRef.current?.contains(target)) return
      if (toggleRef.current?.contains(target)) return
      closePanel()
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
    }
  }, [panelState, closePanel])

  const addFiles = (list: FileList | null) => {
    if (!list?.length) return
    const additions: PendingImage[] = []
    for (let i = 0; i < list.length; i++) {
      const f = list[i]
      if (!f.type.startsWith('image/')) continue
      additions.push({ file: f, url: URL.createObjectURL(f) })
    }
    if (additions.length === 0) return
    setPending((prev) => {
      const merged = [...prev, ...additions]
      if (merged.length <= 10) return merged
      const drop = merged.length - 10
      for (let j = 0; j < drop; j++) {
        URL.revokeObjectURL(merged[j].url)
      }
      return merged.slice(-10)
    })
    if (inputRef.current) inputRef.current.value = ''
  }

  const removeAt = (index: number) => {
    setPending((prev) => {
      const row = prev[index]
      if (row) URL.revokeObjectURL(row.url)
      return prev.filter((_, i) => i !== index)
    })
  }

  const submit = async () => {
    if (sendInFlightRef.current) return
    const t = text.trim()
    const files = pending.map((p) => p.file)
    const hasMedia = files.length > 0
    if (!t && !hasMedia) return
    sendInFlightRef.current = true
    setSending(true)
    try {
      await onSend(t, hasMedia ? files : undefined)
      setText('')
      setPending((prev) => {
        prev.forEach((p) => URL.revokeObjectURL(p.url))
        return []
      })
      closePanel()
      requestAnimationFrame(() => syncTextareaHeight())
    } finally {
      sendInFlightRef.current = false
      setSending(false)
    }
  }

  const canSend = Boolean(text.trim() || pending.length > 0)
  const panelOpen = panelState !== 'closed'

  return (
    <div className="shrink-0 border-t border-slate-200 bg-white/95 backdrop-blur-md px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      {pending.length > 0 && (
        <div className="max-w-4xl mx-auto mb-2 flex flex-wrap gap-2 px-0.5">
          {pending.map((row, i) => (
            <div key={`${galleryId}-${i}`} className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shrink-0">
              <img src={row.url} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="absolute top-0.5 right-0.5 w-6 h-6 rounded-full bg-black/55 text-white text-xs flex items-center justify-center"
                aria-label="Remove image"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2 max-w-4xl mx-auto">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          aria-label="Choose photos"
          onChange={(e) => addFiles(e.target.files)}
        />
        <button
          ref={toggleRef}
          type="button"
          onClick={togglePanel}
          disabled={sending}
          aria-expanded={panelOpen}
          aria-label="Open attachments"
          className={`shrink-0 mb-0.5 w-10 h-10 rounded-full border border-slate-300 bg-white text-slate-600 flex items-center justify-center hover:bg-slate-50 active:scale-95 transition-transform disabled:opacity-40 disabled:pointer-events-none ${
            panelOpen ? 'bg-slate-50' : ''
          }`}
        >
          <svg
            className={`w-5 h-5 transition-transform ${panelOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onSelect={updateSelection}
          onClick={updateSelection}
          onKeyUp={updateSelection}
          placeholder="Message"
          rows={1}
          readOnly={sending}
          aria-disabled={sending}
          className="flex-1 min-h-[40px] max-h-[50dvh] resize-none rounded-2xl border border-slate-300 bg-white px-3 py-2.5 text-[16px] md:text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400/50 box-border disabled:opacity-70"
        />
        <button
          type="button"
          onClick={(e) => {
            if (sendInFlightRef.current) {
              e.preventDefault()
              e.stopPropagation()
              return
            }
            void submit()
          }}
          disabled={!canSend || sending}
          tabIndex={sending ? -1 : undefined}
          className={`shrink-0 mb-0.5 w-10 h-10 rounded-full flex items-center justify-center transition-transform ${
            sending
              ? 'bg-blue-500 text-white cursor-wait pointer-events-none opacity-100'
              : 'bg-blue-500 text-white hover:bg-blue-600 active:scale-95 disabled:opacity-40 disabled:pointer-events-none'
          }`}
          aria-label={sending ? 'Sending message' : 'Send'}
          aria-busy={sending}
        >
          {sending ? (
            <span
              className="w-5 h-5 rounded-full border-2 border-white/35 border-t-white motion-safe:animate-spin"
              aria-hidden
            />
          ) : (
            <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          )}
        </button>
      </div>
      {panelOpen && (
        <div ref={panelRef} className="max-w-4xl mx-auto mt-2 rounded-xl border border-slate-200 bg-white px-2 py-2">
          {panelState === 'message-bank' && conversationId != null ? (
            <MessageBankToolPanel
              conversationId={conversationId}
              onSelectTemplate={(t) => {
                setMessageBankTemplate(t)
                setPanelState('closed')
              }}
              onBack={() => setPanelState('toolbox')}
            />
          ) : (
            <ComposerAttachmentPanel
              view={panelState === 'closed' ? 'toolbox' : panelState}
              onPickImage={() => inputRef.current?.click()}
              onOpenEmoji={() => setPanelState('emoji')}
              onOpenMessageBank={() => setPanelState('message-bank')}
              onEmojiBack={() => setPanelState('toolbox')}
              onPickEmoji={insertAtCursor}
            />
          )}
        </div>
      )}
      {conversationId != null && (
        <MessageBankUseModal
          open={messageBankTemplate != null}
          template={messageBankTemplate}
          conversationId={conversationId}
          initialValues={messageBankInitialValues}
          onClose={() => setMessageBankTemplate(null)}
          onSend={async (msg) => {
            await onSend(msg)
            setMessageBankTemplate(null)
          }}
        />
      )}
    </div>
  )
}

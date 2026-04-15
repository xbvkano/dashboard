import { useCallback, useEffect, useId, useRef, useState } from 'react'

type Props = {
  onSend: (text: string, files?: File[]) => void | Promise<void>
}

type PendingImage = { file: File; url: string }

/** Half of the visual viewport — stable on mobile URL bar show/hide when using dvh */
function maxComposerTextareaHeightPx(): number {
  if (typeof window === 'undefined') return 400
  const v = window.visualViewport
  const h = v?.height ?? window.innerHeight
  return Math.max(120, Math.floor(h * 0.5))
}

export default function MessageComposer({ onSend }: Props) {
  const [text, setText] = useState('')
  const [pending, setPending] = useState<PendingImage[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
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
    const t = text.trim()
    const files = pending.map((p) => p.file)
    const hasMedia = files.length > 0
    if (!t && !hasMedia) return
    await onSend(t, hasMedia ? files : undefined)
    setText('')
    setPending((prev) => {
      prev.forEach((p) => URL.revokeObjectURL(p.url))
      return []
    })
    requestAnimationFrame(() => syncTextareaHeight())
  }

  const canSend = Boolean(text.trim() || pending.length > 0)

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
          type="button"
          onClick={() => inputRef.current?.click()}
          className="shrink-0 mb-0.5 w-10 h-10 rounded-full border border-slate-300 bg-white text-slate-600 flex items-center justify-center hover:bg-slate-50 active:scale-95 transition-transform"
          aria-label="Add photo"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </button>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void submit()
            }
          }}
          placeholder="Message"
          rows={1}
          className="flex-1 min-h-[40px] max-h-[50dvh] resize-none rounded-2xl border border-slate-300 bg-white px-3 py-2.5 text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400/50 box-border"
        />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!canSend}
          className="shrink-0 mb-0.5 w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center disabled:opacity-40 disabled:pointer-events-none hover:bg-blue-600 active:scale-95 transition-transform"
          aria-label="Send"
        >
          <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </div>
    </div>
  )
}

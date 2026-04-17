import { useEffect } from 'react'

type Props = {
  open: boolean
  details?: {
    encoding?: string
    segments?: number
    mediaCount?: number
    maxMediaBytes?: number
    mediaTotalBytes?: number
  } | null
  onClose: () => void
}

function formatKb(bytes?: number): string | null {
  if (bytes == null || !Number.isFinite(bytes)) return null
  return `${Math.round(bytes / 1024)} KB`
}

export default function TwilioContentSizeExceededModal({ open, details, onClose }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const maxKb = formatKb(details?.maxMediaBytes ?? undefined)
  const totalKb = formatKb(details?.mediaTotalBytes ?? undefined)

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 p-5"
        role="dialog"
        aria-modal="true"
        aria-label="Message too large"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-slate-900">Message too large to deliver</h3>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              The carrier rejected this message because it exceeds size limits (Twilio error 30019).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-2 rounded-full hover:bg-slate-100 active:bg-slate-200 text-slate-600"
            aria-label="Close"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7A1 1 0 0 0 5.7 7.11L10.59 12l-4.9 4.89a1 1 0 1 0 1.41 1.42L12 13.41l4.89 4.9a1 1 0 0 0 1.42-1.41L13.41 12l4.9-4.89a1 1 0 0 0-.01-1.4z" />
            </svg>
          </button>
        </div>

        <div className="mt-3 text-sm text-slate-700">
          <ul className="list-disc pl-5 space-y-1">
            <li>Try shortening the text (especially if it includes emojis/special characters).</li>
            <li>Try removing attachments or sending fewer images.</li>
            <li>If the images are large, resize/compress them and retry.</li>
          </ul>
        </div>

        {(details?.segments != null ||
          details?.encoding ||
          details?.mediaCount != null ||
          maxKb ||
          totalKb) && (
          <div className="mt-4 rounded-xl bg-slate-50 ring-1 ring-slate-200 p-3">
            <p className="text-[11px] font-semibold text-slate-700">Details</p>
            <div className="mt-1 text-[12px] text-slate-700 space-y-0.5">
              {details?.encoding && (
                <div>
                  <span className="font-medium">Encoding:</span> {details.encoding}
                </div>
              )}
              {details?.segments != null && (
                <div>
                  <span className="font-medium">Text segments:</span> {details.segments}
                </div>
              )}
              {details?.mediaCount != null && (
                <div>
                  <span className="font-medium">Attachments:</span> {details.mediaCount}
                </div>
              )}
              {maxKb && (
                <div>
                  <span className="font-medium">Largest attachment:</span> {maxKb}
                </div>
              )}
              {totalKb && (
                <div>
                  <span className="font-medium">Total attachment size:</span> {totalKb}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  )
}


import { useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { PHOTO_VIEWER_Z } from '../../modalLayers'
import { downloadMediaUrl } from './downloadMediaUrl'

export type PhotoViewerItem = {
  url: string
  fileName?: string | null
}

type Props = {
  photos: PhotoViewerItem[]
  index: number
  onClose: () => void
  onIndexChange: (index: number) => void
}

function IconClose({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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

function IconChevron({ className, dir }: { className?: string; dir: 'left' | 'right' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      {dir === 'left' ? (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      )}
    </svg>
  )
}

const toolbarBtn =
  'flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 active:bg-white/30'

export default function PhotoViewer({ photos, index, onClose, onIndexChange }: Props) {
  const count = photos.length
  const safeIndex = count === 0 ? 0 : Math.min(Math.max(index, 0), count - 1)
  const current = photos[safeIndex]
  const hasNav = count > 1

  const go = useCallback(
    (delta: number) => {
      if (count <= 1) return
      onIndexChange((safeIndex + delta + count) % count)
    },
    [count, onIndexChange, safeIndex],
  )

  useEffect(() => {
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        go(-1)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        go(1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, onClose])

  if (!current || typeof document === 'undefined') return null

  const label = hasNav ? `Photo ${safeIndex + 1} of ${count}` : 'Photo'
  const downloadName = current.fileName?.trim() || `photo-${safeIndex + 1}.jpg`

  const overlay = (
    <div
      className="fixed inset-0 flex flex-col bg-black/90"
      style={{ zIndex: PHOTO_VIEWER_Z }}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={onClose}
      onWheel={(e) => e.preventDefault()}
    >
      <div
        className="relative z-10 flex shrink-0 items-center justify-between gap-3 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="min-w-[4rem] px-1 text-sm font-medium tabular-nums text-white/90">
          {hasNav ? `${safeIndex + 1} / ${count}` : '\u00a0'}
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={toolbarBtn}
            aria-label="Download photo"
            onClick={() => void downloadMediaUrl(current.url, downloadName)}
          >
            <IconDownload className="h-5 w-5" />
          </button>
          <button type="button" className={toolbarBtn} aria-label="Close" onClick={onClose}>
            <IconClose className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-14">
        {hasNav && (
          <button
            type="button"
            className={`${toolbarBtn} absolute left-2 top-1/2 z-10 -translate-y-1/2 sm:left-3`}
            aria-label="Previous photo"
            onClick={(e) => {
              e.stopPropagation()
              go(-1)
            }}
          >
            <IconChevron className="h-6 w-6" dir="left" />
          </button>
        )}
        <img
          src={current.url}
          alt={current.fileName ?? label}
          className="max-h-full max-w-full select-none object-contain"
          draggable={false}
          onClick={(e) => e.stopPropagation()}
        />
        {hasNav && (
          <button
            type="button"
            className={`${toolbarBtn} absolute right-2 top-1/2 z-10 -translate-y-1/2 sm:right-3`}
            aria-label="Next photo"
            onClick={(e) => {
              e.stopPropagation()
              go(1)
            }}
          >
            <IconChevron className="h-6 w-6" dir="right" />
          </button>
        )}
      </div>
    </div>
  )

  return createPortal(overlay, document.body)
}

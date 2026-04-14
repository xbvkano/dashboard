import { useEffect, useRef, useState } from 'react'

type Props = {
  conversationId: number
  onEditContact: () => void
  onBookAppointment: () => void
  onGenerateAppointment: () => void
  onDeleteContact?: () => void | Promise<void>
  extractAppointmentBusy?: boolean
  /** Linked CRM client id — enables "View client". */
  linkedClientId?: number | null
  onViewClient?: () => void
  /** From conversation detail — when set, show archive / restore. */
  conversationStatus?: 'OPEN' | 'ARCHIVED' | string
  onArchiveToggle?: () => void | Promise<void>
  archiveBusy?: boolean
}

export default function ChatActionsMenu({
  conversationId,
  onEditContact,
  onBookAppointment,
  onGenerateAppointment,
  onDeleteContact,
  extractAppointmentBusy,
  linkedClientId,
  onViewClient,
  conversationStatus,
  onArchiveToggle,
  archiveBusy,
}: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="p-2 rounded-full text-slate-600 hover:bg-slate-200/80 active:bg-slate-300/80"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Chat actions"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
        </svg>
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 py-1 min-w-[12rem] bg-white rounded-lg shadow-lg border border-slate-200 z-[120] text-sm"
          role="menu"
        >
          {linkedClientId != null && onViewClient && (
            <button
              type="button"
              role="menuitem"
              className="w-full text-left px-4 py-2.5 hover:bg-slate-50 text-slate-800"
              onClick={() => {
                setOpen(false)
                onViewClient()
              }}
            >
              View client
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            className="w-full text-left px-4 py-2.5 hover:bg-slate-50 text-slate-800"
            onClick={() => {
              setOpen(false)
              onEditContact()
            }}
          >
            Edit contact
          </button>
          <button
            type="button"
            role="menuitem"
            className="w-full text-left px-4 py-2.5 hover:bg-slate-50 text-slate-800"
            onClick={() => {
              setOpen(false)
              onBookAppointment()
            }}
          >
            Book Appointment
          </button>
          <button
            type="button"
            role="menuitem"
            className="w-full text-left px-4 py-2.5 hover:bg-slate-50 text-slate-800 disabled:opacity-50"
            disabled={extractAppointmentBusy}
            onClick={() => {
              setOpen(false)
              onGenerateAppointment()
            }}
          >
            {extractAppointmentBusy ? 'Generating…' : 'Generate Appointment'}
          </button>
          {onArchiveToggle && (conversationStatus === 'OPEN' || conversationStatus === 'ARCHIVED') && (
            <button
              type="button"
              role="menuitem"
              className="w-full text-left px-4 py-2.5 hover:bg-slate-50 text-slate-800 disabled:opacity-50 border-t border-slate-100"
              disabled={archiveBusy}
              onClick={() => {
                setOpen(false)
                void onArchiveToggle()
              }}
            >
              {archiveBusy
                ? 'Updating…'
                : conversationStatus === 'ARCHIVED'
                  ? 'Restore to inbox'
                  : 'Archive conversation'}
            </button>
          )}
          {onDeleteContact && (
            <button
              type="button"
              role="menuitem"
              className="w-full text-left px-4 py-2.5 hover:bg-red-50 text-red-700 border-t border-slate-100"
              onClick={() => {
                setOpen(false)
                void onDeleteContact()
              }}
            >
              Delete contact
            </button>
          )}
        </div>
      )}
    </div>
  )
}

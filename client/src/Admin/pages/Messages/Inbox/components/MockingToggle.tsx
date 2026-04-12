type Props = {
  enabled: boolean
  onChange: (enabled: boolean) => void
}

/** DevTools inbox: skip real Twilio on outbound when enabled */
export default function MockingToggle({ enabled, onChange }: Props) {
  return (
    <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
      <span className="text-xs font-medium text-slate-600 whitespace-nowrap">Mocking</span>
      <span className="relative inline-flex h-6 w-11 shrink-0 align-middle">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={enabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span
          className="pointer-events-none absolute inset-0 rounded-full bg-slate-200 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-blue-400 peer-focus-visible:ring-offset-2 peer-checked:bg-blue-600"
          aria-hidden
        />
        <span
          className="pointer-events-none absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5"
          aria-hidden
        />
      </span>
    </label>
  )
}

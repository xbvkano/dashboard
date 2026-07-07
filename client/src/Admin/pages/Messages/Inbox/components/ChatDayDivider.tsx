type Props = {
  label: string
}

export default function ChatDayDivider({ label }: Props) {
  return (
    <div className="flex justify-center py-2">
      <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-slate-600 shadow-sm">
        {label}
      </span>
    </div>
  )
}

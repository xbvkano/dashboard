type Props = {
  label: string
}

export default function ChatDayDivider({ label }: Props) {
  return (
    <div className="flex justify-center py-3">
      <span className="text-xs font-medium text-slate-500">{label}</span>
    </div>
  )
}

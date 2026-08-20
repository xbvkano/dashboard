import { formatUnreadBadge } from '../unreadBadge'

export default function UnreadBadge({
  count,
  tone = 'red',
  className = '',
}: {
  count: number
  tone?: 'red' | 'blue'
  className?: string
}) {
  const label = formatUnreadBadge(count)
  if (!label) return null
  const color = tone === 'blue' ? 'bg-blue-600' : 'bg-red-600'
  return (
    <span
      className={`absolute -top-1 -right-1 z-10 min-w-[1.15rem] h-[1.15rem] px-1 rounded-full ${color} text-white text-[10px] font-bold leading-[1.15rem] text-center tabular-nums pointer-events-none ${className}`}
      aria-label={`${count} unread`}
    >
      {label}
    </span>
  )
}

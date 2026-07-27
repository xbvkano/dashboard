import { formatEmployeeCode } from '../../formatEmployeeCode'

type Props = {
  employeeId: number | null | undefined
  /** Default: shows "Code 001". Use "compact" for tight calendar cards. */
  size?: 'sm' | 'md' | 'compact'
  className?: string
}

/** Easy-to-scan call-center employee code (Employee.id as keypad digits). */
export default function EmployeeCodeBadge({ employeeId, size = 'sm', className = '' }: Props) {
  const code = formatEmployeeCode(employeeId)
  if (!code) return null

  const sizeClass =
    size === 'md'
      ? 'text-sm px-2 py-0.5'
      : size === 'compact'
        ? 'text-[9px] px-1 py-px'
        : 'text-xs px-1.5 py-0.5'

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md bg-slate-800 text-white font-mono font-semibold tracking-wide ${sizeClass} ${className}`}
      title={`Employee call code ${code} (keypad / Employee #${employeeId})`}
    >
      <span className="opacity-80 font-sans font-medium tracking-normal normal-case">Code</span>
      {code}
    </span>
  )
}

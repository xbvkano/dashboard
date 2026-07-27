import { Link } from 'react-router-dom'
import MockingToggle from './MockingToggle'
import EmployeeCodeBadge from '../../../../components/EmployeeCodeBadge'
import { formatPhone } from '../../../../../formatPhone'

export type EmployeeDirectoryRow = {
  id: number
  name: string
  number: string
  /** Open conversation id on the admin line, if any */
  conversationId: number | null
  unread?: boolean
  lastPreview?: string | null
}

type Props = {
  employees: EmployeeDirectoryRow[]
  selectedConversationId: number | null
  selectedEmployeeId: number | null
  onSelectEmployee: (employee: EmployeeDirectoryRow) => void
  listLoading?: boolean
  searchQuery: string
  onSearchChange: (q: string) => void
  showMockingToggle?: boolean
  mockingEnabled?: boolean
  onMockingChange?: (enabled: boolean) => void
  startingEmployeeId?: number | null
  title?: string
}

export default function EmployeeDirectoryList({
  employees,
  selectedConversationId,
  selectedEmployeeId,
  onSelectEmployee,
  listLoading,
  searchQuery,
  onSearchChange,
  showMockingToggle,
  mockingEnabled,
  onMockingChange,
  startingEmployeeId,
  title = 'Employee inbox',
}: Props) {
  return (
    <div className="flex flex-col h-full min-h-0 bg-white md:rounded-l-xl md:border md:border-slate-200 md:overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-2 sm:px-3 py-2 border-b border-slate-200 shrink-0 bg-white/95 backdrop-blur-sm">
        <div className="flex items-center gap-1 min-w-0 flex-1">
          <Link
            to="/dashboard/messages"
            className="shrink-0 inline-flex items-center justify-center p-2 -ml-1 rounded-full text-blue-600 hover:bg-blue-50 active:bg-blue-100"
            aria-label="Back to Messages"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h2 className="text-lg font-bold text-slate-900 truncate">{title}</h2>
        </div>
        {showMockingToggle && typeof mockingEnabled === 'boolean' && onMockingChange && (
          <MockingToggle enabled={mockingEnabled} onChange={onMockingChange} />
        )}
      </div>

      <div className="px-2 sm:px-3 py-2 border-b border-slate-100 shrink-0">
        <label htmlFor="employee-inbox-search" className="sr-only">
          Search employees
        </label>
        <input
          id="employee-inbox-search"
          type="search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search employees…"
          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40"
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {listLoading && employees.length === 0 ? (
          <p className="px-3 py-4 text-sm text-slate-500">Loading employees…</p>
        ) : employees.length === 0 ? (
          <p className="px-3 py-4 text-sm text-slate-500">No active employees found.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {employees.map((emp) => {
              const selected =
                (selectedEmployeeId != null && selectedEmployeeId === emp.id) ||
                (emp.conversationId != null && emp.conversationId === selectedConversationId)
              const starting = startingEmployeeId === emp.id
              return (
                <li key={emp.id}>
                  <button
                    type="button"
                    disabled={starting}
                    onClick={() => onSelectEmployee(emp)}
                    className={`w-full text-left px-3 py-3 hover:bg-slate-50 active:bg-slate-100 transition-colors ${
                      selected ? 'bg-blue-50/80' : ''
                    } ${starting ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`font-medium text-slate-900 truncate ${
                              emp.unread ? 'font-semibold' : ''
                            }`}
                          >
                            {emp.name}
                          </span>
                          <EmployeeCodeBadge employeeId={emp.id} size="compact" className="shrink-0" />
                          {emp.unread && (
                            <span className="shrink-0 w-2 h-2 rounded-full bg-blue-600" aria-label="Unread" />
                          )}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 truncate">
                          {formatPhone(emp.number) || emp.number}
                        </div>
                        {emp.lastPreview && (
                          <div className="text-xs text-slate-400 mt-1 truncate">{emp.lastPreview}</div>
                        )}
                      </div>
                      {starting && (
                        <span className="text-xs text-slate-500 shrink-0 self-center">Opening…</span>
                      )}
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

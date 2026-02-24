import { useState, useEffect } from 'react'
import { API_BASE_URL, fetchJson } from '../../../api'
import { useModal } from '../../../ModalProvider'

// Seed creates Marcos Kano with generateUserName('17255774523') → stored as '7255774523' in User.userName
const MARCOS_KANO_USER_NAME = '7255774523'

interface Employee {
  id: number
  name: string
  number: string
}

interface DevToolsProps {
  onSwitchRole?: (role: 'ADMIN' | 'OWNER' | 'EMPLOYEE', userName?: string) => void
}

function todayLocalYYYYMMDD(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function DevTools({ onSwitchRole }: DevToolsProps) {
  const { alert } = useModal()
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [employees, setEmployees] = useState<Employee[]>([])
  const [noonReminderDate, setNoonReminderDate] = useState(todayLocalYYYYMMDD())
  const [noonReminderEmployeeId, setNoonReminderEmployeeId] = useState<string>('')
  const [noonReminderLoading, setNoonReminderLoading] = useState(false)

  useEffect(() => {
    fetchJson(`${API_BASE_URL}/employees`)
      .then((data: Employee[]) => setEmployees(data || []))
      .catch(() => setEmployees([]))
  }, [])

  const triggerJob = async (jobName: string, endpoint: string) => {
    setLoading(prev => ({ ...prev, [jobName]: true }))
    try {
      const result = await fetchJson(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      await alert(`Job "${jobName}" completed successfully!\n\n${JSON.stringify(result, null, 2)}`)
    } catch (error: any) {
      await alert(`Job "${jobName}" failed:\n\n${error.error || error.message || 'Unknown error'}`)
    } finally {
      setLoading(prev => ({ ...prev, [jobName]: false }))
    }
  }

  const jobs = [
    {
      name: 'Schedule Cleanup',
      description: 'Moves past schedule entries to pastSchedule array',
      endpoint: '/test/jobs/schedule-cleanup',
    },
    {
      name: 'Schedule Reminder',
      description: 'Sends reminders to employees who haven\'t updated their schedule in 8+ days',
      endpoint: '/test/jobs/schedule-reminder',
    },
    {
      name: 'Recurring Sync',
      description: 'Syncs recurring appointments and creates unconfirmed instances',
      endpoint: '/test/jobs/recurring-sync',
    },
    {
      name: 'Appointment Reminder',
      description: 'Sends SMS reminders to clients about appointments tomorrow',
      endpoint: '/test/jobs/appointment-reminder',
    },
    {
      name: '7pm Unconfirmed Check',
      description: 'Checks tomorrow\'s appointments for unconfirmed jobs and texts each employee\'s supervisor (employee name/number, appointment date/time, client name)',
      endpoint: '/test/jobs/unconfirmed-check',
    },
  ]

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">DevTools</h2>
      </div>

      {onSwitchRole && (
        <div className="border rounded-lg p-4 bg-white shadow">
          <h3 className="text-lg font-semibold mb-2">View as employee</h3>
          <p className="text-sm text-gray-600 mb-4">
            Switch to the employee side logged in as <strong>Marcos Kano</strong> to see their schedule and view.
          </p>
          <button
            type="button"
            onClick={() => onSwitchRole('EMPLOYEE', MARCOS_KANO_USER_NAME)}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Open employee view (Marcos Kano)
          </button>
        </div>
      )}
      
      <div className="bg-yellow-50 border border-yellow-200 rounded p-4 mb-4">
        <p className="text-sm text-yellow-800">
          <strong>Warning:</strong> These buttons will trigger actual cron jobs. Make sure you understand what each job does before running it.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {jobs.map((job) => (
          <div key={job.name} className="border rounded-lg p-4 bg-white shadow">
            <h3 className="text-lg font-semibold mb-2">{job.name}</h3>
            <p className="text-sm text-gray-600 mb-4">{job.description}</p>
            <button
              onClick={() => triggerJob(job.name, job.endpoint)}
              disabled={loading[job.name]}
              className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading[job.name] ? 'Running...' : `Run ${job.name}`}
            </button>
          </div>
        ))}
      </div>

      <div className="border rounded-lg p-4 bg-white shadow">
        <h3 className="text-lg font-semibold mb-2">Noon 14-day employee reminder</h3>
        <p className="text-sm text-gray-600 mb-4">
          Simulate the noon job: we only send for the new day that just entered the 14-day window (today + 14). Other days already got their message when booked. Pick the date (as "today") and optionally an employee; e.g. Feb 22 → only appointments on Mar 8 get the SMS.
        </p>
        <div className="flex flex-wrap items-end gap-4 mb-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Simulate this day (noon = today)</span>
            <input
              type="date"
              value={noonReminderDate}
              onChange={(e) => setNoonReminderDate(e.target.value)}
              className="border rounded px-2 py-1"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Send only to employee (optional)</span>
            <select
              value={noonReminderEmployeeId}
              onChange={(e) => setNoonReminderEmployeeId(e.target.value)}
              className="border rounded px-2 py-1 min-w-[160px]"
            >
              <option value="">All with unconfirmed in window</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={async () => {
              setNoonReminderLoading(true)
              try {
                const body: { date: string; employeeId?: number } = { date: noonReminderDate }
                if (noonReminderEmployeeId) body.employeeId = Number(noonReminderEmployeeId)
                const result = await fetchJson(`${API_BASE_URL}/test/jobs/noon-employee-reminder`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(body),
                })
                await alert(
                  `Noon reminder completed (window start: ${noonReminderDate} at noon local)\n\n` +
                    `Sent: ${result.sent}\nSkipped: ${result.skipped}\nFailed: ${result.failed}\n\n` +
                    JSON.stringify(result, null, 2)
                )
              } catch (error: any) {
                await alert(`Noon reminder failed:\n\n${error?.message || error?.error || 'Unknown error'}`)
              } finally {
                setNoonReminderLoading(false)
              }
            }}
            disabled={noonReminderLoading}
            className="px-4 py-2 bg-amber-500 text-white rounded hover:bg-amber-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {noonReminderLoading ? 'Running...' : 'Run noon reminder for this date'}
          </button>
        </div>
      </div>
    </div>
  )
}

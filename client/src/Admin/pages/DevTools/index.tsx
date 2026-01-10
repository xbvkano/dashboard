import { useState } from 'react'
import { API_BASE_URL, fetchJson } from '../../../api'
import { useModal } from '../../../ModalProvider'

export default function DevTools() {
  const { alert } = useModal()
  const [loading, setLoading] = useState<Record<string, boolean>>({})

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
  ]

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">DevTools - Cron Job Tester</h2>
      </div>
      
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
    </div>
  )
}

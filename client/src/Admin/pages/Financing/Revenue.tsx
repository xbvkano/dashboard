import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Line, Pie } from 'react-chartjs-2'
import {
  ArcElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js'
import { API_BASE_URL, fetchJson } from '../../../api'

ChartJS.register(
  ArcElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
)

interface InvoiceData {
  serviceDate: string
  total: number
  serviceType: string
}

export default function Revenue() {
  const [data, setData] = useState<InvoiceData[]>([])

  useEffect(() => {
    fetchJson(`${API_BASE_URL}/revenue`)
      .then((d) => setData(d))
      .catch(() => setData([]))
  }, [])

  const group = (
    items: InvoiceData[],
    keyFn: (d: Date, it: InvoiceData) => string,
  ): { labels: string[]; values: number[] } => {
    const map: Record<string, number> = {}
    for (const it of items) {
      const d = new Date(it.serviceDate)
      const key = keyFn(d, it)
      map[key] = (map[key] || 0) + it.total
    }
    const labels = Object.keys(map).sort()
    return { labels, values: labels.map((l) => map[l]) }
  }

  const daily = (() => {
    const g = group(data, (d) => d.toISOString().slice(0, 10))
    if (g.labels.length > 30) {
      const start = g.labels.length - 30
      g.labels = g.labels.slice(start)
      g.values = g.values.slice(start)
    }
    return g
  })()

  const weekly = (() => {
    const g = group(data, (d) => {
      const day = new Date(d)
      day.setDate(day.getDate() - day.getDay())
      return day.toISOString().slice(0, 10)
    })
    if (g.labels.length > 12) {
      const start = g.labels.length - 12
      g.labels = g.labels.slice(start)
      g.values = g.values.slice(start)
    }
    return g
  })()

  const monthly = (() => {
    const g = group(data, (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    if (g.labels.length > 12) {
      const start = g.labels.length - 12
      g.labels = g.labels.slice(start)
      g.values = g.values.slice(start)
    }
    return g
  })()

  const quarterly = (() => {
    const g = group(data, (d) => `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`)
    if (g.labels.length > 8) {
      const start = g.labels.length - 8
      g.labels = g.labels.slice(start)
      g.values = g.values.slice(start)
    }
    return g
  })()

  const yearly = group(data, (d) => String(d.getFullYear()))

  const byType = (() => {
    const map: Record<string, number> = {}
    for (const it of data) {
      map[it.serviceType] = (map[it.serviceType] || 0) + it.total
    }
    const labels = Object.keys(map)
    return { labels, values: labels.map((l) => map[l]) }
  })()

  const monthLabels = monthly.labels
  const thisMonth = monthly.values[monthLabels.length - 1] || 0
  const lastMonth = monthly.values[monthLabels.length - 2] || 0
  const diff = thisMonth - lastMonth
  const upDown =
    lastMonth === 0 ? 0 : Math.round((diff / lastMonth) * 100)

  return (
    <div className="p-4 space-y-8 pb-16">
      <Link to=".." className="text-blue-500 text-sm">
        &larr; Back
      </Link>
      <h2 className="text-xl font-semibold mb-2">Revenue</h2>

      <div className="grid gap-8 md:grid-cols-2">
        <div>
          <h3 className="font-medium mb-2">Daily (last 30 days)</h3>
          <Line
            data={{
              labels: daily.labels,
              datasets: [
                {
                  label: 'Revenue',
                  data: daily.values,
                  borderColor: 'rgb(99, 102, 241)',
                  backgroundColor: 'rgba(99, 102, 241, 0.5)',
                },
              ],
            }}
            options={{ responsive: true, maintainAspectRatio: false }}
          />
        </div>
        <div>
          <h3 className="font-medium mb-2">Weekly (last 12 weeks)</h3>
          <Line
            data={{
              labels: weekly.labels,
              datasets: [
                {
                  label: 'Revenue',
                  data: weekly.values,
                  borderColor: 'rgb(16, 185, 129)',
                  backgroundColor: 'rgba(16, 185, 129, 0.5)',
                },
              ],
            }}
            options={{ responsive: true, maintainAspectRatio: false }}
          />
        </div>
        <div>
          <h3 className="font-medium mb-2">Monthly (last 12 months)</h3>
          <Line
            data={{
              labels: monthly.labels,
              datasets: [
                {
                  label: 'Revenue',
                  data: monthly.values,
                  borderColor: 'rgb(59, 130, 246)',
                  backgroundColor: 'rgba(59, 130, 246, 0.5)',
                },
              ],
            }}
            options={{ responsive: true, maintainAspectRatio: false }}
          />
        </div>
        <div>
          <h3 className="font-medium mb-2">Quarterly (last 8 quarters)</h3>
          <Line
            data={{
              labels: quarterly.labels,
              datasets: [
                {
                  label: 'Revenue',
                  data: quarterly.values,
                  borderColor: 'rgb(234, 179, 8)',
                  backgroundColor: 'rgba(234, 179, 8, 0.5)',
                },
              ],
            }}
            options={{ responsive: true, maintainAspectRatio: false }}
          />
        </div>
        <div>
          <h3 className="font-medium mb-2">Yearly</h3>
          <Line
            data={{
              labels: yearly.labels,
              datasets: [
                {
                  label: 'Revenue',
                  data: yearly.values,
                  borderColor: 'rgb(249, 115, 22)',
                  backgroundColor: 'rgba(249, 115, 22, 0.5)',
                },
              ],
            }}
            options={{ responsive: true, maintainAspectRatio: false }}
          />
        </div>
        <div>
          <h3 className="font-medium mb-2">By Service Type</h3>
          <Pie
            data={{
              labels: byType.labels,
              datasets: [
                {
                  data: byType.values,
                  backgroundColor: [
                    'rgb(99,102,241)',
                    'rgb(16,185,129)',
                    'rgb(59,130,246)',
                    'rgb(234,179,8)',
                    'rgb(249,115,22)',
                  ],
                },
              ],
            }}
            options={{ responsive: true, maintainAspectRatio: false }}
          />
        </div>
      </div>

      <div className="pt-6 text-lg font-medium">
        {`This month: $${thisMonth.toFixed(2)} (${upDown >= 0 ? '+' : ''}${upDown}% vs last month)`}
      </div>
    </div>
  )
}

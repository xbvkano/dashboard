import React, { useState, useEffect, useMemo } from 'react'
import { API_BASE_URL, fetchJson } from '../../../api'

type RangePreset = 'week' | 'month' | 'custom'

/** GET /api/stats response. See Evidence Cleaning Server API. */
interface StatsResponse {
  quotes: {
    total: number
    bySource: Array<{ source: string; count: number }>
    byService?: Array<{ service: string; count: number }>
  }
  calls: {
    total: number
    /** Count per call section (e.g. West, North). From GET /api/stats — always present in latest API, possibly empty. */
    bySection?: Array<{ section: string; count: number }>
  }
}

/** Map stats.calls.bySection (GET /api/stats) to chart segments. */
function getCallsBreakdownFromStats(calls: StatsResponse['calls'] | null | undefined): Array<{ source: string; count: number }> {
  const bySection = calls?.bySection
  if (!bySection?.length) return []
  return bySection.map(({ section, count }) => ({ source: section, count }))
}

/** GET /api/calls response item (has section). */
interface CallRecord {
  id?: number
  section?: string
  [key: string]: unknown
}

/** Compute bySection from GET /api/calls data when stats.bySection is missing. */
function getCallsBreakdownFromList(data: CallRecord[]): Array<{ source: string; count: number }> {
  const bySection = new Map<string, number>()
  for (const row of data) {
    const section = row.section ?? 'Unknown'
    bySection.set(section, (bySection.get(section) ?? 0) + 1)
  }
  return Array.from(bySection.entries(), ([section, count]) => ({ source: section, count })).sort(
    (a, b) => b.count - a.count
  )
}

function toYYYYMMDD(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function startOfDay(d: Date): Date {
  const out = new Date(d)
  out.setHours(0, 0, 0, 0)
  return out
}

function getWeekRange(anchor: Date): { start: Date; end: Date } {
  const start = new Date(anchor)
  start.setDate(start.getDate() - start.getDay())
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  return { start: startOfDay(start), end: startOfDay(end) }
}

function getMonthRange(anchor: Date): { start: Date; end: Date } {
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)
  return { start: startOfDay(start), end: startOfDay(end) }
}

function getPreviousWeekRange(anchor: Date): { start: Date; end: Date } {
  const { start } = getWeekRange(anchor)
  const prevEnd = new Date(start)
  prevEnd.setDate(prevEnd.getDate() - 1)
  const prevStart = new Date(prevEnd)
  prevStart.setDate(prevStart.getDate() - 6)
  return { start: startOfDay(prevStart), end: startOfDay(prevEnd) }
}

function getPreviousMonthRange(anchor: Date): { start: Date; end: Date } {
  const d = new Date(anchor.getFullYear(), anchor.getMonth(), 0)
  return getMonthRange(d)
}

const SOURCE_COLORS = [
  '#3b82f6', // blue
  '#22c55e', // green
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#64748b', // slate
  '#06b6d4', // cyan
  '#f97316', // orange
]

function DonutChart({
  bySource,
  total,
  size = 200,
  title,
}: {
  bySource: Array<{ source: string; count: number }>
  total: number
  size?: number
  title: string
}) {
  const radius = size / 2
  const innerRadius = radius * 0.5
  const segments = useMemo(() => {
    if (total === 0) return []
    const sourceList =
      bySource.length > 0 ? bySource : [{ source: 'Total', count: total }]
    let acc = 0
    return sourceList.map((s, i) => {
      const startAngle = (acc / total) * 360
      acc += s.count
      const endAngle = (acc / total) * 360
      return {
        ...s,
        startAngle,
        endAngle,
        color: SOURCE_COLORS[i % SOURCE_COLORS.length],
      }
    })
  }, [bySource, total])

  const toCoord = (angleDeg: number, r: number) => {
    const rad = ((angleDeg - 90) * Math.PI) / 180
    const x = radius + r * Math.cos(rad)
    const y = radius + r * Math.sin(rad)
    return { x, y }
  }

  const pathFor = (startAngle: number, endAngle: number, rOuter: number, rInner: number) => {
    const large = endAngle - startAngle > 180 ? 1 : 0
    const startOuter = toCoord(startAngle, rOuter)
    const endOuter = toCoord(endAngle, rOuter)
    const startInner = toCoord(startAngle, rInner)
    const endInner = toCoord(endAngle, rInner)
    return `M ${startOuter.x} ${startOuter.y} A ${rOuter} ${rOuter} 0 ${large} 1 ${endOuter.x} ${endOuter.y} L ${endInner.x} ${endInner.y} A ${rInner} ${rInner} 0 ${large} 0 ${startInner.x} ${startInner.y} Z`
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      <div className="relative inline-flex items-center justify-center">
        <svg width={size} height={size} className="transform -rotate-0">
          {total === 0 ? (
            <circle
              cx={radius}
              cy={radius}
              r={radius - 2}
              fill="none"
              stroke="#e2e8f0"
              strokeWidth={radius - innerRadius}
            />
          ) : (
            segments.map((seg, i) => (
              <path
                key={i}
                d={pathFor(seg.startAngle, seg.endAngle, radius - 2, innerRadius)}
                fill={seg.color}
                stroke="white"
                strokeWidth={1}
              />
            ))
          )}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold text-slate-800">{total}</span>
        </div>
      </div>
      {segments.length > 0 && (
        <ul className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-slate-600 max-w-[220px]">
          {segments.map((seg, i) => (
            <li key={i} className="flex items-center gap-1.5">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: seg.color }}
              />
              {seg.source}: {seg.count}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function toYYYYMM(date: Date): string {
  const y = date.getFullYear()
  const m = date.getMonth() + 1
  return `${y}-${String(m).padStart(2, '0')}`
}

export default function StatsSection() {
  const [rangePreset, setRangePreset] = useState<RangePreset>('week')
  const [selectedMonth, setSelectedMonth] = useState(() => toYYYYMM(new Date()))
  const [customStart, setCustomStart] = useState(() => toYYYYMMDD(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)))
  const [customEnd, setCustomEnd] = useState(() => toYYYYMMDD(new Date()))
  const [current, setCurrent] = useState<StatsResponse | null>(null)
  const [previous, setPrevious] = useState<StatsResponse | null>(null)
  const [callsBreakdownFallback, setCallsBreakdownFallback] = useState<Array<{ source: string; count: number }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { start, end, previousStart, previousEnd, label, previousLabel } = useMemo(() => {
    const now = new Date()
    if (rangePreset === 'week') {
      const { start, end } = getWeekRange(now)
      const { start: pStart, end: pEnd } = getPreviousWeekRange(now)
      return {
        start,
        end,
        previousStart: pStart,
        previousEnd: pEnd,
        label: 'This week',
        previousLabel: 'Previous week',
      }
    }
    if (rangePreset === 'month') {
      const [y, m] = selectedMonth.split('-').map(Number)
      const anchor = new Date(y, (m ?? 1) - 1, 15)
      const { start, end } = getMonthRange(anchor)
      const { start: pStart, end: pEnd } = getPreviousMonthRange(anchor)
      const monthName = anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
      return {
        start,
        end,
        previousStart: pStart,
        previousEnd: pEnd,
        label: monthName,
        previousLabel: 'Previous month',
      }
    }
    const start = startOfDay(new Date(customStart))
    const end = startOfDay(new Date(customEnd))
    const days = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) || 1
    const prevEnd = new Date(start)
    prevEnd.setDate(prevEnd.getDate() - 1)
    const prevStart = new Date(prevEnd)
    prevStart.setDate(prevStart.getDate() - days)
    return {
      start,
      end,
      previousStart: startOfDay(prevStart),
      previousEnd: startOfDay(prevEnd),
      label: 'Custom range',
      previousLabel: 'Previous period',
    }
  }, [rangePreset, selectedMonth, customStart, customEnd])

  useEffect(() => {
    setLoading(true)
    setError(null)
    setCallsBreakdownFallback([])
    const base = `${API_BASE_URL}/api/stats`
    const currentParams = `startDate=${toYYYYMMDD(start)}&endDate=${toYYYYMMDD(end)}`
    const previousParams = `startDate=${toYYYYMMDD(previousStart)}&endDate=${toYYYYMMDD(previousEnd)}`
    Promise.all([
      fetchJson(`${base}?${currentParams}`).catch((e) => {
        throw e
      }),
      fetchJson(`${base}?${previousParams}`).catch((e) => {
        throw e
      }),
    ])
      .then(([cur, prev]) => {
        setCurrent(cur as StatsResponse)
        setPrevious(prev as StatsResponse)
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Failed to load stats')
        setCurrent(null)
        setPrevious(null)
      })
      .finally(() => setLoading(false))
  }, [start, end, previousStart, previousEnd])

  const startStr = toYYYYMMDD(start)
  const endStr = toYYYYMMDD(end)

  useEffect(() => {
    if (loading || !current?.calls) return
    const fromStats = getCallsBreakdownFromStats(current.calls)
    if (fromStats.length > 0) {
      setCallsBreakdownFallback([])
      return
    }
    if ((current.calls.total ?? 0) === 0) return
    fetchJson(`${API_BASE_URL}/api/calls?startDate=${startStr}&endDate=${endStr}&limit=500`)
      .then((res: { data?: CallRecord[] }) => {
        const data = res?.data ?? []
        setCallsBreakdownFallback(getCallsBreakdownFromList(data))
      })
      .catch(() => setCallsBreakdownFallback([]))
  }, [loading, current?.calls, startStr, endStr])

  const quotesTotal = current?.quotes?.total ?? 0
  const quotesPrev = previous?.quotes?.total ?? 0
  const quotesDiff = quotesTotal - quotesPrev
  const callsTotal = current?.calls?.total ?? 0
  const callsPrev = previous?.calls?.total ?? 0
  const callsDiff = callsTotal - callsPrev
  const quotesBySource = current?.quotes?.bySource ?? []
  const callsBySectionForChart = useMemo(() => {
    const fromStats = getCallsBreakdownFromStats(current?.calls)
    if (fromStats.length > 0) return fromStats
    return callsBreakdownFallback
  }, [current?.calls, callsBreakdownFallback])
  const overviewSegments = useMemo(
    () => [
      { source: 'Form submissions', count: quotesTotal },
      { source: 'Calls', count: callsTotal },
    ].filter((s) => s.count > 0),
    [quotesTotal, callsTotal]
  )
  const overviewTotal = quotesTotal + callsTotal

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-slate-800">Form submissions & calls</h3>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-600">Range:</span>
          {(['week', 'month', 'custom'] as const).map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setRangePreset(preset)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize ${
                rangePreset === preset ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {preset}
            </button>
          ))}
          {rangePreset === 'month' && (
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
          )}
          {rangePreset === 'custom' && (
            <>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="rounded border border-slate-300 px-2 py-1 text-sm"
              />
              <span className="text-slate-400">–</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="rounded border border-slate-300 px-2 py-1 text-sm"
              />
            </>
          )}
        </div>
      </div>

      <div className="p-4">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800 mb-4">
            {error}
          </div>
        )}
        {loading ? (
          <div className="py-8 text-center text-slate-500">Loading stats…</div>
        ) : (
          <>
            <div className="mb-4">
              <p className="text-sm text-slate-600">{label}</p>
              <p className="text-sm text-slate-500">vs {previousLabel} comparison below</p>
            </div>
            <div className="flex flex-row justify-center items-start gap-10 md:gap-14 flex-wrap">
              <div className="w-[260px] flex-shrink-0 flex flex-col items-center gap-3 text-center">
                <DonutChart
                  bySource={overviewSegments}
                  total={overviewTotal}
                  size={220}
                  title="Form submissions vs calls"
                />
              </div>
              <div className="w-[260px] flex-shrink-0 flex flex-col items-center gap-3 text-center">
                <DonutChart
                  bySource={quotesBySource}
                  total={quotesTotal}
                  size={220}
                  title="Form submissions by source"
                />
                <p className="text-sm text-slate-600">
                  vs {previousLabel}:{' '}
                  <span className={quotesDiff >= 0 ? 'text-emerald-600 font-medium' : 'text-red-600 font-medium'}>
                    {quotesDiff >= 0 ? '+' : ''}{quotesDiff}
                  </span>
                </p>
              </div>
              <div className="w-[260px] flex-shrink-0 flex flex-col items-center gap-3 text-center">
                <DonutChart
                  bySource={callsBySectionForChart}
                  total={callsTotal}
                  size={220}
                  title="Calls by section"
                />
                <p className="text-sm text-slate-600">
                  vs {previousLabel}:{' '}
                  <span className={callsDiff >= 0 ? 'text-emerald-600 font-medium' : 'text-red-600 font-medium'}>
                    {callsDiff >= 0 ? '+' : ''}{callsDiff}
                  </span>
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

import { useEffect } from 'react'
import { API_BASE_URL, fetchJson } from '../../../../api'
import type { Appointment } from '../types'

/**
 * Convert local date to UTC date string (YYYY-MM-DD)
 * When user selects a date in their local timezone (e.g., Jan 18),
 * we send the date string "2026-01-18" which the server interprets as UTC Jan 18 00:00.
 * This ensures consistent storage: the same calendar day is stored the same way everywhere.
 */
function formatDateAsUTC(date: Date): string {
  // Use local date components (what user sees/selects)
  // The date string "2026-01-18" represents the same calendar day in UTC
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Convert UTC date (from server) to local date string (YYYY-MM-DD) for display
 * Server sends dates as UTC, we convert to local for user display
 */
function formatUTCDateAsLocal(dateStr: string | Date): string {
  // If it's a Date object, convert to ISO string first
  const isoStr = typeof dateStr === 'string' ? dateStr : dateStr.toISOString()
  // Parse as UTC and get local date components
  const utcDate = new Date(isoStr)
  const localYear = utcDate.getFullYear()
  const localMonth = String(utcDate.getMonth() + 1).padStart(2, '0')
  const localDay = String(utcDate.getDate()).padStart(2, '0')
  return `${localYear}-${localMonth}-${localDay}`
}

export function useCalendarData(
  selected: Date,
  setMonthInfo: (info: { startDay: number; endDay: number; daysInMonth: number } | null) => void,
  setMonthCounts: (counts: Record<string, number>) => void,
  setWeekCounts: (counts: Record<string, number>) => void,
  setAppointments: (appts: { prev: Appointment[]; current: Appointment[]; next: Appointment[] }) => void
) {
  const refreshMonthCounts = (d = selected) => {
    const year = d.getFullYear()
    const month = d.getMonth() + 1
    fetchJson(`${API_BASE_URL}/appointments/month-counts?year=${year}&month=${month}`)
      .then((data) => setMonthCounts(data as Record<string, number>))
      .catch(() => {})
  }

  const refreshWeekCounts = (d = selected) => {
    const start = startOfWeek(d)
    const end = addDays(start, 7)
    const startStr = formatDateAsUTC(start)
    const endStr = formatDateAsUTC(end)
    fetchJson(
      `${API_BASE_URL}/appointments/range-counts?start=${startStr}&end=${endStr}`,
    )
      .then((data) => setWeekCounts(data as Record<string, number>))
      .catch(() => {})
  }

  const refresh = (d = selected) => {
    const fetchDay = (day: Date) =>
      fetchJson(`${API_BASE_URL}/appointments?date=${formatDateAsUTC(day)}`)
        .then((res) => {
          // Convert UTC dates from server to local dates for display
          const appointments = (res as Appointment[]).map((appt) => ({
            ...appt,
            date: new Date(appt.date), // Keep as Date object, will be displayed in local time
          }))
          return appointments
        })
        .catch(() => [])
    Promise.all([
      fetchDay(addDays(d, -1)),
      fetchDay(d),
      fetchDay(addDays(d, 1)),
    ]).then(([prev, current, next]) => setAppointments({ prev, current, next }))
  }

  // Fetch month info and counts when month changes
  useEffect(() => {
    const year = selected.getFullYear()
    const month = selected.getMonth() + 1
    fetchJson(`${API_BASE_URL}/month-info?year=${year}&month=${month}`)
      .then((data) => setMonthInfo(data))
      .catch(() => setMonthInfo(null))
    refreshMonthCounts(new Date(year, month - 1, 1))
  }, [selected.getFullYear(), selected.getMonth(), setMonthInfo, setMonthCounts])

  // Fetch week counts when selected date changes
  useEffect(() => {
    refreshWeekCounts(selected)
  }, [selected])

  // Fetch appointments when selected date changes
  useEffect(() => {
    refresh(selected)
  }, [selected])

  return {
    refresh,
    refreshMonthCounts,
    refreshWeekCounts,
  }
}

function startOfWeek(date: Date) {
  const day = date.getDay()
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - day)
}

function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

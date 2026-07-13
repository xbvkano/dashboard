import { useEffect, useLayoutEffect, useState } from 'react'
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

export function useCalendarData(
  selected: Date,
  setMonthInfo: (info: { startDay: number; endDay: number; daysInMonth: number } | null) => void,
  setMonthCounts: (counts: Record<string, number>) => void,
  setWeekCounts: (counts: Record<string, number>) => void,
  setAppointments: (appts: { prev: Appointment[]; current: Appointment[]; next: Appointment[] }) => void
) {
  const [isLoadingDay, setIsLoadingDay] = useState(true)

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
    const fetchDay = (day: Date): Promise<Appointment[]> => {
      const dateStr = formatDateAsUTC(day)
      return fetchJson(`${API_BASE_URL}/appointments?date=${dateStr}`)
        .then((res) => {
          // Convert UTC dates from server to local dates for display
          const appointments = (res as Appointment[]).map((appt) => ({
            ...appt,
            date: new Date(appt.date), // Keep as Date object, will be displayed in local time
          }))
          return appointments
        })
        .catch((err) => {
          console.error('Error fetching appointments:', err)
          return [] as Appointment[]
        })
    }
    return Promise.all([
      fetchDay(addDays(d, -1)),
      fetchDay(d),
      fetchDay(addDays(d, 1)),
    ]).then(([prev, current, next]) => {
      setAppointments({
        prev: prev as Appointment[],
        current: current as Appointment[],
        next: next as Appointment[],
      })
    })
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

  // Mark loading synchronously before paint when selected day changes
  useLayoutEffect(() => {
    setIsLoadingDay(true)
  }, [selected])

  // Fetch appointments when selected date changes
  useEffect(() => {
    let cancelled = false
    setIsLoadingDay(true)
    refresh(selected).finally(() => {
      if (!cancelled) setIsLoadingDay(false)
    })
    return () => {
      cancelled = true
    }
  }, [selected])

  return {
    refresh,
    refreshMonthCounts,
    refreshWeekCounts,
    isLoadingDay,
  }
}

function startOfWeek(date: Date) {
  const day = date.getDay()
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - day)
}

function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

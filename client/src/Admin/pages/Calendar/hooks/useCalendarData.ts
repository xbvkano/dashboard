import { useEffect } from 'react'
import { API_BASE_URL, fetchJson } from '../../../../api'
import type { Appointment } from '../types'

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
    const startStr = start.toISOString().slice(0, 10)
    const endStr = end.toISOString().slice(0, 10)
    fetchJson(
      `${API_BASE_URL}/appointments/range-counts?start=${startStr}&end=${endStr}`,
    )
      .then((data) => setWeekCounts(data as Record<string, number>))
      .catch(() => {})
  }

  const refresh = (d = selected) => {
    const fetchDay = (day: Date) =>
      fetchJson(`${API_BASE_URL}/appointments?date=${day.toISOString().slice(0, 10)}`)
        .then((res) => res as Appointment[])
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

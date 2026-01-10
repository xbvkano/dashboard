import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { API_BASE_URL, fetchJson } from '../../../../api'
import type { Appointment } from '../types'

export function useCalendarState() {
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const queryDate = params.get('date')
  const queryAppt = params.get('appt')

  const [selected, setSelected] = useState(() => {
    if (queryDate) {
      // Parse date string (YYYY-MM-DD) to avoid timezone issues
      const dateParts = queryDate.split('-')
      if (dateParts.length === 3) {
        const d = new Date(
          parseInt(dateParts[0]),
          parseInt(dateParts[1]) - 1, // Month is 0-indexed
          parseInt(dateParts[2])
        )
        if (!isNaN(d.getTime())) return d
      }
    }
    const stored = localStorage.getItem('calendarSelectedDate')
    if (stored) {
      try {
        const { value, savedAt } = JSON.parse(stored) as {
          value: string
          savedAt: string
        }
        const saved = new Date(savedAt)
        const now = new Date()
        if (
          saved.getFullYear() === now.getFullYear() &&
          saved.getMonth() === now.getMonth() &&
          saved.getDate() === now.getDate()
        ) {
          return new Date(value)
        }
      } catch {
        // ignore parse errors and fall back to today
      }
    }
    return new Date()
  })

  const [showMonth, setShowMonth] = useState(false)
  const [nowOffset, setNowOffset] = useState<number | null>(null)
  const [monthInfo, setMonthInfo] = useState<{ startDay: number; endDay: number; daysInMonth: number } | null>(null)
  const [monthCounts, setMonthCounts] = useState<Record<string, number>>({})
  const [weekCounts, setWeekCounts] = useState<Record<string, number>>({})
  const [appointments, setAppointments] = useState<{
    prev: Appointment[]
    current: Appointment[]
    next: Appointment[]
  }>({ prev: [], current: [], next: [] })

  const [createParams, setCreateParams] = useState<{
    clientId?: number
    templateId?: number | null
    status?: Appointment['status']
    appointment?: Appointment
  } | null>(() => {
    const stored = localStorage.getItem('createParams')
    if (stored) {
      try {
        return JSON.parse(stored)
      } catch {}
    }
    return null
  })

  const [rescheduleOldId, setRescheduleOldId] = useState<number | null>(() => {
    const stored = localStorage.getItem('rescheduleOldId')
    return stored ? Number(stored) : null
  })

  const [deleteOldId, setDeleteOldId] = useState<number | null>(null)

  // Persist selected date
  useEffect(() => {
    const data = {
      value: selected.toISOString(),
      savedAt: new Date().toISOString(),
    }
    localStorage.setItem('calendarSelectedDate', JSON.stringify(data))
  }, [selected])

  // Persist create params
  useEffect(() => {
    if (createParams) {
      localStorage.setItem('createParams', JSON.stringify(createParams))
    } else {
      localStorage.removeItem('createParams')
    }
  }, [createParams])

  // Persist reschedule old id
  useEffect(() => {
    if (rescheduleOldId === null) {
      localStorage.removeItem('rescheduleOldId')
    } else {
      localStorage.setItem('rescheduleOldId', String(rescheduleOldId))
    }
  }, [rescheduleOldId])

  // Update now offset every minute
  useEffect(() => {
    const update = () => {
      const now = new Date()
      const offset = now.getHours() * 84 + (now.getMinutes() / 60) * 84
      setNowOffset(offset)
    }
    update()
    const id = setInterval(update, 60000)
    return () => clearInterval(id)
  }, [])

  return {
    selected,
    setSelected,
    showMonth,
    setShowMonth,
    nowOffset,
    monthInfo,
    setMonthInfo,
    monthCounts,
    setMonthCounts,
    weekCounts,
    setWeekCounts,
    appointments,
    setAppointments,
    createParams,
    setCreateParams,
    rescheduleOldId,
    setRescheduleOldId,
    deleteOldId,
    setDeleteOldId,
    queryAppt: queryAppt ? Number(queryAppt) : undefined,
  }
}

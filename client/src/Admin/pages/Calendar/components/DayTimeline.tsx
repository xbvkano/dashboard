import {
  useLayoutEffect,
  useRef,
  useState,
  useEffect,
  type Ref,
} from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import type { Appointment } from '../types'
import { API_BASE_URL, fetchJson } from '../../../../api'
import { useModal } from '../../../../ModalProvider'
import { formatPhone } from '../../../../formatPhone'
import DayTimelineModalContainer from './DayTimelineHelpers/DayTimelineModalContainer'
import type { DayTimelineModalView } from './DayTimelineHelpers/DayTimelineModalContainer'

function parseSqft(s: string | null | undefined): number | null {
  if (!s) return null
  const parts = s.split('-')
  let n = parseInt(parts[1] || parts[0])
  if (isNaN(n)) n = parseInt(s)
  return isNaN(n) ? null : n
}

/** Match server calculateAppointmentHours so block height is correct even when hours is null */
function calculateAppointmentHours(size: string | null | undefined, serviceType: string): number {
  const sqft = parseSqft(size)
  if (sqft === null) return 3
  let baseHours = 3
  if (sqft <= 1500) baseHours = 3
  else if (sqft <= 2000) baseHours = 4
  else if (sqft <= 2500) baseHours = 5
  else if (sqft <= 3000) baseHours = 6
  else if (sqft <= 3500) baseHours = 7
  else if (sqft <= 4000) baseHours = 8
  else baseHours = 9
  switch (serviceType) {
    case 'DEEP':
      return baseHours + 1
    case 'MOVE_IN_OUT':
      return baseHours + 2
    default:
      return baseHours
  }
}

function calcPayRate(type: string, size: string | null | undefined, count: number): number {
  const sqft = parseSqft(size)
  const isLarge = sqft != null && sqft > 2500
  if (type === 'STANDARD') return isLarge ? 100 : 80
  if (type === 'DEEP' || type === 'MOVE_IN_OUT') {
    if (isLarge) return 100
    return count === 1 ? 100 : 90
  }
  return 0
}

function calcCarpetRate(size: string | null | undefined, rooms: number): number {
  const sqft = parseSqft(size)
  if (sqft === null) return 0
  const isLarge = sqft > 2500
  if (rooms === 1) return isLarge ? 20 : 10
  if (rooms <= 3) return isLarge ? 30 : 20
  if (rooms <= 5) return isLarge ? 40 : 30
  if (rooms <= 8) return isLarge ? 60 : 40
  return (isLarge ? 60 : 40) + 10 * (rooms - 8)
}

interface DayProps {
  appointments: Appointment[]
  nowOffset: number | null
  scrollRef?: Ref<HTMLDivElement>
  animating: boolean
  initialApptId?: number
  scrollToApptId?: number
  onUpdate?: (a: Appointment) => void
  onCreate?: (appt: Appointment, status: Appointment['status']) => void
  onEdit?: (appt: Appointment) => void
  onRescheduled?: (newAppointment: Appointment) => void
  onNavigateToDate?: (date: Date) => void
  onRefresh?: () => void
}

function Day({ appointments, nowOffset, scrollRef, animating, initialApptId, scrollToApptId, onUpdate, onCreate, onEdit, onRescheduled, onNavigateToDate, onRefresh }: DayProps) {
  const { alert, confirm } = useModal()
  const navigate = useNavigate()
  const [selected, setSelected] = useState<Appointment | null>(null)
  const [overlayTop, setOverlayTop] = useState(0)
  const [overlayHeight, setOverlayHeight] = useState(0)
  const [showDelete, setShowDelete] = useState(false)
  const [showCancel, setShowCancel] = useState(false)
  const [payRate, setPayRate] = useState<number | null>(null)
  const [carpetRate, setCarpetRate] = useState<number | null>(null)
  const [paid, setPaid] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('')
  const [otherPayment, setOtherPayment] = useState('')
  const [tip, setTip] = useState('')
  const [showSendInfo, setShowSendInfo] = useState(false)
  const [note, setNote] = useState('')
  const [observation, setObservation] = useState('')
  const [extraFor, setExtraFor] = useState<number | null>(null)
  const [extraName, setExtraName] = useState('')
  const [extraAmount, setExtraAmount] = useState('')
  const [editingExtraId, setEditingExtraId] = useState<number | null>(null)
  const [showPhoneActions, setShowPhoneActions] = useState(false)
  const [showActionPanel, setShowActionPanel] = useState(false)
  const [recurrenceRule, setRecurrenceRule] = useState<string | null>(null)
  const [editingNotes, setEditingNotes] = useState(false)
  const [editingNotesValue, setEditingNotesValue] = useState('')
  const [template, setTemplate] = useState<any>(null)
  const [loadingTemplate, setLoadingTemplate] = useState(false)
  const [modalView, setModalView] = useState<DayTimelineModalView>('details')
  const isMobile =
    typeof navigator !== 'undefined' &&
    /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  const handlePhoneClick = () => {
    if (isMobile) setShowPhoneActions((prev) => !prev)
  }

  const initialShown = useRef(false)
  // Store saved notes in ref to preserve them after refresh
  const savedNotesRef = useRef<{ appointmentId: number; notes: string } | null>(null)

  // Fetch template when selected appointment changes
  useEffect(() => {
    if (selected?.clientId) {
      setLoadingTemplate(true)
      fetchJson(`${API_BASE_URL}/appointment-templates?clientId=${selected.clientId}`)
        .then((templates: any[]) => {
          // If appointment has templateId, use it directly; otherwise fall back to matching
          let match: any = null
          if (selected.templateId) {
            match = templates.find((t: any) => t.id === selected.templateId)
          }
          // Fall back to matching by address, type, and size if templateId not found or not available
          if (!match) {
            match = templates.find(
              (t: any) => 
                t.address === selected.address && 
                t.type === selected.type && 
                (t.size || '') === (selected.size || '')
            )
          }
          if (match) {
            setTemplate(match)
          } else {
            setTemplate(null)
          }
        })
        .catch(() => {
          setTemplate(null)
        })
        .finally(() => setLoadingTemplate(false))
    } else {
      setTemplate(null)
    }
  }, [selected?.clientId, selected?.templateId, selected?.address, selected?.type, selected?.size])

  useEffect(() => {
    setShowPhoneActions(false)
    // Reset editing notes when selection changes
    setEditingNotes(false)
    setEditingNotesValue('')
  }, [selected, template])

  useEffect(() => {
    if (!initialShown.current && initialApptId && appointments.length) {
      const match = appointments.find((a) => a.id === initialApptId)
      if (match) {
        setSelected(match)
        initialShown.current = true
      }
    }
  }, [initialApptId, appointments])

  // Scroll to appointment when scrollToApptId is set
  useEffect(() => {
    if (!scrollToApptId || !scrollRef || typeof scrollRef === 'function' || !scrollRef.current) {
      return
    }
    
    // Wait a bit for appointments to load if they're not loaded yet
    const timeoutId = setTimeout(() => {
      const match = appointments.find((a) => a.id === scrollToApptId)
      if (!match || !scrollRef || typeof scrollRef === 'function' || !scrollRef.current) {
        return
      }

      // Calculate scroll position based on appointment time
      const [h, m] = match.time.split(':').map((n) => parseInt(n, 10))
      const startMinutes = h * 60 + m
      const topPosition = (startMinutes / 60) * 84
      
      // Scroll to the appointment with some offset from top
      const scrollContainer = scrollRef.current
      if (scrollContainer) {
        // Scroll to position, offset by ~200px from top to leave some space
        scrollContainer.scrollTo({
          top: Math.max(0, topPosition - 200),
          behavior: 'smooth',
        })
      }
    }, 300) // Small delay to allow appointments to load after date change

    return () => clearTimeout(timeoutId)
  }, [scrollToApptId, appointments, scrollRef])

  const updateAppointment = async (data: {
    status?: Appointment['status']
    observe?: boolean
  }) => {
    if (!selected) return
    const url = `${API_BASE_URL}/appointments/${selected.id}`
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '1',
      },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      const updated = await res.json()
      onUpdate?.(updated)
      setSelected(null)
    } else {
      await alert('Failed to update appointment')
    }
  }

  // Recurring appointment handlers
  const [showMoveModal, setShowMoveModal] = useState(false)
  const [moveDate, setMoveDate] = useState('')
  const [moveTime, setMoveTime] = useState('')
  const [showPastDateConfirm, setShowPastDateConfirm] = useState(false)
  const [pendingMoveData, setPendingMoveData] = useState<{ date: string; time: string } | null>(null)
  const [showSkipConfirm, setShowSkipConfirm] = useState(false)
  const [showConfirmConfirm, setShowConfirmConfirm] = useState(false)
  const [skipAppointment, setSkipAppointment] = useState<Appointment | null>(null)
  const [confirmAppointment, setConfirmAppointment] = useState<Appointment | null>(null)

  const handleConfirmRecurring = () => {
    if (selected) {
      setConfirmAppointment(selected)
      setShowConfirmConfirm(true)
    }
  }

  const executeConfirmRecurring = async () => {
    if (!confirmAppointment?.id) return
    setShowConfirmConfirm(false)
    const res = await fetch(`${API_BASE_URL}/recurring/appointments/${confirmAppointment.id}/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '1',
      },
    })
    if (res.ok) {
      const updated = await res.json()
      onUpdate?.(updated)
      setSelected(null) // Close details modal
      setConfirmAppointment(null)
      // Removed date navigation - only Move button should navigate
      onRefresh?.()
    } else {
      const errorData = await res.json().catch(() => ({}))
      await alert(errorData.error || 'Failed to confirm appointment')
    }
  }

  const cancelConfirm = () => {
    setShowConfirmConfirm(false)
    setConfirmAppointment(null)
    // Details modal stays open
  }

  const handleSkipRecurring = () => {
    if (selected) {
      setSkipAppointment(selected)
      setSelected(null) // Close details modal
      setShowSkipConfirm(true) // Show skip confirmation
    }
  }

  const executeSkipRecurring = async () => {
    if (!skipAppointment?.id) return
    setShowSkipConfirm(false)
    const res = await fetch(`${API_BASE_URL}/recurring/appointments/${skipAppointment.id}/skip`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '1',
      },
    })
    if (res.ok) {
      const data = await res.json()
      onUpdate?.(skipAppointment)
      setSkipAppointment(null)
      // Removed date navigation - only Move button should navigate
      onRefresh?.()
    } else {
      const errorData = await res.json().catch(() => ({}))
      await alert(errorData.error || 'Failed to skip appointment')
    }
  }

  const cancelSkip = () => {
    setShowSkipConfirm(false)
    if (skipAppointment) {
      setSelected(skipAppointment) // Reopen details modal
      setSkipAppointment(null)
    }
  }

  const handleMoveRecurring = async () => {
    if (!selected?.id || !moveDate || !moveTime) return
    
    // Check if date is in the past
    const selectedDate = new Date(moveDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    selectedDate.setHours(0, 0, 0, 0)
    if (selectedDate < today) {
      // Show confirmation modal in front of details modal
      setPendingMoveData({ date: moveDate, time: moveTime })
      setShowPastDateConfirm(true)
      return
    }
    
    await executeMoveRecurring(moveDate, moveTime)
  }

  const executeMoveRecurring = async (date: string, time: string) => {
    if (!selected?.id) return
    
    const res = await fetch(`${API_BASE_URL}/recurring/appointments/${selected.id}/move`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '1',
      },
      body: JSON.stringify({ newDate: date, newTime: time }),
    })
    if (res.ok) {
      const updated = await res.json()
      onUpdate?.(updated)
      setShowMoveModal(false)
      setMoveDate('')
      setMoveTime('')
      setShowPastDateConfirm(false)
      setPendingMoveData(null)
      setSelected(null)
      
      // Navigate to the new date when moving
      const dateStr = date
      const dateParts = typeof dateStr === 'string' ? dateStr.split('T')[0].split('-') : null
      if (dateParts && dateParts.length === 3 && onNavigateToDate) {
        const nextDate = new Date(
          parseInt(dateParts[0]),
          parseInt(dateParts[1]) - 1,
          parseInt(dateParts[2])
        )
        onNavigateToDate(nextDate)
        onRefresh?.()
      }
    } else {
      const errorData = await res.json().catch(() => ({}))
      await alert(errorData.error || 'Failed to move appointment')
    }
  }

  const handleRecurringSettings = () => {
    if (selected?.familyId) {
      navigate(`/dashboard/recurring?familyId=${selected.familyId}`)
      setSelected(null)
    }
  }

  const handleViewClient = () => {
    if (selected?.clientId) {
      navigate(`/dashboard/clients/${selected.clientId}`)
      setSelected(null)
    }
  }

  const handleSave = async () => {
    if (!selected) return
    const url = `${API_BASE_URL}/appointments/${selected.id}`
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '1',
      },
      body: JSON.stringify({
        paid,
        paymentMethod: paid ? (paymentMethod || 'CASH') : 'CASH',
        paymentMethodNote:
          paid && paymentMethod === 'OTHER' && otherPayment ? otherPayment : undefined,
        tip: paid ? parseFloat(tip) || 0 : 0,
        observation: selected.observe ? observation : undefined,
      }),
    })
    if (res.ok) {
      const updated = await res.json()
      onUpdate?.(updated)
      setSelected(null)
    } else {
      await alert('Failed to update appointment')
    }
  }

  const handleSendInfo = async () => {
    if (!selected) return
    
    // Check if appointment has a team assigned
    if (selected.noTeam || !selected.employees || selected.employees.length === 0) {
      await alert('Cannot send info: No team assigned to this appointment. Please add at least one team member before sending info.')
      return
    }
    
    const res = await fetch(
      `${API_BASE_URL}/appointments/${selected.id}/send-info`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '1',
        },
        body: JSON.stringify({ note }),
      },
    )
    if (res.ok) {
      const updated = (await res.json()) as Appointment
      onUpdate?.(updated)
      setSelected(updated)
      setShowSendInfo(false)
      setNote('')
    } else {
      const errorData = await res.json().catch(() => ({}))
      const errorMessage = errorData.error || 'Failed to send info'
      await alert(errorMessage)
    }
  }

  const openExtra = (
    empId: number,
    ex?: { id: number; name: string; amount: number },
  ) => {
    setExtraFor(empId)
    setExtraName(ex?.name || '')
    setExtraAmount(ex ? String(ex.amount) : '')
    setEditingExtraId(ex?.id ?? null)
  }

  const saveExtra = async () => {
    if (!selected || extraFor == null) return
    const amt = parseFloat(extraAmount) || 0
    if (editingExtraId) {
      const res = await fetch(
        `${API_BASE_URL}/payroll/extra/${editingExtraId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': '1',
          },
          body: JSON.stringify({
            name: extraName || 'Extra',
            amount: amt,
          }),
        },
      )
      if (res.ok) {
        setSelected((curr) => {
          if (!curr) return curr
          const items = curr.payrollItems ? [...curr.payrollItems] : []
          let item = items.find((p) => p.employeeId === extraFor)
          if (item) {
            item.extras = item.extras.map((ex) =>
              ex.id === editingExtraId ? { ...ex, name: extraName || 'Extra', amount: amt } : ex,
            )
          }
          return { ...curr, payrollItems: items }
        })
      }
    } else {
      const res = await fetch(`${API_BASE_URL}/payroll/extra`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '1',
        },
        body: JSON.stringify({
          appointmentId: selected.id,
          employeeId: extraFor,
          name: extraName || 'Extra',
          amount: amt,
        }),
      })
      if (res.ok) {
        const ex = await res.json()
        setSelected((curr) => {
          if (!curr) return curr
          const items = curr.payrollItems ? [...curr.payrollItems] : []
          let item = items.find((p) => p.employeeId === extraFor)
          if (!item) {
            item = { employeeId: extraFor, extras: [] }
            items.push(item)
          }
          if (!item.extras.some((e) => e.id === ex.id)) {
            item.extras = [...item.extras, { id: ex.id, name: ex.name, amount: ex.amount }]
          }
          return { ...curr, payrollItems: items }
        })
      }
    }
    setExtraFor(null)
    setExtraName('')
    setExtraAmount('')
    setEditingExtraId(null)
  }

  const deleteExtra = async (id: number, empId: number) => {
    await fetch(`${API_BASE_URL}/payroll/extra/${id}`, {
      method: 'DELETE',
      headers: { 'ngrok-skip-browser-warning': '1' },
    })
    setSelected((curr) => {
      if (!curr) return curr
      const items = curr.payrollItems ? [...curr.payrollItems] : []
      const item = items.find((p) => p.employeeId === empId)
      if (item) {
        item.extras = item.extras.filter((ex) => ex.id !== id)
      }
      return { ...curr, payrollItems: items }
    })
  }

  useEffect(() => {
    if (!selected) return
    setPaid(Boolean(selected.paid))
    setPaymentMethod(selected.paymentMethod ?? '')
    
    // Fetch recurrence rule if this is an unconfirmed recurring appointment
    const isRecurringUnconfirmed = selected.status === 'RECURRING_UNCONFIRMED' && !!selected.familyId
    if (isRecurringUnconfirmed && selected.familyId) {
      fetchJson(`${API_BASE_URL}/recurring/${selected.familyId}`)
        .then((data: any) => {
          if (data.ruleSummary) {
            setRecurrenceRule(data.ruleSummary)
          } else {
            setRecurrenceRule(null)
          }
        })
        .catch((err) => {
          console.error('Failed to fetch recurrence rule:', err)
          setRecurrenceRule(null)
        })
    } else {
      setRecurrenceRule(null)
    }
    setTip(selected.tip != null ? String(selected.tip) : '')
    setOtherPayment('')
    setObservation(selected.observation ?? '')
  }, [selected])

  // Disable body scroll when modal is open
  useEffect(() => {
    if (selected) {
      const original = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = original
      }
    }
  }, [selected])

  // Measure offsets for the overlay when modal opens
  useEffect(() => {
    if (!selected) return
    const topEl = document.querySelector('div.sticky.top-0') as HTMLElement | null
    const bottomEl = document.querySelector('nav.fixed.bottom-0') as HTMLElement | null
    let t = 0
    if (topEl) {
      const pos = getComputedStyle(topEl).position
      if (pos === 'sticky' || pos === 'fixed') {
        t = topEl.offsetHeight
      }
    }

    let b = 0
    if (bottomEl && getComputedStyle(bottomEl).position === 'fixed') {
      b = bottomEl.offsetHeight
    }
    setOverlayTop(t)
    setOverlayHeight(window.innerHeight - t - b)
  }, [selected])

  // calculate pay rates when modal opens
  useEffect(() => {
    if (!selected || !selected.employees || selected.employees.length === 0) {
      setPayRate(null)
      setCarpetRate(null)
      return
    }

    setPayRate(
      calcPayRate(selected.type, selected.size ?? null, selected.employees.length),
    )

    const rooms = (selected as any).carpetRooms
    const carpetIds = (selected as any).carpetEmployees?.length
    if (rooms && carpetIds) {
      setCarpetRate(
        calcCarpetRate(selected.size ?? null, rooms) / carpetIds,
      )
    } else {
      setCarpetRate(null)
    }
  }, [selected])

  // 4rem + 0.5rem in px (assuming 16px base font-size)
  const dividerPx = 4 * 16 + 0.5 * 16
  const LANE_GAP = 8 // space between appointment columns in pixels
  const apptWidth = '40vw'
  let baseWidth = `calc(${dividerPx}px + 40vw)`

  type Layout = {
    appt: Appointment
    start: number
    end: number
    lane: number
  }

  const events: Layout[] = appointments
    .filter((a) => a.status !== 'DELETED')
    .map((a) => {
      const [h, m] = a.time.split(':').map((n) => parseInt(n, 10))
      const start = h * 60 + m
      const displayHours = a.hours ?? calculateAppointmentHours(a.size ?? null, a.type) ?? 3
      const end = start + displayHours * 60
      return { appt: a, start, end, lane: 0 }
    })
    .sort((a, b) => a.start - b.start)

  const active: Layout[] = []
  const layout: Layout[] = []
  let maxLane = 0

  for (const e of events) {
    // remove ended events
    for (let i = active.length - 1; i >= 0; i--) {
      if (active[i].end <= e.start) active.splice(i, 1)
    }

    let lane = 0
    while (active.some((a) => a.lane === lane)) lane++

    e.lane = lane
    if (lane + 1 > maxLane) maxLane = lane + 1
    active.push(e)
    layout.push(e)
  }

  baseWidth = `calc(${dividerPx}px + ${maxLane} * (40vw + ${LANE_GAP}px))`
  const containerWidth =
    layout.length === 0 ? '100%' : `max(100%, ${baseWidth})`
  const rightEdge = containerWidth

  return (
    <div
      ref={scrollRef}
      className={`flex-1 relative ${animating || selected ? 'overflow-hidden' : 'overflow-x-auto overflow-hidden'}`}
    >
      <div className="relative divide-y" style={{ width: containerWidth, minWidth: '100%' }}>
        {/* divider line */}
        <div
          className="absolute top-0 bottom-0 w-px bg-gray-300 pointer-events-none"
          style={{ left: dividerPx }}
        />

        {/* right edge marker */}
        <div
          className="absolute top-0 bottom-0 w-px bg-gray-300 pointer-events-none"
          style={layout.length === 0 ? { right: 0 } : { left: rightEdge }}
        />

        {/* hours grid */}
        {Array.from({ length: 24 }).map((_, i) => (
          <div key={i} className="h-[84px] grid grid-cols-[4rem_1fr] px-2">
            <div className="text-xs text-gray-500 pr-2 flex items-start justify-end">
              {new Date(0, 0, 0, i).toLocaleString('en-US', {
                hour: 'numeric',
                hour12: true,
              })}
            </div>
            <div />
          </div>
        ))}

        {/* appointment blocks */}
        {layout.map((l, idx) => {
          const top = (l.start / 60) * 84
          const height = ((l.end - l.start) / 60) * 84 - 2
          const leftStyle = `calc(${dividerPx}px + 8px + ${l.lane} * (40vw + ${LANE_GAP}px))`
          // Convert UTC date from server to local date for display
          // Server stores dates as UTC, we display in user's local timezone
          const apptDate = typeof l.appt.date === 'string' ? new Date(l.appt.date) : l.appt.date
          const [year, month, day] = [
            apptDate.getFullYear(),
            apptDate.getMonth() + 1,
            apptDate.getDate()
          ];

          // 2) pull out the hour/minute
          const [sh, sm] = l.appt.time.split(':').map((n) => parseInt(n, 10));


          // Unconfirmed recurring appointments are always blue
          let bg = 'bg-red-200 border-red-400'
          if (l.appt.status === 'RECURRING_UNCONFIRMED') {
            bg = 'bg-blue-200 border-blue-400'
          } else if (l.appt.paid) {
            bg = 'bg-green-200 border-green-400'
          } else if (l.appt.status === 'CANCEL') {
            bg = 'bg-gray-200 border-gray-400'
          } else if (l.appt.observe) {
            bg = 'bg-yellow-200 border-yellow-400'
          }
          return (
            <div
              key={l.appt.id ?? idx}
              className={`absolute border rounded-md text-xs overflow-hidden cursor-pointer ${bg}`}
              style={{ top, left: leftStyle, width: apptWidth, height, zIndex: 10 }}
              onClick={() => {
                setSelected(l.appt)
                setModalView('details')
              }}
            >
              <div className="flex justify-between items-start p-1">
                <div className="pr-1 overflow-hidden flex-1">
                  <div className="font-medium truncate">
                    {l.appt.client?.name || 'Client'}
                  </div>
                  {l.appt.client?.number && (
                    <div className="text-[10px] leading-tight">
                      {formatPhone(l.appt.client.number)}
                    </div>
                  )}
                </div>
                <div
                  className={`w-3 h-3 rounded-sm ${l.appt.noTeam ? 'bg-purple-500' : l.appt.infoSent ? 'bg-green-500' : 'bg-red-500'}`}
                />
              </div>
              <div className="px-1 pb-1">{l.appt.type}</div>
              <div className="px-1 pb-1 border-t border-gray-300 text-[10px] leading-tight">
                {l.appt.employees && l.appt.employees.length > 0 ? (
                  l.appt.employees.map((e) => (
                    <div key={e.id}>{e.name}</div>
                  ))
                ) : (
                  <div>no team</div>
                )}
              </div>
            </div>
          )
        })}

        {/* “now” indicator (inside scroll container, forced red) */}
        {nowOffset != null && (
          <div
          className="absolute left-0 right-0 h-[2px] bg-red-500 border-0 z-30 pointer-events-none"
          style={{ top: nowOffset }}
        />
        )}
      </div>

      {/* Appointment modal: details or team-options, single overlay via DayTimelineModalContainer */}
      {selected && createPortal(
        <DayTimelineModalContainer
          view={modalView}
          appointment={selected}
          onUpdate={(updated) => {
            onUpdate?.(updated)
            setSelected(updated)
          }}
          onClose={() => {
            setSelected(null)
            setModalView('details')
          }}
          onViewChange={setModalView}
          onCreate={onCreate!}
          onEdit={onEdit!}
          onRescheduled={onRescheduled ? (newAppt) => { setSelected(null); setModalView('details'); onRescheduled(newAppt); } : undefined}
          onNavigateToDate={onNavigateToDate}
          onRefresh={onRefresh}
          onRequestSkip={() => {
            if (selected) {
              setSkipAppointment(selected)
              setShowSkipConfirm(true)
            }
          }}
          onRequestConfirm={() => {
            if (selected) {
              setConfirmAppointment(selected)
              setShowConfirmConfirm(true)
            }
          }}
        />,
        document.body
      )}

      {/* Skip Confirmation Modal - wrapper z-[10100] so it appears above view appointment details (10000) */}
      {showSkipConfirm && skipAppointment && createPortal(
        <div
          className="fixed inset-0 flex items-center justify-center p-4 z-[10100]"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="absolute inset-0 bg-black/50"
            onClick={cancelSkip}
            aria-hidden="true"
          />
          <div
            className="relative bg-white rounded-xl shadow-lg border-2 border-slate-200 max-w-md w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800">Skip Recurring Appointment?</h3>
            </div>
            <div className="p-4">
              <p className="text-sm text-slate-600 mb-4">
                This appointment will be marked as canceled and the next one will be generated.
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={cancelSkip}
                  className="px-4 py-2 text-sm font-medium bg-slate-200 text-slate-800 rounded-lg hover:bg-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={executeSkipRecurring}
                  className="px-4 py-2 text-sm font-medium bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
                >
                  Skip
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Confirm Confirmation Modal - wrapper z-[10100] so it appears above view appointment details (10000) */}
      {showConfirmConfirm && confirmAppointment && createPortal(
        <div
          className="fixed inset-0 flex items-center justify-center p-4 z-[10100]"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="absolute inset-0 bg-black/50"
            onClick={cancelConfirm}
            aria-hidden="true"
          />
          <div
            className="relative bg-white rounded-xl shadow-lg border-2 border-slate-200 max-w-md w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800">Confirm Recurring Appointment?</h3>
            </div>
            <div className="p-4">
              <p className="text-sm text-slate-600 mb-4">
                This appointment will be confirmed and the next unconfirmed appointment will be generated.
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={cancelConfirm}
                  className="px-4 py-2 text-sm font-medium bg-slate-200 text-slate-800 rounded-lg hover:bg-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={executeConfirmRecurring}
                  className="px-4 py-2 text-sm font-medium bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Past Date Confirmation Modal - wrapper z-[10100] so it appears above view appointment details (10000) */}
      {showPastDateConfirm && pendingMoveData && createPortal(
        <div
          className="fixed inset-0 flex items-center justify-center p-4 z-[10100]"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              setShowPastDateConfirm(false)
              setPendingMoveData(null)
            }}
            aria-hidden="true"
          />
          <div
            className="relative bg-white rounded-xl shadow-lg border-2 border-slate-200 max-w-md w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800">Move to Past Date?</h3>
            </div>
            <div className="p-4">
              <p className="text-sm text-slate-600 mb-4">
                The selected date is in the past. Are you sure you want to move the appointment to this date?
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowPastDateConfirm(false)
                    setPendingMoveData(null)
                  }}
                  className="px-4 py-2 text-sm font-medium bg-slate-200 text-slate-800 rounded-lg hover:bg-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (pendingMoveData) {
                      executeMoveRecurring(pendingMoveData.date, pendingMoveData.time)
                    }
                  }}
                  className="px-4 py-2 text-sm font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Move
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

interface Props {
  nowOffset: number | null
  prevDay: () => void
  nextDay: () => void
  appointments: Appointment[]
  prevAppointments: Appointment[]
  nextAppointments: Appointment[]
  initialApptId?: number
  scrollToApptId?: number
  selectedDate: Date
  onUpdate?: (a: Appointment) => void
  onCreate?: (appt: Appointment, status: Appointment['status']) => void
  onEdit?: (appt: Appointment) => void
  onRescheduled?: (newAppointment: Appointment) => void
  onNavigateToDate?: (date: Date) => void
  onRefresh?: () => void
}

export default function DayTimeline({
  nowOffset,
  prevDay,
  nextDay,
  appointments,
  prevAppointments,
  nextAppointments,
  initialApptId,
  scrollToApptId,
  selectedDate,
  onUpdate,
  onCreate,
  onEdit,
  onRescheduled,
  onNavigateToDate,
  onRefresh,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const currentDayRef = useRef<HTMLDivElement | null>(null)
  const touchStartX = useRef<number | null>(null)
  const isPaging = useRef(false)
  const [dragDelta, setDragDelta] = useState(0)
  const [baseOffset, setBaseOffset] = useState(0)
  const [animating, setAnimating] = useState(false)
  const lastSelectedDateRef = useRef<string>('')

  // Reset baseOffset when selected date changes externally or window resizes
  // This ensures the displayed day always matches the selected date in the header
  useLayoutEffect(() => {
    if (!containerRef.current) return
    const w = containerRef.current.offsetWidth
    const selectedDateStr = selectedDate.toDateString()
    
    // Reset to center position when selected date changed externally
    // (e.g., from WeekSelector/MonthSelector click, not from swipe navigation)
    // Only reset if not currently animating (to avoid interrupting swipe animations)
    if (lastSelectedDateRef.current !== selectedDateStr && !animating) {
      setBaseOffset(-w)
      setDragDelta(0)
      setAnimating(false)
      lastSelectedDateRef.current = selectedDateStr
    }
  }, [selectedDate, animating])

  // Also reset baseOffset when appointments change to ensure sync
  useLayoutEffect(() => {
    if (!containerRef.current) return
    const w = containerRef.current.offsetWidth
    // Reset to center when appointments are reloaded
    // This handles cases where appointments update but selectedDate hasn't changed yet
    if (!animating) {
      setBaseOffset(-w)
      setDragDelta(0)
      setAnimating(false)
    }
  }, [appointments, prevAppointments, nextAppointments, animating])

  // Handle window resize to fix multiple days being visible
  useEffect(() => {
    if (!containerRef.current) return
    const handleResize = () => {
      if (!containerRef.current || animating) return
      const w = containerRef.current.offsetWidth
      setBaseOffset(-w)
      setDragDelta(0)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [animating])

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    isPaging.current = false
    setDragDelta(0)
    setAnimating(false)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return
    const diff = e.touches[0].clientX - touchStartX.current
    const dayEl = currentDayRef.current
    if (!dayEl) return
    const atLeft = dayEl.scrollLeft <= 0
    const atRight =
      dayEl.scrollLeft + dayEl.clientWidth >= dayEl.scrollWidth - 1

    if (!isPaging.current) {
      if ((diff > 0 && atLeft) || (diff < 0 && atRight)) {
        isPaging.current = true
      } else {
        touchStartX.current = e.touches[0].clientX
        return
      }
    }

    e.preventDefault()
    setDragDelta(diff)
  }

  const handleTouchEnd = () => {
    if (!isPaging.current || touchStartX.current == null || !containerRef.current) {
      touchStartX.current = null
      isPaging.current = false
      return
    }
    const w = containerRef.current.offsetWidth
    const threshold = w * 0.25
    const moved = dragDelta

    if (Math.abs(moved) > threshold) {
      setAnimating(true)
      setDragDelta(0)
      if (moved < 0) {
        // swipe left → next
        setBaseOffset(-2 * w)
        setTimeout(() => {
          nextDay()
        }, 300)
      } else {
        // swipe right → prev
        setBaseOffset(0)
        setTimeout(() => {
          prevDay()
        }, 300)
      }
    } else {
      setAnimating(true)
      setBaseOffset(-w)
      setDragDelta(0)
      setTimeout(() => {
        setAnimating(false)
      }, 300)
    }

    touchStartX.current = null
    isPaging.current = false
  }

  const style = {
    transform: `translateX(${baseOffset + dragDelta}px)`,
    transition: animating ? 'transform 0.3s ease' : undefined,
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-hidden relative touch-pan-x"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="flex w-[300%]" style={style}>
        <Day
          appointments={prevAppointments}
          nowOffset={nowOffset}
          animating={animating}
          onUpdate={onUpdate}
          onCreate={onCreate}
          onEdit={onEdit}
          onRescheduled={onRescheduled}
          onNavigateToDate={onNavigateToDate}
          onRefresh={onRefresh}
        />
        <Day
          appointments={appointments}
          nowOffset={nowOffset}
          scrollRef={currentDayRef}
          animating={animating}
          initialApptId={initialApptId}
          scrollToApptId={scrollToApptId}
          onUpdate={onUpdate}
          onCreate={onCreate}
          onEdit={onEdit}
          onRescheduled={onRescheduled}
          onNavigateToDate={onNavigateToDate}
          onRefresh={onRefresh}
        />
        <Day
          appointments={nextAppointments}
          nowOffset={nowOffset}
          animating={animating}
          onUpdate={onUpdate}
          onCreate={onCreate}
          onEdit={onEdit}
          onRescheduled={onRescheduled}
          onNavigateToDate={onNavigateToDate}
          onRefresh={onRefresh}
        />
      </div>
    </div>
  )
}

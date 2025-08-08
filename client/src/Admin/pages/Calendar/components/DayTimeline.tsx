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
import { API_BASE_URL } from '../../../../api'
import { useModal } from '../../../../ModalProvider'
import { formatPhone } from '../../../../formatPhone'

function parseSqft(s: string | null | undefined): number | null {
  if (!s) return null
  const parts = s.split('-')
  let n = parseInt(parts[1] || parts[0])
  if (isNaN(n)) n = parseInt(s)
  return isNaN(n) ? null : n
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
  onUpdate?: (a: Appointment) => void
  onCreate?: (appt: Appointment, status: Appointment['status']) => void
  onEdit?: (appt: Appointment) => void
}

function Day({ appointments, nowOffset, scrollRef, animating, initialApptId, onUpdate, onCreate, onEdit }: DayProps) {
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
  const isMobile =
    typeof navigator !== 'undefined' &&
    /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  const handlePhoneClick = () => {
    if (isMobile) setShowPhoneActions((prev) => !prev)
  }

  const initialShown = useRef(false)

  useEffect(() => {
    setShowPhoneActions(false)
  }, [selected])

  useEffect(() => {
    if (!initialShown.current && initialApptId && appointments.length) {
      const match = appointments.find((a) => a.id === initialApptId)
      if (match) {
        setSelected(match)
        initialShown.current = true
      }
    }
  }, [initialApptId, appointments])

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
      await alert('Failed to send info')
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
      const end = start + (a.hours ?? 1) * 60
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
      className={`flex-1 relative ${animating || selected ? 'overflow-hidden' : 'overflow-x-auto overflow-y-auto'}`}
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
          // 1) pull out the YYYY-MM-DD as numbers, ignoring any timezone
          const [year, month, day] = l.appt.date.slice(0, 10).split('-').map(Number);

          // 2) pull out the hour/minute
          const [sh, sm] = l.appt.time.split(':').map((n) => parseInt(n, 10));


          let bg = 'bg-red-200 border-red-400'
          if (l.appt.paid) {
            bg = 'bg-green-200 border-green-400'
          }
          if (l.appt.status === 'CANCEL') {
            bg = 'bg-purple-200 border-purple-400'
          }
          if (l.appt.observe) {
            bg = 'bg-yellow-200 border-yellow-400'
          }
          return (
            <div
              key={l.appt.id ?? idx}
              className={`absolute border rounded-md text-xs overflow-hidden cursor-pointer ${bg}`}
              style={{ top, left: leftStyle, width: apptWidth, height, zIndex: 10 }}
              onClick={() => {
                setSelected(l.appt)
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

      {/* details modal */}
      {selected &&
        createPortal(
          <div
            className="fixed inset-x-0 bg-black/50 flex items-center justify-center z-40 p-2 overflow-hidden"
            style={{ top: overlayTop, height: overlayHeight }}
            onClick={() => setSelected(null)}
          >
            <div
              className="bg-white p-4 rounded space-y-2 w-full max-w-md max-h-full overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
            <div className="flex justify-between items-center">
              <div>
                <h4 className="font-medium">
                  {selected.client ? selected.client.name : 'Client'}
                </h4>
                {selected.client?.number && (
                  <>
                    <div className="text-sm text-gray-600">
                      {isMobile ? (
                        <button
                          type="button"
                          className="underline text-blue-500"
                          onClick={handlePhoneClick}
                        >
                          {formatPhone(selected.client.number)}
                        </button>
                      ) : (
                        formatPhone(selected.client.number)
                      )}
                    </div>
                    {isMobile && showPhoneActions && (
                      <div className="flex gap-2 mt-1">
                        <a
                          href={`tel:${selected.client.number}`}
                          className="px-2 py-1 bg-blue-500 text-white rounded"
                          onClick={() => setShowPhoneActions(false)}
                        >
                          Call
                        </a>
                        <a
                          href={`sms:${selected.client.number}`}
                          className="px-2 py-1 bg-blue-500 text-white rounded"
                          onClick={() => setShowPhoneActions(false)}
                        >
                          Text
                        </a>
                      </div>
                    )}
                  </>
                )}
                {selected.client?.from && (
                  <div className="text-sm text-gray-600">From: {selected.client.from}</div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  className="text-sm text-blue-500"
                  onClick={() => {
                    const appt = selected!
                    setSelected(null)
                    onEdit?.(appt)
                  }}
                >
                  Edit
                </button>
                <button onClick={() => setSelected(null)}>X</button>
              </div>
            </div>
            <div className="text-sm">Address: {selected.address}</div>
            <div className="text-sm">Type: {selected.type}</div>
            {selected.admin && (
              <div className="text-sm">
                Admin: {selected.admin.name ?? selected.admin.email}
              </div>
            )}
            <div className="text-sm">Date &amp; Time: {selected.date.slice(0, 10)} {selected.time}</div>
            {selected.employees && selected.employees.length > 0 && (
              <div className="text-sm">
                Team:
                <ul className="pl-4 list-disc">
                  {selected.employees.map((e) => {
                    const carpetIds = ((selected as any).carpetEmployees || []) as number[]
                    const onCarpet = carpetIds.includes(e.id!)
                    const base =
                      payRate ??
                      calcPayRate(
                        selected.type,
                        selected.size ?? null,
                        selected.employees.length,
                      )
                    const carpet =
                      onCarpet &&
                      (carpetRate ??
                        (calcCarpetRate(
                          selected.size ?? null,
                          (selected as any).carpetRooms || 0,
                        ) /
                          (carpetIds.length || 1)))
                    const extras =
                      selected.payrollItems?.find((p) => p.employeeId === e.id)?.extras || []
                    return (
                      <li key={e.id}>
                        {e.name}{' '}
                        {e.experienced ? <span className="font-bold">(Exp)</span> : null}
                        <span className="ml-1 text-sm text-gray-600">
                          ${base.toFixed(2)}
                          {onCarpet && carpet ? (
                            <>
                              {' + $'}
                              {carpet.toFixed(2)} {'= $'}
                              {(base + carpet).toFixed(2)}
                            </>
                          ) : null}
                        </span>
                        <button
                          className="text-blue-500 text-xs ml-2"
                          onClick={() => openExtra(e.id!)}
                        >
                          Add extra
                        </button>
                        {extras.map((ex) => (
                          <div key={ex.id} className="pl-4 flex items-start relative">
                            <div className="absolute left-0 top-0 w-3 h-3 border-l border-b border-gray-400" />
                            <div className="ml-3 flex items-center">
                              {ex.name}: ${ex.amount.toFixed(2)}
                              <button
                                className="text-blue-500 text-xs ml-2"
                                onClick={() => openExtra(e.id!, ex)}
                              >
                                Edit
                              </button>
                              <button
                                className="text-red-500 text-xs ml-1"
                                onClick={() => deleteExtra(ex.id, e.id!)}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
            {selected.reoccurring && (
              <div className="text-sm">Recurring</div>
            )}
            {selected.size && <div className="text-sm">Size: {selected.size}</div>}
            {selected.hours != null && (
              <div className="text-sm">Hours: {selected.hours}</div>
            )}
            {selected.price != null && (
              <div className="text-sm">Price: ${selected.price}</div>
            )}
            {selected.cityStateZip && (
              <div className="text-sm">Instructions: {selected.cityStateZip}</div>
            )}
            {selected.notes && (
              <div className="text-sm">Notes: {selected.notes}</div>
            )}

            <div className="pt-2 border-t space-y-2">
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={paid}
                  onChange={(e) => setPaid(e.target.checked)}
                />
                Paid
              </label>
              {paid && (
                <div className="flex flex-col gap-1">
                  <label className="text-sm">Tip (optional)</label>
                  <input
                    type="number"
                    className="border p-2 rounded text-base"
                    placeholder="Tip"
                    value={tip}
                    onChange={(e) => setTip(e.target.value)}
                  />
                  <label className="text-sm">
                    Payment Method <span className="text-red-500">*</span>
                  </label>
                  <select
                    className="border p-2 rounded text-base"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  >
                    <option value="">Select payment method</option>
                    <option value="CASH">Cash</option>
                    <option value="ZELLE">Zelle</option>
                    <option value="VENMO">Venmo</option>
                    <option value="PAYPAL">Paypal</option>
                    <option value="OTHER">Other</option>
                  </select>
                  {paymentMethod === 'OTHER' && (
                    <input
                      className="border p-2 rounded text-base"
                      placeholder="Payment method"
                      value={otherPayment}
                      onChange={(e) => setOtherPayment(e.target.value)}
                    />
                  )}
                </div>
              )}
            </div>

            {selected.observe && (
              <div className="space-y-1">
                <label className="text-sm font-medium">Observation</label>
                <textarea
                  className="border p-2 rounded w-full text-base"
                  value={observation}
                  onChange={(e) => setObservation(e.target.value)}
                />
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <button className="px-4 py-1 bg-red-500 text-white rounded" onClick={() => setShowDelete(true)}>
                Delete
              </button>
              <button
                className="px-4 py-1 bg-purple-500 text-white rounded"
                onClick={() => {
                  if (selected?.status === 'CANCEL') {
                    updateAppointment({ status: 'APPOINTED' })
                  } else if (selected?.observe) {
                    updateAppointment({ status: 'CANCEL' })
                  } else {
                    setShowCancel(true)
                  }
                }}
              >
                {selected?.status === 'CANCEL' ? 'Uncancel' : 'Cancel'}
              </button>
              {selected?.observe ? (
                <>
                  <button
                    className="px-4 py-1 bg-yellow-500 text-white rounded"
                    onClick={() => updateAppointment({ observe: false })}
                  >
                    Unobserve
                  </button>
                  <button
                    className="px-4 py-1 bg-blue-500 text-white rounded"
                    onClick={() => {
                      const appt = selected!
                      setSelected(null)
                      onCreate?.(appt, 'RESCHEDULE_NEW')
                    }}
                  >
                    Reschedule
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="px-4 py-1 bg-yellow-500 text-white rounded"
                    onClick={() => updateAppointment({ observe: true })}
                  >
                    Observe
                  </button>
                  <button
                    className="px-4 py-1 bg-blue-500 text-white rounded"
                    onClick={() => {
                      const appt = selected!
                      setSelected(null)
                      onCreate?.(appt, 'RESCHEDULE_NEW')
                    }}
                  >
                    Reschedule
                  </button>
                  <button
                    className="px-4 py-1 bg-blue-500 text-white rounded disabled:opacity-50"
                    disabled={
                      paid && (!paymentMethod || (paymentMethod === 'OTHER' && !otherPayment))
                    }
                    onClick={() => {
                      const appt = selected!
                      setSelected(null)
                      onCreate?.(appt, 'REBOOK')
                    }}
                  >
                    Book Again
                  </button>
                </>
              )}
              {!selected?.noTeam && (
                <button
                  className="px-4 py-1 bg-indigo-500 text-white rounded"
                  onClick={() => setShowSendInfo(true)}
                >
                  Send Info
                </button>
              )}
              <button
                className="px-4 py-1 bg-green-600 text-white rounded"
                onClick={() => {
                  if (!selected) return
                  navigate(
                    `/dashboard/financing/invoice?date=${selected.date.slice(0, 10)}&appt=${selected.id}`,
                  )
                }}
              >
                Invoice
              </button>
              <button
                className="px-4 py-1 bg-green-500 text-white rounded disabled:opacity-50"
                disabled={paid && (!paymentMethod || (paymentMethod === 'OTHER' && !otherPayment))}
                onClick={handleSave}
              >
                Save
              </button>
            </div>

            {showDelete && (
              <div
                className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
                onClick={() => setShowDelete(false)}
              >
                <div
                  className="bg-white p-4 rounded space-y-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div>Delete this appointment?</div>
                  <div className="flex justify-end gap-2">
                    <button className="px-4 py-1 border rounded" onClick={() => setShowDelete(false)}>
                      No
                    </button>
                    <button
                      className="px-4 py-1 bg-red-500 text-white rounded"
                      onClick={() => {
                        if (selected) {
                          updateAppointment({ status: 'DELETED' })
                        }
                        setShowDelete(false)
                        setSelected(null)
                      }}
                    >
                      Yes
                    </button>
                  </div>
                </div>
              </div>
            )}
            {showCancel && (
              <div
                className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
                onClick={() => setShowCancel(false)}
              >
                <div
                  className="bg-white p-4 rounded space-y-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div>Cancel appointment?</div>
                  <div className="flex justify-end gap-2">
                    <button className="px-4 py-1 border rounded" onClick={() => setShowCancel(false)}>
                      No
                    </button>
                    <button
                      className="px-4 py-1 bg-purple-500 text-white rounded"
                      onClick={() => {
                        setShowCancel(false)
                        updateAppointment({ status: 'CANCEL' })
                      }}
                    >
                      Yes
                    </button>
                  </div>
                </div>
              </div>
            )}
            {showSendInfo && (
              <div
                className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
                onClick={() => setShowSendInfo(false)}
              >
                <div
                  className="bg-white p-4 rounded space-y-2 w-full max-w-md"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="font-medium">Send Appointment Info</div>
                  {selected && (
                    <div className="text-sm space-y-1">
                      <div>Appointment Date: {selected.date.slice(0, 10)}</div>
                      <div>Appointment Time: {selected.time}</div>
                      <div>Appointment Type: {selected.type}</div>
                      <div>Address: {selected.address}</div>
                    </div>
                  )}
                  {selected?.employees && (
                    <ul className="pl-4 list-disc text-sm">
                      {selected.employees.map((e) => {
                        const carpetIds = ((selected as any).carpetEmployees || []) as number[]
                        const onCarpet = carpetIds.includes(e.id!)
                        const base =
                          payRate ??
                          calcPayRate(
                            selected.type,
                            selected.size ?? null,
                            selected.employees.length,
                          )
                        const carpet =
                          onCarpet &&
                          (carpetRate ??
                            (calcCarpetRate(
                              selected.size ?? null,
                              (selected as any).carpetRooms || 0,
                            ) /
                              (carpetIds.length || 1)))
                        const extras =
                          selected.payrollItems?.find((p) => p.employeeId === e.id)?.extras || []
                        const extrasTotal = extras.reduce((sum, ex) => sum + ex.amount, 0)
                        const total = base + (carpet || 0) + extrasTotal
                        return (
                          <li key={e.id}>
                            {e.name} - $
                            {onCarpet && carpet ? (
                              `${base.toFixed(2)} + ${carpet.toFixed(2)}$${extrasTotal ? ` + ${extrasTotal.toFixed(2)}` : ''} = ${total.toFixed(2)}`
                            ) : extrasTotal ? (
                              `${base.toFixed(2)} + ${extrasTotal.toFixed(2)} = ${total.toFixed(2)}`
                            ) : (
                              total.toFixed(2)
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                  {selected?.cityStateZip && (
                    <div className="text-sm">Instructions: {selected.cityStateZip}</div>
                  )}
                  <textarea
                    className="w-full border p-2 rounded text-sm"
                    placeholder="Message note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <div className="flex justify-end gap-2">
                    <button className="px-4 py-1" onClick={() => setShowSendInfo(false)}>
                      Cancel
                    </button>
                    <button
                      className="px-4 py-1 bg-indigo-600 text-white rounded"
                      onClick={handleSendInfo}
                    >
                      Send
                    </button>
                  </div>
                </div>
              </div>
            )}
            {extraFor != null && (
              <div
                className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
                onClick={() => {
                  setExtraFor(null)
                  setEditingExtraId(null)
                }}
              >
                <div
                  className="bg-white p-4 rounded space-y-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="font-medium">{editingExtraId ? 'Edit Extra Item' : 'Add Extra Item'}</div>
                  <input
                    className="border p-2 rounded w-full"
                    placeholder="Name"
                    value={extraName}
                    onChange={(e) => setExtraName(e.target.value)}
                  />
                  <input
                    type="number"
                    className="border p-2 rounded w-full"
                    placeholder="Amount"
                    value={extraAmount}
                    onChange={(e) => setExtraAmount(e.target.value)}
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      className="px-4 py-1 border rounded"
                      onClick={() => {
                        setExtraFor(null)
                        setEditingExtraId(null)
                      }}
                    >
                      Cancel
                    </button>
                    <button className="px-4 py-1 bg-blue-500 text-white rounded" onClick={saveExtra}>
                      {editingExtraId ? 'Update' : 'Add'}
                    </button>
                  </div>
                </div>
              </div>
            )}
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
  onUpdate?: (a: Appointment) => void
  onCreate?: (appt: Appointment, status: Appointment['status']) => void
  onEdit?: (appt: Appointment) => void
}

export default function DayTimeline({
  nowOffset,
  prevDay,
  nextDay,
  appointments,
  prevAppointments,
  nextAppointments,
  initialApptId,
  onUpdate,
  onCreate,
  onEdit,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const currentDayRef = useRef<HTMLDivElement | null>(null)
  const touchStartX = useRef<number | null>(null)
  const isPaging = useRef(false)
  const [dragDelta, setDragDelta] = useState(0)
  const [baseOffset, setBaseOffset] = useState(0)
  const [animating, setAnimating] = useState(false)

  useLayoutEffect(() => {
    if (!containerRef.current) return
    const w = containerRef.current.offsetWidth
    setBaseOffset(-w)
    setDragDelta(0)
    setAnimating(false)
  }, [appointments, prevAppointments, nextAppointments])

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
        />
        <Day
          appointments={appointments}
          nowOffset={nowOffset}
          scrollRef={currentDayRef}
          animating={animating}
          initialApptId={initialApptId}
          onUpdate={onUpdate}
          onCreate={onCreate}
          onEdit={onEdit}
        />
        <Day
          appointments={nextAppointments}
          nowOffset={nowOffset}
          animating={animating}
          onUpdate={onUpdate}
          onCreate={onCreate}
          onEdit={onEdit}
        />
      </div>
    </div>
  )
}

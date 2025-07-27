import {
  useLayoutEffect,
  useRef,
  useState,
  useEffect,
  type Ref,
} from 'react'
import { createPortal } from 'react-dom'
import type { Appointment } from '../types'
import { API_BASE_URL } from '../../../../api'

interface DayProps {
  appointments: Appointment[]
  nowOffset: number | null
  scrollRef?: Ref<HTMLDivElement>
  animating: boolean
  onUpdate?: (a: Appointment) => void
  onCreate?: (appt: Appointment, status: Appointment['status']) => void
  onEdit?: (appt: Appointment) => void
}

function Day({ appointments, nowOffset, scrollRef, animating, onUpdate, onCreate, onEdit }: DayProps) {
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

  const updateAppointment = async (data: {
    status?: Appointment['status']
    observe?: boolean
  }) => {
    if (!selected) return
    let url = `${API_BASE_URL}/appointments/${selected.id}`
    if (selected.reoccurring) {
      const apply = confirm('Apply to all future occurrences?')
      if (apply) url += '?future=true'
    }
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
      alert('Failed to update appointment')
    }
  }
const handleSave = async () => {
  if (!selected) return
  let url = `${API_BASE_URL}/appointments/${selected.id}`
  if (selected.reoccurring) {
    const apply = confirm('Apply to all future occurrences?')
    if (apply) url += '?future=true'
  }
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
      }),
    })
    if (res.ok) {
      const updated = await res.json()
      onUpdate?.(updated)
      setSelected(null)
    } else {
      alert('Failed to update appointment')
    }
  }

  useEffect(() => {
    if (!selected) return
    setPaid(Boolean(selected.paid))
    setPaymentMethod(selected.paymentMethod ?? '')
    setTip(selected.tip != null ? String(selected.tip) : '')
    setOtherPayment('')
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
    if (!selected || !selected.size || !selected.employees || selected.employees.length === 0) {
      setPayRate(null)
      setCarpetRate(null)
      return
    }
    fetch(`${API_BASE_URL}/pay-rate?type=${selected.type}&size=${encodeURIComponent(selected.size)}&count=${selected.employees.length}`)
      .then((res) => res.json())
      .then((d) => setPayRate(d.rate))
      .catch(() => setPayRate(null))

    const rooms = (selected as any).carpetRooms
    const carpetIds = (selected as any).carpetEmployees?.length
    if (rooms && carpetIds) {
      fetch(`${API_BASE_URL}/carpet-rate?size=${encodeURIComponent(selected.size)}&rooms=${rooms}`)
        .then((res) => res.json())
        .then((d) => setCarpetRate(d.rate / carpetIds))
        .catch(() => setCarpetRate(null))
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
          const leftStyle = `calc(${dividerPx}px + ${l.lane} * (40vw + ${LANE_GAP}px))`
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
              className={`absolute border rounded text-xs overflow-hidden cursor-pointer ${bg}`}
              style={{ top, left: leftStyle, width: apptWidth, height, zIndex: 10 }}
              onClick={() => {
                setSelected(l.appt)
              }}
            >
              {l.appt.type}
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
                  <div className="text-sm text-gray-600">{selected.client.number}</div>
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
            <div className="text-sm">Date &amp; Time: {selected.date.slice(0, 10)} {selected.time}</div>
            {selected.employees && selected.employees.length > 0 && (
              <div className="text-sm">
                Team:
                <ul className="pl-4 list-disc">
                  {selected.employees.map((e) => (
                    <li key={e.id}>
                      {e.name}{' '}
                      {e.experienced ? <span className="font-bold">(Exp)</span> : null}
                      {payRate !== null && (
                        <span className="ml-1 text-sm text-gray-600">${payRate.toFixed(2)}</span>
                      )}
                      {carpetRate !== null && (
                        <span className="ml-1 text-sm text-gray-600">+ ${carpetRate.toFixed(2)} carpet</span>
                      )}
                    </li>
                  ))}
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

            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <button className="px-4 py-1 bg-red-500 text-white rounded" onClick={() => setShowDelete(true)}>
                Delete
              </button>
              <button
                className="px-4 py-1 bg-purple-500 text-white rounded"
                onClick={() =>
                  selected?.observe
                    ? updateAppointment({ status: 'CANCEL' })
                    : setShowCancel(true)
                }
              >
                Cancel
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

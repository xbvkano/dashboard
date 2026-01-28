import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { API_BASE_URL, fetchJson } from '../../../../api'
import { useModal } from '../../../../ModalProvider'
import { RecurrenceFamily } from '../index'
import RestartRecurrenceModal from './RestartRecurrenceModal'

interface Props {
  family: RecurrenceFamily
  onUpdate: () => void
  onBackToList?: () => void
}

export default function RecurringFamilyDetail({ family, onUpdate, onBackToList }: Props) {
  const { alert, confirm } = useModal()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [editingRule, setEditingRule] = useState(false)
  const [ruleType, setRuleType] = useState(family.rule?.type || 'weekly')
  const [interval, setInterval] = useState(family.rule?.interval || 1)
  const [dayOfWeek, setDayOfWeek] = useState(family.rule?.dayOfWeek)
  const [weekOfMonth, setWeekOfMonth] = useState(family.rule?.weekOfMonth)
  const [dayOfMonth, setDayOfMonth] = useState(family.rule?.dayOfMonth)
  const [showRestartModal, setShowRestartModal] = useState(false)
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set())
  const initializedRef = useRef<number | null>(null)
  
  // Initialize expanded months for months within the last month
  useEffect(() => {
    if (initializedRef.current !== family.id) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const oneMonthAgo = new Date(today)
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)

      const history = family.history || family.appointments || []
      const initialExpandedMonths = new Set<string>()
      
      history.forEach((appt: any) => {
        const apptDateUTC = typeof appt.date === 'string' ? new Date(appt.date) : appt.date
        const apptDate = new Date(
          apptDateUTC.getUTCFullYear(),
          apptDateUTC.getUTCMonth(),
          apptDateUTC.getUTCDate()
        )
        
        const year = apptDate.getFullYear()
        const month = String(apptDate.getMonth() + 1).padStart(2, '0')
        const monthKey = `${year}-${month}`
        
        apptDate.setHours(0, 0, 0, 0)
        if (apptDate >= oneMonthAgo) {
          initialExpandedMonths.add(monthKey)
        }
      })
      
      setExpandedMonths(initialExpandedMonths)
      initializedRef.current = family.id
    }
  }, [family.id, family.history, family.appointments])

  const handleUpdateRule = async () => {
    const rule: any = { type: ruleType }
    if (ruleType === 'weekly' || ruleType === 'biweekly' || ruleType === 'every3weeks') {
      rule.interval = interval
    } else if (ruleType === 'customMonths') {
      rule.interval = interval
    } else if (ruleType === 'monthlyPattern') {
      if (weekOfMonth && dayOfWeek !== undefined) {
        rule.weekOfMonth = weekOfMonth
        rule.dayOfWeek = dayOfWeek
      } else if (dayOfMonth) {
        rule.dayOfMonth = dayOfMonth
      }
    }

    try {
      await fetchJson(`${API_BASE_URL}/recurring/${family.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recurrenceRule: rule }),
      })
      setEditingRule(false)
      onUpdate()
    } catch (err) {
      await alert('Failed to update recurrence rule')
    }
  }

  const handleStopFamily = async () => {
    if (!(await confirm('Stop this recurrence family? No new appointments will be generated.'))) return
    try {
      await fetchJson(`${API_BASE_URL}/recurring/${family.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'stopped' }),
      })
      onUpdate()
    } catch (err) {
      await alert('Failed to stop recurrence family')
    }
  }

  const handleRestartFamily = () => {
    setShowRestartModal(true)
  }

  const handleDeleteFamily = async () => {
    if (!(await confirm(
      'Delete Recurrence Family\n\nAre you sure you want to delete this recurrence family? This action cannot be undone. The appointment history will be preserved, but the family and any unconfirmed appointments will be permanently removed.'
    ))) return

    try {
      await fetchJson(`${API_BASE_URL}/recurring/${family.id}`, {
        method: 'DELETE',
      })
      await alert('Recurrence family deleted successfully')
      // Navigate back to list view - onBackToList will handle refreshing the families list
      // Don't call onUpdate() here as it will try to reload the deleted family detail
      if (onBackToList) {
        onBackToList()
      } else {
        // Fallback to navigation if callback not provided
        setSearchParams({})
        navigate('/dashboard/recurring', { replace: true })
        // In fallback case, we need to refresh manually
        onUpdate()
      }
    } catch (err: any) {
      await alert(err.error || 'Failed to delete recurrence family')
    }
  }

  const history = family.history || family.appointments || []

  // Group appointments by month, then by date within each month
  const groupedHistory = useMemo(() => {
    if (!history || history.length === 0) {
      return {
        groupedByDate: new Map<string, any[]>(),
        groupedByMonth: new Map<string, string[]>(),
        sortedDates: [],
        sortedMonths: [],
        expandedMonths,
      }
    }

    // First group by date
    const groupedByDate = new Map<string, any[]>()
    
    history.forEach((appt: any) => {
      if (!appt || !appt.date) return
      
      // Convert UTC date from server to local date
      const apptDateUTC = typeof appt.date === 'string' ? new Date(appt.date) : appt.date
      const apptDate = new Date(
        apptDateUTC.getUTCFullYear(),
        apptDateUTC.getUTCMonth(),
        apptDateUTC.getUTCDate()
      )
      
      // Create date key (YYYY-MM-DD format)
      const year = apptDate.getFullYear()
      const month = String(apptDate.getMonth() + 1).padStart(2, '0')
      const day = String(apptDate.getDate()).padStart(2, '0')
      const dateKey = `${year}-${month}-${day}`
      
      if (!groupedByDate.has(dateKey)) {
        groupedByDate.set(dateKey, [])
      }
      groupedByDate.get(dateKey)!.push(appt)
    })

    // Sort dates descending
    const sortedDates = Array.from(groupedByDate.keys()).sort((a, b) => b.localeCompare(a))

    // Group dates by month
    const groupedByMonth = new Map<string, string[]>()
    
    sortedDates.forEach(dateKey => {
      const monthKey = dateKey.slice(0, 7) // YYYY-MM
      if (!groupedByMonth.has(monthKey)) {
        groupedByMonth.set(monthKey, [])
      }
      groupedByMonth.get(monthKey)!.push(dateKey)
    })

    // Sort months descending
    const sortedMonths = Array.from(groupedByMonth.keys()).sort((a, b) => b.localeCompare(a))

    return {
      groupedByDate,
      groupedByMonth,
      sortedDates,
      sortedMonths,
      expandedMonths,
    }
  }, [history, expandedMonths])

  const toggleMonth = (monthKey: string) => {
    setExpandedMonths(prev => {
      const next = new Set(prev)
      if (next.has(monthKey)) {
        next.delete(monthKey)
      } else {
        next.add(monthKey)
      }
      return next
    })
  }

  // Extract the latest move/reschedule note from appointment notes
  const getLatestMoveNote = (notes: string | null | undefined): string | null => {
    if (!notes) return null
    
    // Find all move/reschedule notes (they start with [Moved from or [Rescheduled from)
    const moveNotePattern = /\[(?:Moved from|Rescheduled from)[^\]]+\]/g
    const matches = notes.match(moveNotePattern)
    
    if (!matches || matches.length === 0) return null
    
    // Return the last one (most recent)
    return matches[matches.length - 1]
  }

  // Remove move/reschedule notes from appointment notes for display
  const cleanNotes = (notes: string | null | undefined): string | null => {
    if (!notes) return null
    
    // Remove all move/reschedule notes
    const cleaned = notes.replace(/\[(?:Moved from|Rescheduled from)[^\]]+\]\n?/g, '').trim()
    
    return cleaned || null
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-xl font-semibold">Recurrence Family Details</h3>
            <div className="text-sm text-gray-600 mt-1">
              Status: <span className={family.status === 'active' ? 'text-green-600' : 'text-red-600'}>
                {family.status === 'active' ? 'Active' : 'Stopped'}
              </span>
            </div>
          </div>
          {family.status === 'active' ? (
            <button
              onClick={handleStopFamily}
              className="px-3 py-2 bg-red-500 text-white rounded text-sm hover:bg-red-600"
            >
              Stop
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleRestartFamily}
                className="px-3 py-2 bg-green-500 text-white rounded text-sm hover:bg-green-600"
              >
                Restart
              </button>
              <button
                onClick={handleDeleteFamily}
                className="px-3 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {/* Client Information */}
          {(() => {
            const appointments = family.appointments || family.history || []
            const firstAppointment = appointments.find((a: any) => a.client) || appointments[0]
            const client = firstAppointment?.client
            if (client) {
              return (
                <div>
                  <h4 className="font-medium mb-2">Client Information</h4>
                  <div className="bg-gray-50 rounded-md p-3 space-y-1 text-sm">
                    <div>
                      <span className="font-medium">Name:</span> {client.name}
                    </div>
                    {client.number && (
                      <div>
                        <span className="font-medium">Phone:</span> {client.number}
                      </div>
                    )}
                    {client.email && (
                      <div>
                        <span className="font-medium">Email:</span> {client.email}
                      </div>
                    )}
                  </div>
                </div>
              )
            }
            return null
          })()}
          <div>
            <h4 className="font-medium mb-2">Recurrence Rule</h4>
            {!editingRule ? (
              <div>
                <p className="text-sm">{family.ruleSummary || 'No rule set'}</p>
                <button
                  onClick={() => setEditingRule(true)}
                  className="mt-2 text-sm text-blue-500 hover:text-blue-700"
                >
                  Edit Rule
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <select
                  value={ruleType}
                  onChange={(e) => setRuleType(e.target.value)}
                  className="w-full border p-2 rounded"
                >
                  <option value="weekly">Every week</option>
                  <option value="biweekly">Every 2 weeks</option>
                  <option value="every3weeks">Every 3 weeks</option>
                  <option value="monthly">Every month</option>
                  <option value="customMonths">Every X months</option>
                  <option value="monthlyPattern">Monthly pattern</option>
                </select>
                {(ruleType === 'weekly' || ruleType === 'biweekly' || ruleType === 'every3weeks' || ruleType === 'customMonths') && (
                  <input
                    type="number"
                    min="1"
                    value={interval}
                    onChange={(e) => setInterval(parseInt(e.target.value, 10) || 1)}
                    className="w-full border p-2 rounded"
                    placeholder="Interval"
                  />
                )}
                {ruleType === 'monthlyPattern' && (
                  <div className="space-y-2">
                    <select
                      value={weekOfMonth || ''}
                      onChange={(e) => setWeekOfMonth(parseInt(e.target.value, 10) || undefined)}
                      className="w-full border p-2 rounded"
                    >
                      <option value="">Select week</option>
                      <option value="1">First</option>
                      <option value="2">Second</option>
                      <option value="3">Third</option>
                      <option value="4">Fourth</option>
                      <option value="-1">Last</option>
                    </select>
                    <select
                      value={dayOfWeek || ''}
                      onChange={(e) => setDayOfWeek(parseInt(e.target.value, 10) || undefined)}
                      className="w-full border p-2 rounded"
                    >
                      <option value="">Select day</option>
                      <option value="0">Sunday</option>
                      <option value="1">Monday</option>
                      <option value="2">Tuesday</option>
                      <option value="3">Wednesday</option>
                      <option value="4">Thursday</option>
                      <option value="5">Friday</option>
                      <option value="6">Saturday</option>
                    </select>
                    <div className="text-sm text-gray-600">OR</div>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={dayOfMonth || ''}
                      onChange={(e) => setDayOfMonth(parseInt(e.target.value, 10) || undefined)}
                      className="w-full border p-2 rounded"
                      placeholder="Day of month (1-31)"
                    />
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={handleUpdateRule}
                    className="px-3 py-2 bg-green-500 text-white rounded text-sm hover:bg-green-600"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setEditingRule(false)
                      setRuleType(family.rule?.type || 'weekly')
                      setInterval(family.rule?.interval || 1)
                    }}
                    className="px-3 py-2 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {family.nextAppointmentDate && (
            <div>
              <h4 className="font-medium mb-2">Next Appointment Date</h4>
              <p className="text-sm">
                {new Date(family.nextAppointmentDate).toLocaleDateString()}
              </p>
            </div>
          )}

          {family.template && (
            <div>
              <h4 className="font-medium mb-2">Template</h4>
              <div className="bg-gray-50 rounded-md p-3 space-y-2 text-sm">
                <div>
                  <span className="font-medium">Name:</span> {family.template.name}
                </div>
                {family.template.type && (
                  <div>
                    <span className="font-medium">Type:</span> {family.template.type}
                  </div>
                )}
                {family.template.address && (
                  <div>
                    <span className="font-medium">Address:</span> {family.template.address}
                  </div>
                )}
                {family.template.size && (
                  <div>
                    <span className="font-medium">Size:</span> {family.template.size}
                  </div>
                )}
                {family.template.price !== null && family.template.price !== undefined && (
                  <div>
                    <span className="font-medium">Price:</span> ${family.template.price.toFixed(2)}
                  </div>
                )}
                {family.template.cityStateZip && (
                  <div>
                    <span className="font-medium">Instructions:</span> {family.template.cityStateZip}
                  </div>
                )}
                {family.template.notes && (
                  <div>
                    <span className="font-medium">Notes:</span> {family.template.notes}
                  </div>
                )}
                {(family.template.carpetRooms !== null && family.template.carpetRooms !== undefined) && (
                  <div>
                    <span className="font-medium">Carpet Rooms:</span> {family.template.carpetRooms}
                    {family.template.carpetPrice !== null && family.template.carpetPrice !== undefined && (
                      <span className="ml-2">(${family.template.carpetPrice.toFixed(2)})</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold mb-4">History</h3>
        <div className="space-y-2">
          {history.length === 0 ? (
            <p className="text-gray-500 text-sm">No appointments yet</p>
          ) : !groupedHistory || !groupedHistory.groupedByDate ? (
            <p className="text-gray-500 text-sm">Loading...</p>
          ) : groupedHistory.sortedMonths.length > 1 ? (
            // Show month grouping when history spans more than one month
            groupedHistory.sortedMonths.map((monthKey) => {
              const datesInMonth = groupedHistory.groupedByMonth.get(monthKey) || []
              const isMonthExpanded = groupedHistory.expandedMonths.has(monthKey)
              
              // Parse month for display
              const [year, month] = monthKey.split('-').map(Number)
              const monthDate = new Date(year, month - 1, 1)
              const monthName = monthDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
              
              // Count total appointments in this month
              const totalAppointments = datesInMonth.reduce((sum, dateKey) => {
                return sum + (groupedHistory.groupedByDate.get(dateKey)?.length || 0)
              }, 0)

              return (
                <div key={monthKey} className="border rounded">
                  <button
                    onClick={() => toggleMonth(monthKey)}
                    className="w-full px-3 py-2 bg-gray-100 hover:bg-gray-200 flex items-center justify-between text-left font-semibold"
                  >
                    <div className="font-medium text-base">
                      {monthName}
                    </div>
                    <div className="text-sm text-gray-600">
                      {totalAppointments} appointment{totalAppointments !== 1 ? 's' : ''} across {datesInMonth.length} day{datesInMonth.length !== 1 ? 's' : ''}
                      <span className="ml-2">{isMonthExpanded ? '▼' : '▶'}</span>
                    </div>
                  </button>
                  
                  {isMonthExpanded && (
                    <div className="p-2 space-y-2">
                      {datesInMonth.map((dateKey) => {
                        const appointments = groupedHistory.groupedByDate.get(dateKey) || []
                        
                        // Parse date for display
                        const [year, month, day] = dateKey.split('-').map(Number)
                        const displayDate = new Date(year, month - 1, day)
                        const today = new Date()
                        today.setHours(0, 0, 0, 0)
                        displayDate.setHours(0, 0, 0, 0)
                        const isToday = displayDate.getTime() === today.getTime()
                        const dateDisplay = displayDate.toLocaleDateString(undefined, { 
                          weekday: 'short', 
                          year: 'numeric', 
                          month: 'short', 
                          day: 'numeric' 
                        })

                        return (
                          appointments.map((appt: any) => {
                            // Convert UTC date from server to local date for display
                            const apptDateUTC = typeof appt.date === 'string' ? new Date(appt.date) : appt.date
                            const apptDate = new Date(
                              apptDateUTC.getUTCFullYear(),
                              apptDateUTC.getUTCMonth(),
                              apptDateUTC.getUTCDate()
                            )
                            
                            const today = new Date()
                            today.setHours(0, 0, 0, 0)
                            apptDate.setHours(0, 0, 0, 0)
                            const isMissed = appt.status === 'RECURRING_UNCONFIRMED' && apptDate < today
                            const isRescheduledOld = appt.status === 'RESCHEDULE_OLD'
                            const canViewInCalendar = !isRescheduledOld

                            // Format date string for navigation using UTC components
                            const year = apptDateUTC.getUTCFullYear()
                            const month = String(apptDateUTC.getUTCMonth() + 1).padStart(2, '0')
                            const day = String(apptDateUTC.getUTCDate()).padStart(2, '0')
                            const dateStr = `${year}-${month}-${day}`

                            // Extract latest move/reschedule note and clean notes
                            const latestMoveNote = getLatestMoveNote(appt.notes)
                            const cleanedNotes = cleanNotes(appt.notes)

                            return (
                              <div
                                key={appt.id}
                                className={`border rounded p-3 transition-colors ${
                                  isMissed ? 'bg-red-50 border-red-200' : 'bg-white'
                                } ${canViewInCalendar ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                                onClick={() => {
                                  if (canViewInCalendar) {
                                    // Only navigate for non-RESCHEDULE_OLD appointments
                                    navigate(`/dashboard/calendar?date=${dateStr}&appt=${appt.id}`)
                                  }
                                }}
                              >
                                <div className="flex justify-between items-start">
                                  <div className="flex-1">
                                    <div className="font-medium text-sm text-gray-600 mb-1">
                                      {dateDisplay}
                                      {isToday && <span className="ml-2 text-blue-600">(Today)</span>}
                                    </div>
                                    <div className="font-medium">
                                      {appt.time}
                                    </div>
                                    <div className="text-sm text-gray-600">
                                      Status: {appt.status}
                                      {isMissed && <span className="text-red-600 ml-2">(Missed)</span>}
                                      {isRescheduledOld && <span className="text-orange-600 ml-2">(Rescheduled - Old)</span>}
                                    </div>
                                    {/* Show latest move/reschedule note only in family history */}
                                    {latestMoveNote && (
                                      <div className="text-xs text-purple-600 mt-1 italic">
                                        {latestMoveNote}
                                      </div>
                                    )}
                                    {appt.isRescheduled && !isRescheduledOld && (
                                      <div className="text-xs text-orange-600 mt-1 font-medium">
                                        (Rescheduled)
                                      </div>
                                    )}
                                    {/* Show cleaned notes (without move/reschedule logs) if any */}
                                    {cleanedNotes && (
                                      <div className="text-xs text-gray-500 mt-1">
                                        {cleanedNotes}
                                      </div>
                                    )}
                                    {canViewInCalendar && (
                                      <div className="text-xs text-blue-500 mt-1">Click to view in calendar</div>
                                    )}
                                    {!canViewInCalendar && (
                                      <div className="text-xs text-gray-400 mt-1">Rescheduled appointment (view new appointment instead)</div>
                                    )}
                                  </div>
                                  {appt.price && (
                                    <div className="text-sm font-medium">${appt.price.toFixed(2)}</div>
                                  )}
                                </div>
                              </div>
                            )
                          })
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })
          ) : (
            // Show appointments directly when history is within one month (no day collapsing)
            <div className="space-y-2">
              {groupedHistory.sortedDates.map((dateKey) => {
                const appointments = groupedHistory.groupedByDate?.get(dateKey) || []
                
                // Parse date for display
                const [year, month, day] = dateKey.split('-').map(Number)
                const displayDate = new Date(year, month - 1, day)
                const today = new Date()
                today.setHours(0, 0, 0, 0)
                displayDate.setHours(0, 0, 0, 0)
                const isToday = displayDate.getTime() === today.getTime()
                const dateDisplay = displayDate.toLocaleDateString(undefined, { 
                  weekday: 'short', 
                  year: 'numeric', 
                  month: 'short', 
                  day: 'numeric' 
                })

                return appointments.map((appt: any) => {
                  // Convert UTC date from server to local date for display
                  const apptDateUTC = typeof appt.date === 'string' ? new Date(appt.date) : appt.date
                  const apptDate = new Date(
                    apptDateUTC.getUTCFullYear(),
                    apptDateUTC.getUTCMonth(),
                    apptDateUTC.getUTCDate()
                  )
                  
                  apptDate.setHours(0, 0, 0, 0)
                  const isMissed = appt.status === 'RECURRING_UNCONFIRMED' && apptDate < today
                  const isRescheduledOld = appt.status === 'RESCHEDULE_OLD'
                  const canViewInCalendar = !isRescheduledOld

                  // Format date string for navigation using UTC components
                  const year = apptDateUTC.getUTCFullYear()
                  const month = String(apptDateUTC.getUTCMonth() + 1).padStart(2, '0')
                  const day = String(apptDateUTC.getUTCDate()).padStart(2, '0')
                  const dateStr = `${year}-${month}-${day}`

                  // Extract latest move/reschedule note and clean notes
                  const latestMoveNote = getLatestMoveNote(appt.notes)
                  const cleanedNotes = cleanNotes(appt.notes)

                  return (
                    <div
                      key={appt.id}
                      className={`border rounded p-3 transition-colors ${
                        isMissed ? 'bg-red-50 border-red-200' : 'bg-white'
                      } ${canViewInCalendar ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                      onClick={() => {
                        if (canViewInCalendar) {
                          // Only navigate for non-RESCHEDULE_OLD appointments
                          navigate(`/dashboard/calendar?date=${dateStr}&appt=${appt.id}`)
                        }
                      }}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="font-medium text-sm text-gray-600 mb-1">
                            {dateDisplay}
                            {isToday && <span className="ml-2 text-blue-600">(Today)</span>}
                          </div>
                          <div className="font-medium">
                            {appt.time}
                          </div>
                          <div className="text-sm text-gray-600">
                            Status: {appt.status}
                            {isMissed && <span className="text-red-600 ml-2">(Missed)</span>}
                            {isRescheduledOld && <span className="text-orange-600 ml-2">(Rescheduled - Old)</span>}
                          </div>
                          {/* Show latest move/reschedule note only in family history */}
                          {latestMoveNote && (
                            <div className="text-xs text-purple-600 mt-1 italic">
                              {latestMoveNote}
                            </div>
                          )}
                          {appt.isRescheduled && !isRescheduledOld && (
                            <div className="text-xs text-orange-600 mt-1 font-medium">
                              (Rescheduled)
                            </div>
                          )}
                          {/* Show cleaned notes (without move/reschedule logs) if any */}
                          {cleanedNotes && (
                            <div className="text-xs text-gray-500 mt-1">
                              {cleanedNotes}
                            </div>
                          )}
                          {canViewInCalendar && (
                            <div className="text-xs text-blue-500 mt-1">Click to view in calendar</div>
                          )}
                          {!canViewInCalendar && (
                            <div className="text-xs text-gray-400 mt-1">Rescheduled appointment (view new appointment instead)</div>
                          )}
                        </div>
                        {appt.price && (
                          <div className="text-sm font-medium">${appt.price.toFixed(2)}</div>
                        )}
                      </div>
                    </div>
                  )
                })
              })}
            </div>
          )}
        </div>
      </div>

      {showRestartModal && (
        <RestartRecurrenceModal
          familyId={family.id}
          onClose={() => setShowRestartModal(false)}
          onSuccess={onUpdate}
        />
      )}
    </div>
  )
}

import { useState, useMemo } from 'react'
import { RecurrenceFamily } from '../index'

interface Props {
  title: string
  families: RecurrenceFamily[]
  onSelectFamily: (id: number) => void
  onUpdate: () => void
  isStopped?: boolean
}

interface ClientGroup {
  clientId: number | null
  clientName: string
  families: RecurrenceFamily[]
}

export default function RecurringFamilyList({
  title,
  families,
  onSelectFamily,
  onUpdate,
  isStopped = false,
}: Props) {
  const [expandedClients, setExpandedClients] = useState<Set<number | string>>(new Set())

  // Group families by client
  const clientGroups = useMemo(() => {
    const groupsMap = new Map<number | string, ClientGroup>()

    families.forEach((family) => {
      // Find the first appointment with a valid client
      const apptWithClient = family.appointments?.find((a: any) => a.client?.id && a.client?.name)
      const clientId = apptWithClient?.client?.id ?? null
      const clientName = apptWithClient?.client?.name || 'Unknown Client'
      const groupKey = clientId ?? `unknown-${clientName}`

      if (!groupsMap.has(groupKey)) {
        groupsMap.set(groupKey, {
          clientId,
          clientName,
          families: [],
        })
      }

      groupsMap.get(groupKey)!.families.push(family)
    })

    return Array.from(groupsMap.values())
  }, [families])

  const toggleClient = (clientId: number | string) => {
    setExpandedClients((prev) => {
      const next = new Set(prev)
      if (next.has(clientId)) {
        next.delete(clientId)
      } else {
        next.add(clientId)
      }
      return next
    })
  }

  const getClientKey = (group: ClientGroup): number | string => {
    return group.clientId ?? `unknown-${group.clientName}`
  }

  const renderFamily = (family: RecurrenceFamily, showClientName: boolean = false, clientName?: string) => {
    const apptWithClient = family.appointments?.find((a: any) => a.client?.name)
    const displayClientName = clientName || apptWithClient?.client?.name || 'Unknown Client'

    return (
      <div
        key={family.id}
        className="border rounded p-3 hover:bg-gray-50 cursor-pointer"
        onClick={() => onSelectFamily(family.id)}
      >
        <div className="flex justify-between items-start">
          <div className="flex-1">
            {showClientName && (
              <div className="font-medium text-gray-900 mb-1">{displayClientName}</div>
            )}
            <div className="font-medium text-sm text-gray-700">
              {family.ruleSummary || 'Recurring'}
            </div>
            {family.nextAppointmentDate && !isStopped && (
              <div className="text-xs text-gray-500 mt-1">
                Next: {new Date(family.nextAppointmentDate).toLocaleDateString()}
              </div>
            )}
            {isStopped && (
              <div className="text-xs text-red-600 mt-1 font-medium">Stopped</div>
            )}
          </div>
          <div className="text-right text-sm text-gray-600">
            {!isStopped && (
              <>
                {family.unconfirmedCount !== undefined && (
                  <div>{family.unconfirmedCount} unconfirmed</div>
                )}
                {family.confirmedCount !== undefined && (
                  <div>{family.confirmedCount} confirmed</div>
                )}
              </>
            )}
            {isStopped && family.totalAppointments !== undefined && (
              <div>{family.totalAppointments} total</div>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (families.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        <p className="text-gray-500 text-sm">No {isStopped ? 'stopped' : 'active'} recurrences</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      <div className="space-y-2">
        {clientGroups.map((group) => {
          const clientKey = getClientKey(group)
          const isExpanded = expandedClients.has(clientKey)
          const hasMultiple = group.families.length > 1

          // If only one family, render it directly without grouping (but still show client name)
          if (!hasMultiple) {
            return (
              <div key={clientKey}>
                {renderFamily(group.families[0], true, group.clientName)}
              </div>
            )
          }

          // If multiple families, show client name with collapse/expand
          return (
            <div key={clientKey} className="border rounded overflow-hidden">
              <div
                className="bg-gray-50 px-3 py-2 flex justify-between items-center cursor-pointer hover:bg-gray-100"
                onClick={() => toggleClient(clientKey)}
              >
                <div className="font-medium text-gray-900">{group.clientName}</div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">
                    {group.families.length} {group.families.length === 1 ? 'family' : 'families'}
                  </span>
                  <span className="text-gray-500">
                    {isExpanded ? '▼' : '▶'}
                  </span>
                </div>
              </div>
              {isExpanded && (
                <div className="p-2 space-y-2 bg-white">
                  {group.families.map((family) => renderFamily(family, false))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

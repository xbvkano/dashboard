import { useState, useEffect } from 'react'
import { API_BASE_URL, fetchJson } from '../../../../../api'
import { Client } from '../../../Clients/components/types'
import { formatPhone } from '../../../../../formatPhone'

interface ClientSectionProps {
  selectedClient: Client | null
  setSelectedClient: (client: Client | null) => void
  clientSearch: string
  setClientSearch: (search: string) => void
  clients: Client[]
  setClients: (clients: Client[]) => void
  showNewClient: boolean
  setShowNewClient: (show: boolean) => void
  newClient: { name: string; number: string; notes: string; from: string }
  setNewClient: (client: { name: string; number: string; notes: string; from: string }) => void
  onClientCreated?: (client: Client) => void
}

export default function ClientSection({
  selectedClient,
  setSelectedClient,
  clientSearch,
  setClientSearch,
  clients,
  setClients,
  showNewClient,
  setShowNewClient,
  newClient,
  setNewClient,
  onClientCreated,
}: ClientSectionProps) {
  const handleNewClientNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    const digits = value.replace(/\D/g, '').slice(0, 11)
    setNewClient({ ...newClient, number: digits })
  }

  const searchClients = async (search: string) => {
    if (search.trim().length < 2) {
      setClients([])
      return
    }
    try {
      const data = await fetchJson(`${API_BASE_URL}/clients?search=${encodeURIComponent(search)}`)
      setClients(data)
    } catch {
      setClients([])
    }
  }

  const createNewClient = async () => {
    if (!newClient.name.trim() || !newClient.number.trim() || !newClient.from.trim()) {
      return
    }
    try {
      const client = await fetchJson(`${API_BASE_URL}/clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newClient),
      })
      setSelectedClient(client)
      setShowNewClient(false)
      setNewClient({ name: '', number: '', notes: '', from: '' })
      onClientCreated?.(client)
    } catch (error: any) {
      if (error.error === 'Client name must be unique') {
        alert('A client with this name already exists')
      } else {
        alert('Failed to create client')
      }
    }
  }

  useEffect(() => {
    const timeout = setTimeout(() => searchClients(clientSearch), 300)
    return () => clearTimeout(timeout)
  }, [clientSearch])

  return (
    <div className="mb-4">
      <h3 className="text-lg font-semibold mb-2">Client</h3>
      {selectedClient ? (
        <div className="bg-gray-100 p-3 rounded">
          <div className="font-medium">{selectedClient.name}</div>
          <div className="text-sm">{formatPhone(selectedClient.number)}</div>
          <button
            className="text-blue-500 text-sm mt-1"
            onClick={() => setSelectedClient(null)}
          >
            Change
          </button>
        </div>
      ) : (
        <div>
          <input
            type="text"
            placeholder="Search clients..."
            className="w-full border p-2 rounded mb-2"
            value={clientSearch}
            onChange={(e) => setClientSearch(e.target.value)}
          />
          {clients.length > 0 && (
            <div className="max-h-40 overflow-y-auto border rounded">
              {clients.map((client) => (
                <div
                  key={client.id}
                  className="p-2 hover:bg-gray-100 cursor-pointer border-b last:border-b-0"
                  onClick={() => setSelectedClient(client)}
                >
                  <div className="font-medium">{client.name}</div>
                  <div className="text-sm">{formatPhone(client.number)}</div>
                </div>
              ))}
            </div>
          )}
          <button
            className="text-blue-500 text-sm mt-2"
            onClick={() => setShowNewClient(true)}
          >
            + Create new client
          </button>
        </div>
      )}

      {showNewClient && (
        <div className="mt-4 p-4 border rounded bg-gray-50">
          <h4 className="font-medium mb-2">New Client</h4>
          <input
            type="text"
            placeholder="Name"
            className="w-full border p-2 rounded mb-2"
            value={newClient.name}
            onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
          />
          <input
            type="tel"
            placeholder="Phone number"
            className="w-full border p-2 rounded mb-2"
            value={newClient.number}
            onChange={handleNewClientNumberChange}
          />
          <input
            type="text"
            placeholder="From (e.g., Google, Referral)"
            className="w-full border p-2 rounded mb-2"
            value={newClient.from}
            onChange={(e) => setNewClient({ ...newClient, from: e.target.value })}
          />
          <textarea
            placeholder="Notes (optional)"
            className="w-full border p-2 rounded mb-2"
            value={newClient.notes}
            onChange={(e) => setNewClient({ ...newClient, notes: e.target.value })}
          />
          <div className="flex gap-2">
            <button
              className="bg-blue-500 text-white px-4 py-2 rounded"
              onClick={createNewClient}
            >
              Create
            </button>
            <button
              className="bg-gray-500 text-white px-4 py-2 rounded"
              onClick={() => setShowNewClient(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

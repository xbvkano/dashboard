import { useState, useEffect } from 'react'
import type { Appointment } from '../../Calendar/types'
import { API_BASE_URL } from '../../../../api'

interface Props {
  appointment: Appointment
  onClose: () => void
}

export default function CreateInvoiceModal({ appointment, onClose }: Props) {
  const [clientName, setClientName] = useState(appointment.client?.name || '')
  const [billedTo, setBilledTo] = useState(appointment.client?.name || '')
  const [address, setAddress] = useState(appointment.address)
  const [serviceDate, setServiceDate] = useState(appointment.date.slice(0, 10))
  const [time, setTime] = useState(appointment.time)
  const [serviceType, setServiceType] = useState(appointment.type)
  const [price, setPrice] = useState(String(appointment.price ?? ''))
  const [carpetPrice, setCarpetPrice] = useState('')
  const [discount, setDiscount] = useState('')
  const [taxEnabled, setTaxEnabled] = useState(false)
  const [taxPercent, setTaxPercent] = useState('')

  useEffect(() => {
    const rooms = (appointment as any).carpetRooms
    const size = appointment.size
    if (rooms != null && size) {
      fetch(`${API_BASE_URL}/carpet-rate?size=${encodeURIComponent(size)}&rooms=${rooms}`)
        .then((res) => res.json())
        .then((d) => setCarpetPrice(String(d.rate)))
        .catch(() => {})
    }
  }, [appointment])

  const subtotal =
    (parseFloat(price) || 0) +
    (parseFloat(carpetPrice) || 0) -
    (parseFloat(discount) || 0)
  const total =
    subtotal + (taxEnabled ? subtotal * ((parseFloat(taxPercent) || 0) / 100) : 0)

  const create = async () => {
    const payload = {
      clientName,
      billedTo,
      address,
      serviceDate,
      serviceTime: time,
      serviceType,
      price: parseFloat(price) || 0,
      carpetPrice: carpetPrice ? parseFloat(carpetPrice) : undefined,
      discount: discount ? parseFloat(discount) : undefined,
      taxPercent: taxEnabled ? parseFloat(taxPercent) || 0 : undefined,
    }
    const newWindow = window.open('', '_blank')
    const res = await fetch(`${API_BASE_URL}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      const data = await res.json()
      const url = `${API_BASE_URL}/invoices/${data.id}/pdf`
      if (newWindow) {
        newWindow.location.href = url
      } else {
        window.location.href = url
      }
      onClose()
    } else {
      if (newWindow) newWindow.close()
      alert('Failed to create invoice')
    }
  }

  const send = async () => {
    const payload = {
      clientName,
      billedTo,
      address,
      serviceDate,
      serviceTime: time,
      serviceType,
      price: parseFloat(price) || 0,
      carpetPrice: carpetPrice ? parseFloat(carpetPrice) : undefined,
      discount: discount ? parseFloat(discount) : undefined,
      taxPercent: taxEnabled ? parseFloat(taxPercent) || 0 : undefined,
    }
    const newWindow = window.open('', '_blank')
    const res = await fetch(`${API_BASE_URL}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      const data = await res.json()
      const email = prompt('Email address to send invoice to:')
      if (email) {
        await fetch(`${API_BASE_URL}/invoices/${data.id}/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' },
          body: JSON.stringify({ email }),
        })
      }
      const url = `${API_BASE_URL}/invoices/${data.id}/pdf`
      if (newWindow) {
        newWindow.location.href = url
      } else {
        window.location.href = url
      }
      onClose()
    } else {
      if (newWindow) newWindow.close()
      alert('Failed to create invoice')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-2 z-30" onClick={onClose}>
      <div className="bg-white p-4 rounded w-full max-w-md space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">Create Invoice</h2>
          <button onClick={onClose}>X</button>
        </div>
        <div>
          <label className="text-sm">Client Name</label>
          <input className="w-full border p-2 rounded" value={clientName} onChange={(e) => setClientName(e.target.value)} />
        </div>
        <div>
          <label className="text-sm">Billed To</label>
          <input className="w-full border p-2 rounded" value={billedTo} onChange={(e) => setBilledTo(e.target.value)} />
        </div>
        <div>
          <label className="text-sm">Address</label>
          <input className="w-full border p-2 rounded" value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-sm">Date of Service</label>
            <input type="date" className="w-full border p-2 rounded" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} />
          </div>
          <div className="flex-1">
            <label className="text-sm">Time</label>
            <input className="w-full border p-2 rounded" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-sm">Service Type</label>
            <input className="w-full border p-2 rounded" value={serviceType} onChange={(e) => setServiceType(e.target.value)} />
          </div>
          <div className="flex-1">
            <label className="text-sm">Price</label>
            <input type="number" className="w-full border p-2 rounded" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-sm">Carpet (optional)</label>
            <input type="number" className="w-full border p-2 rounded" value={carpetPrice} onChange={(e) => setCarpetPrice(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="text-sm">Discount (optional)</label>
          <input type="number" className="w-full border p-2 rounded" value={discount} onChange={(e) => setDiscount(e.target.value)} />
        </div>
        <div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={taxEnabled} onChange={(e) => setTaxEnabled(e.target.checked)} />
            Tax
          </label>
          {taxEnabled && (
            <input type="number" className="w-full border p-2 rounded mt-1" value={taxPercent} onChange={(e) => setTaxPercent(e.target.value)} placeholder="Percent" />
          )}
        </div>
        <div className="font-medium">Total: ${total.toFixed(2)}</div>
        <div className="flex justify-end gap-2 pt-2">
          <button className="px-4 py-1" onClick={onClose}>Cancel</button>
          <button className="px-4 py-1 bg-blue-500 text-white rounded" onClick={create}>Create</button>
          <button className="px-4 py-1 bg-green-600 text-white rounded" onClick={send}>Send</button>
        </div>
      </div>
    </div>
  )
}

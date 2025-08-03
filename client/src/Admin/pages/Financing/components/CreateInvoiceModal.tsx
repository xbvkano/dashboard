import { useState, useEffect } from 'react'
import type { Appointment } from '../../Calendar/types'
import { API_BASE_URL } from '../../../../api'
import { useModal } from '../../../../ModalProvider'
import useFormPersistence, {
  loadFormPersistence,
} from '../../../../useFormPersistence'

interface Props {
  appointment: Appointment
  onClose: () => void
}

export default function CreateInvoiceModal({ appointment, onClose }: Props) {
  const { alert } = useModal()
  const storageKey = 'createInvoiceState'
  const persisted = loadFormPersistence(storageKey, {
    sendEmail: '',
    clientName: appointment.client?.name || '',
    billedTo: appointment.client?.name || '',
    address: appointment.address,
    city: '',
    stateField: '',
    zip: '',
    serviceDate: appointment.date.slice(0, 10),
    time: appointment.time,
    serviceType: appointment.type,
    price: String(appointment.price ?? ''),
    carpetPrice:
      appointment.carpetPrice != null
        ? String(appointment.carpetPrice)
        : '',
    discount: '',
    taxEnabled: false,
    taxPercent: '',
    comment: '',
    paid: true,
    others: [] as { name: string; price: string }[],
    invoiceId: null as string | null,
    dirty: false,
  })
  const [sendEmail, setSendEmail] = useState(persisted.sendEmail)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [clientName, setClientName] = useState(persisted.clientName)
  const [billedTo, setBilledTo] = useState(persisted.billedTo)
  const [address, setAddress] = useState(persisted.address)
  const [city, setCity] = useState(persisted.city)
  const [stateField, setStateField] = useState(persisted.stateField)
  const [zip, setZip] = useState(persisted.zip)
  const [serviceDate, setServiceDate] = useState(persisted.serviceDate)
  const [time, setTime] = useState(persisted.time)
  const [serviceType, setServiceType] = useState(persisted.serviceType)
  const [price, setPrice] = useState(persisted.price)
  const [carpetPrice, setCarpetPrice] = useState(persisted.carpetPrice)
  const [discount, setDiscount] = useState(persisted.discount)
  const [taxEnabled, setTaxEnabled] = useState(persisted.taxEnabled)
  const [taxPercent, setTaxPercent] = useState(persisted.taxPercent)
  const [comment, setComment] = useState(persisted.comment)
  const [paid, setPaid] = useState(persisted.paid)
  const [invoiceId, setInvoiceId] = useState<string | null>(persisted.invoiceId)
  const [dirty, setDirty] = useState(persisted.dirty)
  const [others, setOthers] = useState<{ name: string; price: string }[]>(
    persisted.others,
  )
  const [showOtherModal, setShowOtherModal] = useState(false)
  const [otherName, setOtherName] = useState('')
  const [otherPrice, setOtherPrice] = useState('')
  const [editingOther, setEditingOther] = useState<number | null>(null)

  useFormPersistence(storageKey, {
    sendEmail,
    clientName,
    billedTo,
    address,
    city,
    stateField,
    zip,
    serviceDate,
    time,
    serviceType,
    price,
    carpetPrice,
    discount,
    taxEnabled,
    taxPercent,
    comment,
    paid,
    others,
    invoiceId,
    dirty,
  })

  useEffect(() => {
    if (carpetPrice) return
    const cp = appointment.carpetPrice
    if (cp != null) {
      setCarpetPrice(String(cp))
      return
    }
    const rooms = appointment.carpetRooms
    const size = appointment.size
    if (rooms != null && size) {
      fetch(`${API_BASE_URL}/carpet-rate?size=${encodeURIComponent(size)}&rooms=${rooms}`)
        .then((res) => res.json())
        .then((d) => setCarpetPrice(String(d.rate)))
        .catch(() => {})
    }
  }, [appointment, carpetPrice])

  useEffect(() => {
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [])

  const othersTotal = others.reduce(
    (sum, o) => sum + (parseFloat(o.price) || 0),
    0,
  )
  const subtotal =
    (parseFloat(price) || 0) +
    (parseFloat(carpetPrice) || 0) +
    othersTotal -
    (parseFloat(discount) || 0)
  const total =
    subtotal + (taxEnabled ? subtotal * ((parseFloat(taxPercent) || 0) / 100) : 0)

  useEffect(() => {
    if (invoiceId) setDirty(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    clientName,
    billedTo,
    address,
    city,
    stateField,
    zip,
    serviceDate,
    time,
    serviceType,
    price,
    carpetPrice,
    discount,
    others,
    taxEnabled,
    taxPercent,
    comment,
    paid,
  ])

  const create = async () => {
    const payload = {
      clientName,
      billedTo,
      address,
      city: city || undefined,
      state: stateField || undefined,
      zip: zip || undefined,
      serviceDate,
      serviceTime: time,
      serviceType,
      price: parseFloat(price) || 0,
      carpetPrice: carpetPrice ? parseFloat(carpetPrice) : undefined,
      discount: discount ? parseFloat(discount) : undefined,
      taxPercent: taxEnabled ? parseFloat(taxPercent) || 0 : undefined,
      comment: comment || undefined,
      otherItems: others.map((o) => ({ name: o.name, price: parseFloat(o.price) || 0 })),
      paid,
    }
    const newWindow = window.open('', '_blank')
    const res = await fetch(`${API_BASE_URL}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      const data = await res.json()
      setInvoiceId(data.id)
      setDirty(false)
      const tzOffset = new Date().getTimezoneOffset()
      const url = `${API_BASE_URL}/invoices/${data.id}/pdf?tzOffset=${tzOffset}`
      if (newWindow) {
        newWindow.location.href = url
      } else {
        window.location.href = url
      }
    } else {
      if (newWindow) newWindow.close()
      await alert('Failed to create invoice')
    }
  }

  const sendInvoice = async (email: string) => {
    const payload = {
      clientName,
      billedTo,
      address,
      city: city || undefined,
      state: stateField || undefined,
      zip: zip || undefined,
      serviceDate,
      serviceTime: time,
      serviceType,
      price: parseFloat(price) || 0,
      carpetPrice: carpetPrice ? parseFloat(carpetPrice) : undefined,
      discount: discount ? parseFloat(discount) : undefined,
      taxPercent: taxEnabled ? parseFloat(taxPercent) || 0 : undefined,
      comment: comment || undefined,
      otherItems: others.map((o) => ({ name: o.name, price: parseFloat(o.price) || 0 })),
    }
    let id = invoiceId
    if (!id || dirty) {
      const res = await fetch(`${API_BASE_URL}/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' },
        body: JSON.stringify({ ...payload, paid }),
      })
      if (!res.ok) {
        await alert('Failed to create invoice')
        return
      }
      const data = await res.json()
      id = data.id
      setInvoiceId(id)
      setDirty(false)
    }
    const tzOffset = new Date().getTimezoneOffset()
    const sendRes = await fetch(`${API_BASE_URL}/invoices/${id}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' },
      body: JSON.stringify({ email, tzOffset }),
    })
    if (sendRes.ok) {
      setShowEmailModal(false)
      onClose()
    } else {
      const text = await sendRes.text()
      await alert(text || 'Failed to send invoice')
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-2 z-30 modal-safe-area"
      onClick={onClose}
    >
      <div
        className="bg-white p-4 rounded w-full max-w-md space-y-3 max-h-[calc(100dvh-1rem)] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
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
            <label className="text-sm">City (optional)</label>
            <input className="w-full border p-2 rounded" value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div className="flex-1">
            <label className="text-sm">State (optional)</label>
            <input className="w-full border p-2 rounded" value={stateField} onChange={(e) => setStateField(e.target.value)} />
          </div>
          <div className="flex-1">
            <label className="text-sm">ZIP (optional)</label>
            <input className="w-full border p-2 rounded" value={zip} onChange={(e) => setZip(e.target.value)} />
          </div>
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
          <div className="flex justify-between items-center">
            <label className="text-sm">Other Items</label>
            <button
              className="text-sm text-blue-600"
              onClick={() => {
                setOtherName('')
                setOtherPrice('')
                setEditingOther(null)
                setShowOtherModal(true)
              }}
            >
              Add Other
            </button>
          </div>
          {others.length > 0 && (
            <ul className="mt-2 space-y-1">
              {others.map((o, idx) => (
                <li key={idx} className="flex justify-between items-center border p-2 rounded">
                  <span>
                    {o.name} - ${parseFloat(o.price || '0').toFixed(2)}
                  </span>
                  <div className="space-x-2 text-sm">
                    <button
                      className="text-blue-600"
                      onClick={() => {
                        setOtherName(o.name)
                        setOtherPrice(o.price)
                        setEditingOther(idx)
                        setShowOtherModal(true)
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="text-red-600"
                      onClick={() => setOthers(others.filter((_, i) => i !== idx))}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <label className="text-sm">Comments (optional)</label>
          <textarea
            className="w-full border p-2 rounded"
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
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
        <div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!paid} onChange={(e) => setPaid(!e.target.checked)} />
            Not Paid
          </label>
        </div>
        <div className="font-medium">Total: ${total.toFixed(2)}</div>
        <div className="flex justify-end gap-2 pt-2">
          <button className="px-4 py-1" onClick={onClose}>Cancel</button>
          <button className="px-4 py-1 bg-blue-500 text-white rounded" onClick={create}>Create</button>
          <button className="px-4 py-1 bg-green-600 text-white rounded" onClick={() => setShowEmailModal(true)}>Send</button>
        </div>
      </div>
      {showOtherModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40" onClick={() => setShowOtherModal(false)}>
          <div className="bg-white p-4 rounded w-full max-w-xs space-y-2" onClick={(e) => e.stopPropagation()}>
            <h4 className="font-medium">{editingOther !== null ? 'Edit Item' : 'Add Item'}</h4>
            <input
              className="w-full border p-2 rounded"
              placeholder="Name"
              value={otherName}
              onChange={(e) => setOtherName(e.target.value)}
            />
            <input
              type="number"
              className="w-full border p-2 rounded"
              placeholder="Price"
              value={otherPrice}
              onChange={(e) => setOtherPrice(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button className="px-4 py-1" onClick={() => setShowOtherModal(false)}>Cancel</button>
              <button
                className="px-4 py-1 bg-green-600 text-white rounded disabled:opacity-50"
                disabled={!otherName || !otherPrice}
                onClick={() => {
                  if (editingOther !== null) {
                    const copy = [...others]
                    copy[editingOther] = { name: otherName, price: otherPrice }
                    setOthers(copy)
                  } else {
                    setOthers([...others, { name: otherName, price: otherPrice }])
                  }
                  setShowOtherModal(false)
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40" onClick={() => setShowEmailModal(false)}>
          <div className="bg-white p-4 rounded w-full max-w-xs space-y-2" onClick={(e) => e.stopPropagation()}>
            <h4 className="font-medium">Send Invoice</h4>
            <input type="email" className="w-full border p-2 rounded" placeholder="Email" value={sendEmail} onChange={(e) => setSendEmail(e.target.value)} />
            <div className="flex justify-end gap-2">
              <button className="px-4 py-1" onClick={() => setShowEmailModal(false)}>Cancel</button>
              <button
                className="px-4 py-1 bg-green-600 text-white rounded disabled:opacity-50"
                disabled={!sendEmail}
                onClick={() => sendInvoice(sendEmail)}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

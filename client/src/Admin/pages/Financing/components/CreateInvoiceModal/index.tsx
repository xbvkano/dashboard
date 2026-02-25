import { useState } from 'react'
import { API_BASE_URL } from '../../../../api'
import { useModal } from '../../../../ModalProvider'
import useFormPersistence, { loadFormPersistence, clearFormPersistence } from '../../../../useFormPersistence'
import InvoiceForm from './InvoiceForm'
import OtherItemsSection from './OtherItemsSection'
import type { Appointment } from '../../../Calendar/types'

interface Props {
  appointment: Appointment
  onClose: () => void
}

export default function CreateInvoiceModal({ appointment, onClose }: Props) {
  const { alert } = useModal()
  const storageKey = 'createInvoiceState'
  
  const handleClose = () => {
    clearFormPersistence(storageKey)
    onClose()
  }
  
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
    carpetPrice: appointment.carpetPrice != null ? String(appointment.carpetPrice) : '',
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
  const [others, setOthers] = useState<{ name: string; price: string }[]>(persisted.others)
  const [showOtherModal, setShowOtherModal] = useState(false)
  const [otherName, setOtherName] = useState('')
  const [otherPrice, setOtherPrice] = useState('')
  const [editingOther, setEditingOther] = useState<number | null>(null)
  const [sending, setSending] = useState(false)
  const [creating, setCreating] = useState(false)

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

  const sendInvoice = async (email: string) => {
    if (sending) return
    setSending(true)
    
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
      setSending(false)
      handleClose()
    } else {
      const text = await sendRes.text()
      await alert(text || 'Failed to send invoice')
      setSending(false)
    }
  }

  const createInvoice = async () => {
    if (creating) return
    setCreating(true)
    
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

    try {
      const res = await fetch(`${API_BASE_URL}/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' },
        body: JSON.stringify(payload),
      })
      
      if (res.ok) {
        const data = await res.json()
        setInvoiceId(data.id)
        setDirty(false)
        handleClose()
      } else {
        await alert('Failed to create invoice')
      }
    } catch (error) {
      await alert('Failed to create invoice')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-2 z-[10150] modal-safe-area"
    >
      <div
        className="bg-white p-4 rounded w-full max-w-md space-y-3 max-h-[calc(100dvh-1rem)] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">Create Invoice</h2>
          <button onClick={handleClose}>X</button>
        </div>

        <InvoiceForm
          clientName={clientName}
          setClientName={setClientName}
          billedTo={billedTo}
          setBilledTo={setBilledTo}
          address={address}
          setAddress={setAddress}
          city={city}
          setCity={setCity}
          stateField={stateField}
          setStateField={setStateField}
          zip={zip}
          setZip={setZip}
          serviceDate={serviceDate}
          setServiceDate={setServiceDate}
          time={time}
          setTime={setTime}
          serviceType={serviceType}
          setServiceType={setServiceType}
          price={price}
          setPrice={setPrice}
          carpetPrice={carpetPrice}
          setCarpetPrice={setCarpetPrice}
          discount={discount}
          setDiscount={setDiscount}
          taxEnabled={taxEnabled}
          setTaxEnabled={setTaxEnabled}
          taxPercent={taxPercent}
          setTaxPercent={setTaxPercent}
          comment={comment}
          setComment={setComment}
          paid={paid}
          setPaid={setPaid}
        />

        <OtherItemsSection
          others={others}
          setOthers={setOthers}
          showOtherModal={showOtherModal}
          setShowOtherModal={setShowOtherModal}
          otherName={otherName}
          setOtherName={setOtherName}
          otherPrice={otherPrice}
          setOtherPrice={setOtherPrice}
          editingOther={editingOther}
          setEditingOther={setEditingOther}
        />

        <div className="flex gap-2">
          <button
            onClick={createInvoice}
            disabled={creating}
            className="flex-1 bg-blue-500 text-white px-4 py-2 rounded disabled:bg-gray-400"
          >
            {creating ? 'Creating...' : 'Create Invoice'}
          </button>
          <button
            onClick={() => setShowEmailModal(true)}
            className="flex-1 bg-green-500 text-white px-4 py-2 rounded"
          >
            Send Invoice
          </button>
        </div>

        {showEmailModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[10151]">
            <div className="bg-white p-4 rounded w-full max-w-sm">
              <h3 className="text-lg font-semibold mb-4">Send Invoice</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-sm">Email Address</label>
                  <input
                    type="email"
                    className="w-full border p-2 rounded"
                    value={sendEmail}
                    onChange={(e) => setSendEmail(e.target.value)}
                    placeholder="client@example.com"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => sendInvoice(sendEmail)}
                    disabled={sending || !sendEmail.trim()}
                    className="flex-1 bg-blue-500 text-white px-4 py-2 rounded disabled:bg-gray-400"
                  >
                    {sending ? 'Sending...' : 'Send'}
                  </button>
                  <button
                    onClick={() => setShowEmailModal(false)}
                    className="flex-1 bg-gray-500 text-white px-4 py-2 rounded"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

interface InvoiceFormProps {
  clientName: string
  setClientName: (name: string) => void
  billedTo: string
  setBilledTo: (name: string) => void
  address: string
  setAddress: (address: string) => void
  city: string
  setCity: (city: string) => void
  stateField: string
  setStateField: (state: string) => void
  zip: string
  setZip: (zip: string) => void
  serviceDate: string
  setServiceDate: (date: string) => void
  time: string
  setTime: (time: string) => void
  serviceType: string
  setServiceType: (type: string) => void
  price: string
  setPrice: (price: string) => void
  carpetPrice: string
  setCarpetPrice: (price: string) => void
  discount: string
  setDiscount: (discount: string) => void
  taxEnabled: boolean
  setTaxEnabled: (enabled: boolean) => void
  taxPercent: string
  setTaxPercent: (percent: string) => void
  comment: string
  setComment: (comment: string) => void
  paid: boolean
  setPaid: (paid: boolean) => void
}

export default function InvoiceForm({
  clientName,
  setClientName,
  billedTo,
  setBilledTo,
  address,
  setAddress,
  city,
  setCity,
  stateField,
  setStateField,
  zip,
  setZip,
  serviceDate,
  setServiceDate,
  time,
  setTime,
  serviceType,
  setServiceType,
  price,
  setPrice,
  carpetPrice,
  setCarpetPrice,
  discount,
  setDiscount,
  taxEnabled,
  setTaxEnabled,
  taxPercent,
  setTaxPercent,
  comment,
  setComment,
  paid,
  setPaid,
}: InvoiceFormProps) {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm">Client Name</label>
        <input
          className="w-full border p-2 rounded"
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
        />
      </div>
      <div>
        <label className="text-sm">Billed To</label>
        <input
          className="w-full border p-2 rounded"
          value={billedTo}
          onChange={(e) => setBilledTo(e.target.value)}
        />
      </div>
      <div>
        <label className="text-sm">Address</label>
        <input
          className="w-full border p-2 rounded"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-sm">City (optional)</label>
          <input
            className="w-full border p-2 rounded"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
        </div>
        <div className="flex-1">
          <label className="text-sm">State (optional)</label>
          <input
            className="w-full border p-2 rounded"
            value={stateField}
            onChange={(e) => setStateField(e.target.value)}
          />
        </div>
        <div className="flex-1">
          <label className="text-sm">ZIP (optional)</label>
          <input
            className="w-full border p-2 rounded"
            value={zip}
            onChange={(e) => setZip(e.target.value)}
          />
        </div>
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-sm">Date of Service</label>
          <input
            type="date"
            className="w-full border p-2 rounded"
            value={serviceDate}
            onChange={(e) => setServiceDate(e.target.value)}
          />
        </div>
        <div className="flex-1">
          <label className="text-sm">Time</label>
          <input
            className="w-full border p-2 rounded"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </div>
      </div>
      <div>
        <label className="text-sm">Service Type</label>
        <select
          className="w-full border p-2 rounded"
          value={serviceType}
          onChange={(e) => setServiceType(e.target.value)}
        >
          <option value="STANDARD">Standard</option>
          <option value="DEEP">Deep</option>
          <option value="MOVE_IN_OUT">Move in/out</option>
        </select>
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-sm">Price</label>
          <input
            type="number"
            className="w-full border p-2 rounded"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
        <div className="flex-1">
          <label className="text-sm">Carpet Price (optional)</label>
          <input
            type="number"
            className="w-full border p-2 rounded"
            value={carpetPrice}
            onChange={(e) => setCarpetPrice(e.target.value)}
          />
        </div>
      </div>
      <div>
        <label className="text-sm">Discount (optional)</label>
        <input
          type="number"
          className="w-full border p-2 rounded"
          value={discount}
          onChange={(e) => setDiscount(e.target.value)}
        />
      </div>
      <div>
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={taxEnabled}
            onChange={(e) => setTaxEnabled(e.target.checked)}
            className="mr-2"
          />
          Enable Tax
        </label>
        {taxEnabled && (
          <input
            type="number"
            placeholder="Tax percentage"
            className="w-full border p-2 rounded mt-1"
            value={taxPercent}
            onChange={(e) => setTaxPercent(e.target.value)}
          />
        )}
      </div>
      <div>
        <label className="text-sm">Comment (optional)</label>
        <textarea
          className="w-full border p-2 rounded"
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </div>
      <div>
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={paid}
            onChange={(e) => setPaid(e.target.checked)}
            className="mr-2"
          />
          Mark as paid
        </label>
      </div>
    </div>
  )
}

import { useState } from 'react'

interface OtherItemsSectionProps {
  others: { name: string; price: string }[]
  setOthers: (items: { name: string; price: string }[]) => void
  showOtherModal: boolean
  setShowOtherModal: (show: boolean) => void
  otherName: string
  setOtherName: (name: string) => void
  otherPrice: string
  setOtherPrice: (price: string) => void
  editingOther: number | null
  setEditingOther: (index: number | null) => void
}

export default function OtherItemsSection({
  others,
  setOthers,
  showOtherModal,
  setShowOtherModal,
  otherName,
  setOtherName,
  otherPrice,
  setOtherPrice,
  editingOther,
  setEditingOther,
}: OtherItemsSectionProps) {
  const addOther = () => {
    if (!otherName.trim() || !otherPrice.trim()) return
    if (editingOther !== null) {
      const newOthers = [...others]
      newOthers[editingOther] = { name: otherName, price: otherPrice }
      setOthers(newOthers)
      setEditingOther(null)
    } else {
      setOthers([...others, { name: otherName, price: otherPrice }])
    }
    setOtherName('')
    setOtherPrice('')
    setShowOtherModal(false)
  }

  const editOther = (index: number) => {
    const item = others[index]
    setOtherName(item.name)
    setOtherPrice(item.price)
    setEditingOther(index)
    setShowOtherModal(true)
  }

  const deleteOther = (index: number) => {
    setOthers(others.filter((_, i) => i !== index))
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <label className="text-sm">Other Items</label>
        <button
          onClick={() => setShowOtherModal(true)}
          className="text-blue-500 text-sm"
        >
          + Add Item
        </button>
      </div>
      
      {others.length > 0 && (
        <div className="space-y-2 mb-3">
          {others.map((item, index) => (
            <div key={index} className="flex justify-between items-center p-2 border rounded">
              <div>
                <div className="font-medium">{item.name}</div>
                <div className="text-sm text-gray-600">${item.price}</div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => editOther(index)}
                  className="text-blue-500 text-sm"
                >
                  Edit
                </button>
                <button
                  onClick={() => deleteOther(index)}
                  className="text-red-500 text-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showOtherModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-4 rounded w-full max-w-sm">
            <h3 className="text-lg font-semibold mb-4">
              {editingOther !== null ? 'Edit Item' : 'Add Item'}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm">Item Name</label>
                <input
                  type="text"
                  className="w-full border p-2 rounded"
                  value={otherName}
                  onChange={(e) => setOtherName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm">Price</label>
                <input
                  type="number"
                  className="w-full border p-2 rounded"
                  value={otherPrice}
                  onChange={(e) => setOtherPrice(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={addOther}
                  className="flex-1 bg-blue-500 text-white px-4 py-2 rounded"
                >
                  {editingOther !== null ? 'Update' : 'Add'}
                </button>
                <button
                  onClick={() => {
                    setShowOtherModal(false)
                    setOtherName('')
                    setOtherPrice('')
                    setEditingOther(null)
                  }}
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
  )
}

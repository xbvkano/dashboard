import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { API_BASE_URL, fetchJson } from '../../../api'
import { formatPhone } from '../../../formatPhone'

interface DueItem {
  employee: { id: number; name: string; number: string }
  items: {
    id?: number
    service: string
    date: string
    amount: number
    selectable?: boolean
    manual?: boolean
    extras?: { id: number; name: string; amount: number }[]
  }[]
  total: number
}

interface PaidItem {
  id: number
  employee: { id: number; name: string }
  amount: number
  extra: number
  createdAt: string
}

export default function Payroll() {
  const [due, setDue] = useState<DueItem[]>([])
  const [paid, setPaid] = useState<PaidItem[]>([])
  const [selected, setSelected] = useState<number | ''>('')
  const [amount, setAmount] = useState('')
  const [extra, setExtra] = useState('')
  const [chargebackId, setChargebackId] = useState<number | null>(null)
  const [otherFor, setOtherFor] = useState<number | null>(null)
  const [otherName, setOtherName] = useState('')
  const [otherAmount, setOtherAmount] = useState('')
  const [selectedMap, setSelectedMap] = useState<
    Record<number, { items: Set<number>; manuals: Set<number> }>
  >({})

  const load = () => {
    fetchJson(`${API_BASE_URL}/payroll/due`).then(setDue).catch(() => setDue([]))
    fetchJson(`${API_BASE_URL}/payroll/paid`).then(setPaid).catch(() => setPaid([]))
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    if (selected) {
      const emp = due.find((d) => d.employee.id === selected)
      if (emp) setAmount(String(emp.total))
    }
  }, [selected, due])

  const handlePay = async () => {
    if (!selected) return
    const sel = selectedMap[selected] || {
      items: new Set<number>(),
      manuals: new Set<number>(),
    }
    const payload = {
      employeeId: selected,
      amount: parseFloat(amount) || 0,
      extra: extra ? parseFloat(extra) || 0 : 0,
      itemIds: Array.from(sel.items),
      manualIds: Array.from(sel.manuals),
    }
    await fetch(`${API_BASE_URL}/payroll/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' },
      body: JSON.stringify(payload),
    })
    setSelectedMap((curr) => {
      const copy = { ...curr }
      delete copy[selected]
      return copy
    })
    setSelected('')
    setAmount('')
    setExtra('')
    load()
  }

  const handleChargeback = async () => {
    if (chargebackId == null) return
    await fetch(`${API_BASE_URL}/payroll/chargeback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' },
      body: JSON.stringify({ id: chargebackId }),
    })
    setChargebackId(null)
    load()
  }

  const saveOther = async () => {
    if (otherFor == null) return
    const name = otherName.trim() || 'Other'
    const amt = parseFloat(otherAmount) || 0
    const res = await fetch(`${API_BASE_URL}/payroll/manual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' },
      body: JSON.stringify({ employeeId: otherFor, name, amount: amt }),
    })
    const data = await res.json()
    setDue((curr) =>
      curr.map((d) => {
        if (d.employee.id !== otherFor) return d
        const newItem = {
          id: data.id,
          service: name,
          date: new Date().toISOString(),
          amount: amt,
          manual: true,
        }
        return {
          ...d,
          items: [...d.items, newItem],
          total: d.total + amt,
        }
      }),
    )
    setOtherFor(null)
  }

  const openOther = (id: number) => {
    setOtherFor(id)
    setOtherName('')
    setOtherAmount('')
  }

  const toggleItem = (empId: number, it: { id?: number; manual?: boolean }) => {
    if (!it.id) return
    setSelectedMap((curr) => {
      const entry = curr[empId] || { items: new Set<number>(), manuals: new Set<number>() }
      const items = new Set(entry.items)
      const manuals = new Set(entry.manuals)
      const set = it.manual ? manuals : items
      if (set.has(it.id)) set.delete(it.id)
      else set.add(it.id)
      return { ...curr, [empId]: { items, manuals } }
    })
  }

  const toggleExtra = (empId: number, id: number) => {
    setSelectedMap((curr) => {
      const entry = curr[empId] || { items: new Set<number>(), manuals: new Set<number>() }
      const items = new Set(entry.items)
      const manuals = new Set(entry.manuals)
      if (manuals.has(id)) manuals.delete(id)
      else manuals.add(id)
      return { ...curr, [empId]: { items, manuals } }
    })
  }

  const selectedTotal = (empId: number) => {
    const d = due.find((dd) => dd.employee.id === empId)
    const sel = selectedMap[empId]
    if (!d || !sel) return 0
    let total = 0
    for (const it of d.items) {
      if (it.id && sel.items.has(it.id)) total += it.amount
      if (it.manual && it.id && sel.manuals.has(it.id)) total += it.amount
      if (it.extras) {
        for (const ex of it.extras) {
          if (sel.manuals.has(ex.id)) total += ex.amount
        }
      }
    }
    return total
  }

  useEffect(() => {
    if (selected) {
      const total = selectedTotal(selected)
      if (total > 0) setAmount(total.toFixed(2))
      else {
        const emp = due.find((d) => d.employee.id === selected)
        if (emp) setAmount(String(emp.total))
      }
    }
  }, [selected, selectedMap, due])

  return (
    <div className="p-4 pb-16 space-y-4">
      <Link to=".." className="text-blue-500 text-sm">
        &larr; Back
      </Link>
      <h2 className="text-xl font-semibold mb-2">Payroll</h2>

      <div className="bg-white p-3 rounded shadow space-y-2">
        <div className="flex gap-2">
          <select className="border p-2 rounded flex-1" value={selected} onChange={(e) => setSelected(Number(e.target.value))}>
            <option value="">Select employee</option>
            {due.map((d) => (
              <option key={d.employee.id} value={d.employee.id}>
                {d.employee.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            className="border p-2 rounded w-24"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <input
            type="number"
            className="border p-2 rounded w-20"
            placeholder="Tip"
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
          />
          <button className="bg-blue-500 text-white px-3 rounded" onClick={handlePay}>
            Save
          </button>
        </div>
      </div>

      <div>
        <h3 className="font-medium mb-2">Due</h3>
        <div className="space-y-3">
          {due.map((d) => (
            <div key={d.employee.id} className="bg-white p-3 rounded shadow">
              <div className="flex justify-between mb-2">
                <div>
                  <div className="font-medium">{d.employee.name}</div>
                  <div className="text-sm text-gray-600">{formatPhone(d.employee.number)}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm">Total:</div>
                  <div className="text-lg font-semibold">${d.total.toFixed(2)}</div>
                  <div className="text-sm text-gray-600">
                    Selected: ${selectedTotal(d.employee.id).toFixed(2)}
                  </div>
                </div>
              </div>
              <ul className="text-sm pl-4">
                {d.items.map((it, idx) => (
                  <li key={idx} className="mb-1">
                    <div className="flex items-center">
                      {it.id && it.selectable !== false && (
                        <input
                          type="checkbox"
                          className="mr-1"
                          checked={
                            it.manual
                              ? selectedMap[d.employee.id]?.manuals.has(it.id) || false
                              : selectedMap[d.employee.id]?.items.has(it.id) || false
                          }
                          onChange={() => toggleItem(d.employee.id, it)}
                        />
                      )}
                      {it.service}, {it.date.slice(0, 10)}, ${it.amount.toFixed(2)}
                    </div>
                    {it.extras &&
                      it.extras.map((ex) => (
                        <div key={ex.id} className="pl-4 flex items-start relative">
                          <div className="absolute left-0 top-0 w-3 h-3 border-l border-b border-gray-400" />
                          <label className="ml-3 flex items-center">
                            <input
                              type="checkbox"
                              className="mr-1"
                              checked={
                                selectedMap[d.employee.id]?.manuals.has(ex.id) || false
                              }
                              onChange={() => toggleExtra(d.employee.id, ex.id)}
                            />
                            <span>
                              {ex.name}: ${ex.amount.toFixed(2)}
                            </span>
                          </label>
                        </div>
                      ))}
                  </li>
                ))}
              </ul>
              <div className="text-right mt-1">
                <button
                  className="text-blue-500 text-xs"
                  onClick={() => openOther(d.employee.id)}
                >
                  Add other
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-medium mb-2">Paid</h3>
        <ul className="space-y-2">
          {paid.map((p) => (
            <li key={p.id} className="bg-white p-3 rounded shadow">
              <div className="flex justify-between">
                <div>
                  {p.employee.name} - ${p.amount.toFixed(2)}
                  {p.extra ? ` + ${p.extra.toFixed(2)} tip` : ''}
                </div>
                <div className="text-sm text-gray-600">{p.createdAt.slice(0, 10)}</div>
              </div>
              <div className="text-right mt-2">
                <button
                  className="text-blue-500 text-sm"
                  onClick={() => setChargebackId(p.id)}
                >
                  Pay Charge Back
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
      {otherFor != null && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setOtherFor(null)}
        >
          <div
            className="bg-white p-4 rounded space-y-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="font-medium">Add Other Item</div>
            <input
              className="border p-2 rounded w-full"
              placeholder="Name"
              value={otherName}
              onChange={(e) => setOtherName(e.target.value)}
            />
            <input
              type="number"
              className="border p-2 rounded w-full"
              placeholder="Amount"
              value={otherAmount}
              onChange={(e) => setOtherAmount(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button className="px-4 py-1 border rounded" onClick={() => setOtherFor(null)}>
                Cancel
              </button>
              <button className="px-4 py-1 bg-blue-500 text-white rounded" onClick={saveOther}>
                Add
              </button>
            </div>
          </div>
        </div>
      )}
      {chargebackId != null && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setChargebackId(null)}
        >
          <div
            className="bg-white p-4 rounded space-y-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div>Undo this payment?</div>
            <div className="flex justify-end gap-2">
              <button className="px-4 py-1 border rounded" onClick={() => setChargebackId(null)}>
                No
              </button>
              <button
                className="px-4 py-1 bg-red-500 text-white rounded"
                onClick={handleChargeback}
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

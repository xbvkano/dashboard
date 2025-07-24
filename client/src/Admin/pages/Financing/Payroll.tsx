import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { API_BASE_URL, fetchJson } from '../../../api'

interface DueItem {
  employee: { id: number; name: string; number: string }
  items: { service: string; date: string; amount: number; tip: number }[]
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
    const payload = {
      employeeId: selected,
      amount: parseFloat(amount) || 0,
      extra: extra ? parseFloat(extra) || 0 : 0,
    }
    await fetch(`${API_BASE_URL}/payroll/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' },
      body: JSON.stringify(payload),
    })
    setSelected('')
    setAmount('')
    setExtra('')
    load()
  }

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
                  <div className="text-sm text-gray-600">{d.employee.number}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm">Total:</div>
                  <div className="text-lg font-semibold">${d.total.toFixed(2)}</div>
                </div>
              </div>
              <ul className="text-sm list-disc pl-4">
                {d.items.map((it, idx) => (
                  <li key={idx}>
                    {it.service}, {it.date.slice(0, 10)}, ${it.amount.toFixed(2)}
                    {it.tip ? ` + ${it.tip.toFixed(2)} tip` : ''}
                  </li>
                ))}
              </ul>
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
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

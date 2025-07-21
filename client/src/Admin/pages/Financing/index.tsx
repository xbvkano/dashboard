import { Routes, Route, Link } from 'react-router-dom'
import Payroll from './Payroll'
import Invoice from './Invoice'
import Revenue from './Revenue'

export default function Financing() {
  return (
    <Routes>
      <Route index element={<FinancingHome />} />
      <Route path="payroll" element={<Payroll />} />
      <Route path="invoice" element={<Invoice />} />
      <Route path="revenue" element={<Revenue />} />
    </Routes>
  )
}

function FinancingHome() {
  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-4">Financing</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        <Link to="payroll" className="bg-blue-500 text-white py-3 rounded text-center">Payroll</Link>
        <Link to="invoice" className="bg-green-500 text-white py-3 rounded text-center">Invoice</Link>
        <Link to="revenue" className="bg-purple-500 text-white py-3 rounded text-center">Revenue</Link>
      </div>
    </div>
  )
}

import { Routes, Route, Link } from 'react-router-dom'
import Payroll from './Payroll'
import Invoice from './Invoice'
import Revenue from './Revenue'
import Coupons from './Coupons'
import Calculator from './Calculator'

export default function Financing() {
  return (
    <Routes>
      <Route index element={<FinancingHome />} />
      <Route path="payroll" element={<Payroll />} />
      <Route path="invoice" element={<Invoice />} />
      <Route path="revenue" element={<Revenue />} />
      <Route path="coupons" element={<Coupons />} />
      <Route path="calculator" element={<Calculator />} />
    </Routes>
  )
}

function FinancingHome() {
  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-4">Financing</h2>
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <Link to="payroll" className="bg-blue-500 text-white py-3 rounded text-center hover:opacity-90">Payroll</Link>
        <Link to="invoice" className="bg-green-500 text-white py-3 rounded text-center hover:opacity-90">Invoice</Link>
        <Link to="revenue" className="bg-purple-500 text-white py-3 rounded text-center hover:opacity-90">Revenue</Link>
        <Link to="coupons" className="bg-amber-500 text-white py-3 rounded text-center hover:opacity-90">Coupons</Link>
        <Link to="calculator" className="bg-teal-600 text-white py-3 rounded text-center hover:opacity-90">Calculator</Link>
      </div>
    </div>
  )
}

import { Routes, Route, Link } from 'react-router-dom'
import Clients from '../Clients'
import Employees from '../Employees'

export default function Accounts() {
  return (
    <Routes>
      <Route index element={<AccountsHome />} />
      <Route path="clients/*" element={<Clients />} />
      <Route path="employees/*" element={<Employees />} />
    </Routes>
  )
}

function AccountsHome() {
  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-4">Accounts</h2>
      <p className="text-gray-600 mb-6">Select an account type to manage.</p>
      <div className="grid gap-4 sm:grid-cols-2 max-w-md">
        <Link
          to="clients"
          className="flex flex-col items-center justify-center p-6 rounded-lg bg-white shadow border border-gray-200 hover:border-blue-300 hover:shadow-md transition-colors"
        >
          <span className="text-2xl mb-2">👤</span>
          <span className="font-medium text-gray-900">Clients</span>
          <span className="text-sm text-gray-500 mt-1">Manage client accounts</span>
        </Link>
        <Link
          to="employees"
          className="flex flex-col items-center justify-center p-6 rounded-lg bg-white shadow border border-gray-200 hover:border-blue-300 hover:shadow-md transition-colors"
        >
          <span className="text-2xl mb-2">👷</span>
          <span className="font-medium text-gray-900">Employees</span>
          <span className="text-sm text-gray-500 mt-1">Manage employee accounts</span>
        </Link>
      </div>
    </div>
  )
}

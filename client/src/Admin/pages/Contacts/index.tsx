import { Routes, Route, Link } from 'react-router-dom'
import Clients from '../Clients'
import Employees from '../Employees'

export default function Contacts() {
  return (
    <Routes>
      <Route index element={<ContactsHome />} />
      <Route path="clients/*" element={<Clients />} />
      <Route path="employees/*" element={<Employees />} />
    </Routes>
  )
}

function ContactsHome() {
  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-4">Contacts</h2>
      <p className="text-gray-600 mb-6">Manage clients and employees.</p>
      <div className="grid gap-4 sm:grid-cols-2 max-w-md">
        <Link
          to="clients"
          className="flex flex-col items-center justify-center p-6 rounded-lg bg-white shadow border border-gray-200 hover:border-blue-300 hover:shadow-md transition-colors"
        >
          <span className="text-2xl mb-2">👤</span>
          <span className="font-medium text-gray-900">Clients</span>
          <span className="text-sm text-gray-500 mt-1">Client records and details</span>
        </Link>
        <Link
          to="employees"
          className="flex flex-col items-center justify-center p-6 rounded-lg bg-white shadow border border-gray-200 hover:border-blue-300 hover:shadow-md transition-colors"
        >
          <span className="text-2xl mb-2">👷</span>
          <span className="font-medium text-gray-900">Employees</span>
          <span className="text-sm text-gray-500 mt-1">Staff, schedules, and logins</span>
        </Link>
      </div>
    </div>
  )
}

import { Routes, Route, Link } from 'react-router-dom'
import EmployeeList from './components/EmployeeList'
import EmployeeForm from './components/EmployeeForm'
import Schedule from './components/Schedule'

export default function Employees() {
  return (
    <Routes>
      <Route index element={<EmployeesHome />} />
      <Route path="accounts" element={<EmployeeList />} />
      <Route path="accounts/new" element={<EmployeeForm />} />
      <Route path="accounts/:id" element={<EmployeeForm />} />
      <Route path="schedule" element={<Schedule />} />
    </Routes>
  )
}

function EmployeesHome() {
  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-4">Employees</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link to="accounts" className="bg-blue-500 text-white py-3 rounded text-center">Accounts</Link>
        <Link to="schedule" className="bg-green-500 text-white py-3 rounded text-center">Schedule</Link>
      </div>
    </div>
  )
}

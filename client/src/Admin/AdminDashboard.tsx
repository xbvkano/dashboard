import { Link, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Calendar from './pages/Calendar'
import Clients from './pages/Clients'
import Employees from './pages/Employees'
import Financing from './pages/Financing'

export default function AdminDashboard() {
  return (
    <div className="min-h-screen bg-gray-100 text-gray-900">
      <nav className="bg-white shadow mb-4">
        <ul className="flex flex-wrap justify-around p-2 text-sm">
          <li><Link className="px-2 py-1" to="/dashboard">Home</Link></li>
          <li><Link className="px-2 py-1" to="/dashboard/calendar">Calendar</Link></li>
          <li><Link className="px-2 py-1" to="/dashboard/clients">Clients</Link></li>
          <li><Link className="px-2 py-1" to="/dashboard/employees">Employees</Link></li>
          <li><Link className="px-2 py-1" to="/dashboard/financing">Financing</Link></li>
        </ul>
      </nav>
      <main>
        <Routes>
          <Route index element={<Home />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="clients" element={<Clients />} />
          <Route path="employees" element={<Employees />} />
          <Route path="financing" element={<Financing />} />
        </Routes>
      </main>
    </div>
  )
}

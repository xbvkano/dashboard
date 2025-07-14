import { Link, Routes, Route } from 'react-router-dom'
import Home from './pages/home/Home'
import Calendar from './pages/calendar'
import Clients from './pages/clients'
import Employees from './pages/employees'
import Financing from './pages/financing/Financing'

export default function AdminDashboard() {
  return (
    <div className="min-h-screen bg-gray-100 text-gray-900">
      <nav className="bg-white shadow md:mb-4 fixed bottom-0 w-full md:static z-10">
        <ul className="flex flex-wrap justify-around p-2 text-sm">
          <li><Link className="px-2 py-1" to="/dashboard">Home</Link></li>
          <li><Link className="px-2 py-1" to="/dashboard/calendar">Calendar</Link></li>
          <li><Link className="px-2 py-1" to="/dashboard/clients">Clients</Link></li>
          <li><Link className="px-2 py-1" to="/dashboard/employees">Employees</Link></li>
          <li><Link className="px-2 py-1" to="/dashboard/financing">Financing</Link></li>
        </ul>
      </nav>
      <main className="flex-1 pb-16 md:pb-0">
        <Routes>
          <Route index element={<Home />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="clients/*" element={<Clients />} />
          <Route path="employees/*" element={<Employees />} />
          <Route path="financing" element={<Financing />} />
        </Routes>
      </main>
    </div>
  )
}

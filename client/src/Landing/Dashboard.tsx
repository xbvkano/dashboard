import AdminDashboard from '../Admin/AdminDashboard'
import EmployeeDashboard from '../Employee/EmployeeDashboard'

type Role = 'ADMIN' | 'OWNER' | 'EMPLOYEE'

interface DashboardProps {
  role: Role
  onLogout: () => void
}

export default function Dashboard({ role, onLogout }: DashboardProps) {
  return role === 'EMPLOYEE' ? (
    <EmployeeDashboard onLogout={onLogout} />
  ) : (
    <AdminDashboard onLogout={onLogout} />
  )
}

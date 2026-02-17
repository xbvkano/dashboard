import AdminDashboard from '../Admin/AdminDashboard'
import EmployeeDashboard from '../Employee/EmployeeDashboard'

type Role = 'ADMIN' | 'OWNER' | 'EMPLOYEE'

interface DashboardProps {
  role: Role
  onLogout: () => void
  onSwitchRole?: (role: Role, userName?: string) => void
}

export default function Dashboard({ role, onLogout, onSwitchRole }: DashboardProps) {
  return role === 'EMPLOYEE' ? (
    <EmployeeDashboard onLogout={onLogout} onSwitchRole={onSwitchRole} />
  ) : (
    <AdminDashboard onLogout={onLogout} onSwitchRole={onSwitchRole} />
  )
}

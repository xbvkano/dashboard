import AdminDashboard from '../Admin/AdminDashboard'
import EmployeeDashboard from '../Employee/EmployeeDashboard'

type Role = 'ADMIN' | 'OWNER' | 'EMPLOYEE'

interface DashboardProps {
  role: Role
  onLogout: () => void
  /** Optional third arg: dev NO_AUTH admin user id (1 or 2) for inbox lock testing in two tabs */
  onSwitchRole?: (role: Role, userName?: string, devUserId?: number) => void
}

export default function Dashboard({ role, onLogout, onSwitchRole }: DashboardProps) {
  return role === 'EMPLOYEE' ? (
    <EmployeeDashboard onLogout={onLogout} onSwitchRole={onSwitchRole} />
  ) : (
    <AdminDashboard onLogout={onLogout} onSwitchRole={onSwitchRole} />
  )
}

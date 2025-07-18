import AdminDashboard from '../Admin/AdminDashboard'
import UserDashboard from '../User/UserDashboard'

type Role = 'ADMIN' | 'OWNER' | 'EMPLOYEE'

interface DashboardProps {
  role: Role
  onLogout: () => void
}

export default function Dashboard({ role, onLogout }: DashboardProps) {
  return role === 'EMPLOYEE' ? (
    <UserDashboard onLogout={onLogout} />
  ) : (
    <AdminDashboard onLogout={onLogout} />
  )
}

import AdminDashboard from './AdminDashboard'
import UserDashboard from './UserDashboard'

type Role = 'admin' | 'user'

interface DashboardProps {
  role: Role
}

export default function Dashboard({ role }: DashboardProps) {
  return role === 'admin' ? <AdminDashboard /> : <UserDashboard />
}

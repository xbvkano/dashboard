import AdminDashboard from '../Admin/AdminDashboard'
import UserDashboard from '../User/UserDashboard'

type Role = 'admin' | 'user'

interface DashboardProps {
  role: Role
}

export default function Dashboard({ role }: DashboardProps) {
  return role === 'admin' ? <AdminDashboard /> : <UserDashboard />
}

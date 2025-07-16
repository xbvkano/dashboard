import AdminDashboard from '../Admin/AdminDashboard'
import UserDashboard from '../User/UserDashboard'

type Role = 'ADMIN' | 'OWNER' | 'EMPLOYEE'

interface DashboardProps {
  role: Role
}

export default function Dashboard({ role }: DashboardProps) {
  return role === 'EMPLOYEE' ? <UserDashboard /> : <AdminDashboard />
}

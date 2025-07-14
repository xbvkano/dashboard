import AdminDashboard from './AdminDashboard'
import UserDashboard from './UserDashboard'

export default function Dashboard({ role }) {
  return role === 'admin' ? <AdminDashboard /> : <UserDashboard />
}

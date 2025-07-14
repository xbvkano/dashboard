import { Routes, Route } from 'react-router-dom'
import EmployeeList from './components/EmployeeList'
import EmployeeForm from './components/EmployeeForm'

export default function Employees() {
  return (
    <Routes>
      <Route index element={<EmployeeList />} />
      <Route path="new" element={<EmployeeForm />} />
      <Route path=":id" element={<EmployeeForm />} />
    </Routes>
  )
}

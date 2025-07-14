import { Routes, Route } from 'react-router-dom'
import ClientList from './components/ClientList'
import ClientForm from './components/ClientForm'

export default function Clients() {
  return (
    <Routes>
      <Route index element={<ClientList />} />
      <Route path="new" element={<ClientForm />} />
      <Route path=":id" element={<ClientForm />} />
    </Routes>
  )
}

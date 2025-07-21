import { Link } from 'react-router-dom'

export default function Payroll() {
  return (
    <div className="p-4">
      <Link to=".." className="text-blue-500 text-sm">&larr; Back</Link>
      <h2 className="text-xl font-semibold mb-2">Payroll</h2>
      {/* TODO: add payroll table */}
    </div>
  )
}

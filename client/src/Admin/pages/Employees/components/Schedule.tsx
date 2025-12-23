import { Link } from 'react-router-dom'

export default function Schedule() {
  return (
    <div className="p-4 pb-16">
      <Link to=".." className="text-blue-500 text-sm">&larr; Back</Link>
      <h2 className="text-xl font-semibold mb-4">Schedule</h2>
      <div className="p-8 text-center text-gray-500">
        Write schedule
      </div>
    </div>
  )
}


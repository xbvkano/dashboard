import { Routes, Route, Link } from 'react-router-dom'
import Leads from './Leads'
import Inbox from './Inbox/Inbox'
import ScreenshotBooking from './ScreenshotBooking'
import { BookAppointmentDraftsProvider } from './BookAppointmentDraftsContext'
import MessagesBookAppointmentModalHost from './MessagesBookAppointmentModalHost'

export default function Messages() {
  return (
    <BookAppointmentDraftsProvider>
      <div className="flex min-h-0 flex-1 flex-col">
        <Routes>
          <Route index element={<MessagesHome />} />
          <Route path="inbox" element={<Inbox />} />
          <Route path="screenshot-booking" element={<ScreenshotBooking />} />
          <Route path="leads" element={<Leads />} />
        </Routes>
        <MessagesBookAppointmentModalHost />
      </div>
    </BookAppointmentDraftsProvider>
  )
}

function MessagesHome() {
  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-4">Messages</h2>
      <p className="text-gray-600 mb-6">Select a message type to manage.</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 max-w-4xl">
        <Link
          to="inbox"
          className="flex flex-col items-center justify-center p-6 rounded-lg bg-white shadow border border-gray-200 hover:border-blue-300 hover:shadow-md transition-colors"
        >
          <span className="text-2xl mb-2">💬</span>
          <span className="font-medium text-gray-900">Inbox</span>
          <span className="text-sm text-gray-500 mt-1">SMS conversations</span>
        </Link>
        <Link
          to="screenshot-booking"
          className="flex flex-col items-center justify-center p-6 rounded-lg bg-white shadow border border-gray-200 hover:border-blue-300 hover:shadow-md transition-colors"
        >
          <span className="text-2xl mb-2">🖼️</span>
          <span className="font-medium text-gray-900">Screenshot booking</span>
          <span className="text-sm text-gray-500 mt-1">Upload chat screenshots</span>
        </Link>
        <Link
          to="leads"
          className="flex flex-col items-center justify-center p-6 rounded-lg bg-white shadow border border-gray-200 hover:border-blue-300 hover:shadow-md transition-colors sm:col-span-2 lg:col-span-1"
        >
          <span className="text-2xl mb-2">📩</span>
          <span className="font-medium text-gray-900">Leads</span>
          <span className="text-sm text-gray-500 mt-1">Manage leads</span>
        </Link>
      </div>
    </div>
  )
}

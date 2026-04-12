// Load .env so tests can use TWILIO_MESSAGING_SERVICE_SID / TWILIO_FROM_NUMBER when present
const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '.env') })
// Ensure Twilio outbound is defined for tests that mock SMS when .env omits both
if (!process.env.TWILIO_MESSAGING_SERVICE_SID?.trim() && !process.env.TWILIO_FROM_NUMBER?.trim()) {
  process.env.TWILIO_FROM_NUMBER = '+15551234567'
}

// Load .env so tests can use TWILIO_FROM_NUMBER etc. when present
const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '.env') })

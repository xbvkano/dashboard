import { Router } from 'express'
import { createAIAppointment, getAIAppointments } from '../controllers/aiAppointmentsController'
import { getOpenAPISpec } from '../controllers/openApiController'

const router = Router()

// AI Appointment routes
router.post('/ai-appointments', createAIAppointment)
router.get('/appointments/ai', getAIAppointments)

// OpenAPI specification
router.get('/openapi.json', getOpenAPISpec)

export default router

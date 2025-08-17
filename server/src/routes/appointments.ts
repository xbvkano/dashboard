import { Router } from 'express'
import { 
  getAppointments,
  getAppointmentsByLineage,
  getNoTeamAppointments,
  getUpcomingRecurringAppointments,
  updateRecurringDone,
  createRecurringAppointment,
  createAppointment,
  updateAppointment,
  sendAppointmentInfo
} from '../controllers/appointmentsController'

const router = Router()

// Appointment routes
router.get('/appointments', getAppointments)
router.get('/appointments/lineage/:lineage', getAppointmentsByLineage)
router.get('/appointments/no-team', getNoTeamAppointments)
router.get('/appointments/upcoming-recurring', getUpcomingRecurringAppointments)
router.put('/appointments/:id/recurring-done', updateRecurringDone)
router.post('/appointments/recurring', createRecurringAppointment)
router.post('/appointments', createAppointment)
router.put('/appointments/:id', updateAppointment)
router.post('/appointments/:id/send-info', sendAppointmentInfo)

export default router

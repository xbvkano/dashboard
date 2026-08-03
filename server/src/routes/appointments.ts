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
  sendAppointmentInfo,
  sendAppointmentEditNotice,
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
router.post('/appointments/:id/send-edit-notice', sendAppointmentEditNotice)

export default router

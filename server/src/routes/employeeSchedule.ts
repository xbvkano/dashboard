import { Router } from 'express'
import {
  getSchedule,
  saveSchedule,
  confirmSchedule,
  getUpcomingAppointments,
  confirmJob,
  getActiveJob,
  postAppointmentServiceStatus,
} from '../controllers/employeeScheduleController'
import { getSchedulePolicy } from '../controllers/employeesController'

const router = Router()

// Employee schedule routes (for logged-in employees)
router.get('/employee/schedule-policy', getSchedulePolicy)
router.get('/employee/schedule', getSchedule)
router.post('/employee/schedule', saveSchedule)
router.post('/employee/schedule/confirm', confirmSchedule)
router.get('/employee/upcoming-appointments', getUpcomingAppointments)
router.get('/employee/active-job', getActiveJob)
router.post('/employee/appointments/:id/service-status', postAppointmentServiceStatus)
router.post('/employee/confirm-job', confirmJob)

export default router



import { Router } from 'express'
import { getSchedule, saveSchedule, confirmSchedule, getUpcomingAppointments } from '../controllers/employeeScheduleController'

const router = Router()

// Employee schedule routes (for logged-in employees)
router.get('/employee/schedule', getSchedule)
router.post('/employee/schedule', saveSchedule)
router.post('/employee/schedule/confirm', confirmSchedule)
router.get('/employee/upcoming-appointments', getUpcomingAppointments)

export default router



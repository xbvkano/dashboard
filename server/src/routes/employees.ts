import { Router } from 'express'
import {
  getEmployees,
  getAvailableEmployees,
  getSupervisors,
  getScheduleOverview,
  getScheduleProjection,
  updateScheduleProjection,
  getScheduledAt,
  getSchedulePolicy,
  updateSchedulePolicy,
  createEmployee,
  getEmployee,
  updateEmployee,
  deleteEmployee,
  getEmployeeAppointments,
  getEmployeeScheduleView,
} from '../controllers/employeesController'

const router = Router()

// Employee routes (specific paths before :id)
router.get('/employees', getEmployees)
router.get('/employees/available', getAvailableEmployees)
router.get('/employees/supervisors', getSupervisors)
router.get('/employees/schedule-overview', getScheduleOverview)
router.get('/employees/schedule-projection', getScheduleProjection)
router.put('/employees/schedule-projection', updateScheduleProjection)
router.get('/employees/schedule-policy', getSchedulePolicy)
router.put('/employees/schedule-policy', updateSchedulePolicy)
router.get('/employees/scheduled-at', getScheduledAt)
router.post('/employees', createEmployee)
router.get('/employees/:id/schedule-view', getEmployeeScheduleView)
router.get('/employees/:id', getEmployee)
router.put('/employees/:id', updateEmployee)
router.delete('/employees/:id', deleteEmployee)
router.get('/employees/:id/appointments', getEmployeeAppointments)

export default router

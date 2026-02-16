import { Router } from 'express'
import { 
  getEmployees, 
  getAvailableEmployees,
  createEmployee, 
  getEmployee, 
  updateEmployee, 
  deleteEmployee, 
  getEmployeeAppointments 
} from '../controllers/employeesController'

const router = Router()

// Employee routes
router.get('/employees', getEmployees)
router.get('/employees/available', getAvailableEmployees)
router.post('/employees', createEmployee)
router.get('/employees/:id', getEmployee)
router.put('/employees/:id', updateEmployee)
router.delete('/employees/:id', deleteEmployee)
router.get('/employees/:id/appointments', getEmployeeAppointments)

export default router

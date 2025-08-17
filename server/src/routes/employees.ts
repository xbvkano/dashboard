import { Router } from 'express'
import { 
  getEmployees, 
  createEmployee, 
  getEmployee, 
  updateEmployee, 
  deleteEmployee, 
  getEmployeeAppointments 
} from '../controllers/employeesController'

const router = Router()

// Employee routes
router.get('/employees', getEmployees)
router.post('/employees', createEmployee)
router.get('/employees/:id', getEmployee)
router.put('/employees/:id', updateEmployee)
router.delete('/employees/:id', deleteEmployee)
router.get('/employees/:id/appointments', getEmployeeAppointments)

export default router

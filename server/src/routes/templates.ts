import { Router } from 'express'
import { 
  getAppointmentTemplates, 
  createAppointmentTemplate, 
  deleteAppointmentTemplate 
} from '../controllers/templatesController'

const router = Router()

// Template routes
router.get('/appointment-templates', getAppointmentTemplates)
router.post('/appointment-templates', createAppointmentTemplate)
router.delete('/appointment-templates/:id', deleteAppointmentTemplate)

export default router

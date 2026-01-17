import { Router } from 'express'
import { 
  getAppointmentTemplates, 
  createAppointmentTemplate, 
  updateAppointmentTemplate,
  deleteAppointmentTemplate 
} from '../controllers/templatesController'

const router = Router()

// Template routes
router.get('/appointment-templates', getAppointmentTemplates)
router.post('/appointment-templates', createAppointmentTemplate)
router.put('/appointment-templates/:id', updateAppointmentTemplate)
router.delete('/appointment-templates/:id', deleteAppointmentTemplate)

export default router

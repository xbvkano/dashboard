import { Router } from 'express'
import { 
  getClients, 
  createClient, 
  getClient, 
  updateClient, 
  deleteClient, 
  getClientAppointments,
  getClientRecurrenceFamilies
} from '../controllers/clientsController'

const router = Router()

// Client routes
router.get('/clients', getClients)
router.post('/clients', createClient)
router.get('/clients/:id', getClient)
router.put('/clients/:id', updateClient)
router.delete('/clients/:id', deleteClient)
router.get('/clients/:id/appointments', getClientAppointments)
router.get('/clients/:id/recurrence-families', getClientRecurrenceFamilies)

export default router

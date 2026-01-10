import express from 'express'
import {
  getActiveRecurrenceFamilies,
  getStoppedRecurrenceFamilies,
  getRecurrenceFamily,
  createRecurrenceFamily,
  updateRecurrenceFamily,
  confirmRecurringAppointment,
  confirmAndRescheduleRecurringAppointment,
  skipRecurringAppointment,
  moveRecurringAppointment,
  restartRecurrenceFamily,
} from '../controllers/recurringController'

const router = express.Router()

router.get('/recurring/active', getActiveRecurrenceFamilies)
router.get('/recurring/stopped', getStoppedRecurrenceFamilies)
router.get('/recurring/:id', getRecurrenceFamily)
router.post('/recurring', createRecurrenceFamily)
router.put('/recurring/:id', updateRecurrenceFamily)
router.post('/recurring/:id/restart', restartRecurrenceFamily)
router.post('/recurring/appointments/:id/confirm', confirmRecurringAppointment)
router.post('/recurring/appointments/:id/confirm-reschedule', confirmAndRescheduleRecurringAppointment)
router.post('/recurring/appointments/:id/skip', skipRecurringAppointment)
router.post('/recurring/appointments/:id/move', moveRecurringAppointment)

export default router
